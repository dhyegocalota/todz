import type { Actor } from '@todz/core';
import { ActorKind, MILLISECONDS_PER_HOUR, PROJECT_OPEN_TASKS_MAX, RuleIssue, TaskPlacement, TaskState } from '@todz/types';
import { runInDurableObject } from 'cloudflare:test';
import { env } from 'cloudflare:workers';
import { describe, expect, test } from 'vitest';
import { digestCredential } from '../src/credential-digest';
import { GrantShape } from '../src/oauth/oauth-grant-scope';
import { ProjectFailureKind } from '../src/project-result';
import { openOAuthAccess, openOwnedProject, resolveSessionOwner } from '../src/project-routing';
import { countingEnv } from './counting-namespace';
import { seedLiveOwner, seedOwner, seedProject, seedProjectToken, seedSession } from './directory-seed';
import { AGENT_ACTOR, CLOCK_NOW, TODAY, draftOf, newProjectStub, openTasksFilter, rejectionMessageOf, unwrap } from './task-fixtures';

const LONG_SECRET_LENGTH = 1_000_000;
const SQL_PROJECT_ID = "x' OR '1'='1";
const WHITESPACE_SECRET = '   ';

function newSecret(): string {
  return crypto.randomUUID();
}

describe('a credential that is almost right opens nothing and addresses no Durable Object', () => {
  async function seededToken(): Promise<string> {
    const secret = newSecret();
    await seedProjectToken({ projectId: await seedProject({ ownerId: await seedOwner() }), secret });
    return secret;
  }

  test.each([
    { name: 'a trailing space', change: (secret: string) => secret + ' ' },
    { name: 'a leading newline', change: (secret: string) => '\n' + secret },
    { name: 'upper case', change: (secret: string) => secret.toUpperCase() },
    { name: 'a prefix', change: (secret: string) => secret.slice(0, -1) },
  ])('the token secret with $name', async ({ change }) => {
    const secret = await seededToken();
    const { countedEnv, addressingCalls } = countingEnv();
    expect(await openOAuthAccess({ env: countedEnv, secret: change(secret), now: CLOCK_NOW })).toBeNull();
    expect(addressingCalls).toEqual([]);
  });

  test('the digest of a seeded token used as a secret', async () => {
    const secret = await seededToken();
    const { countedEnv, addressingCalls } = countingEnv();
    expect(await openOAuthAccess({ env: countedEnv, secret: await digestCredential(secret), now: CLOCK_NOW })).toBeNull();
    expect(addressingCalls).toEqual([]);
  });

  test('a secret of a million characters', async () => {
    const { countedEnv, addressingCalls } = countingEnv();
    expect(await openOAuthAccess({ env: countedEnv, secret: 'a'.repeat(LONG_SECRET_LENGTH), now: CLOCK_NOW })).toBeNull();
    expect(addressingCalls).toEqual([]);
  });

  test('a whitespace-only secret', async () => {
    expect(await openOAuthAccess({ env, secret: WHITESPACE_SECRET, now: CLOCK_NOW })).toBeNull();
    expect(await resolveSessionOwner({ env, secret: WHITESPACE_SECRET, now: CLOCK_NOW })).toBeNull();
  });

  test('a session secret offered as a token and a token secret offered as a session', async () => {
    const ownerId = await seedOwner();
    const sessionSecret = newSecret();
    const tokenSecret = newSecret();
    await seedSession({ ownerId, secret: sessionSecret, expiresAt: CLOCK_NOW + MILLISECONDS_PER_HOUR });
    await seedProjectToken({ projectId: await seedProject({ ownerId }), secret: tokenSecret });
    expect(await openOAuthAccess({ env, secret: sessionSecret, now: CLOCK_NOW })).toBeNull();
    expect(await resolveSessionOwner({ env, secret: tokenSecret, now: CLOCK_NOW })).toBeNull();
  });

  test('a token expiring at instant 0', async () => {
    const secret = newSecret();
    await seedProjectToken({ projectId: await seedProject({ ownerId: await seedOwner() }), secret, expiresAt: 0 });
    expect(await openOAuthAccess({ env, secret, now: CLOCK_NOW })).toBeNull();
  });

  test('a session that expired one millisecond before now', async () => {
    const secret = newSecret();
    await seedSession({ ownerId: await seedOwner(), secret, expiresAt: CLOCK_NOW - 1 });
    expect(await resolveSessionOwner({ env, secret, now: CLOCK_NOW })).toBeNull();
  });
});

describe('a project id that is not exactly the owned one opens nothing', () => {
  test.each([
    { name: 'SQL characters', change: () => SQL_PROJECT_ID },
    { name: 'upper case', change: (projectId: string) => projectId.toUpperCase() },
    { name: 'a trailing space', change: (projectId: string) => projectId + ' ' },
    { name: 'an empty string', change: () => '' },
  ])('$name', async ({ change }) => {
    const ownerId = await seedOwner();
    const projectId = await seedProject({ ownerId });
    const owner = await seedLiveOwner({ ownerId });
    const { countedEnv, addressingCalls } = countingEnv();
    expect(await openOwnedProject({ env: countedEnv, owner, projectId: change(projectId) })).toBeNull();
    expect(addressingCalls).toEqual([]);
  });
});

describe('a token of one project reaches nothing of another', () => {
  async function twoProjects() {
    const ownerId = await seedOwner();
    const secrets = { a: newSecret(), b: newSecret() };
    await seedProjectToken({ projectId: await seedProject({ ownerId }), secret: secrets.a });
    await seedProjectToken({ projectId: await seedProject({ ownerId }), secret: secrets.b });
    const accessA = await openOAuthAccess({ env, secret: secrets.a, now: CLOCK_NOW });
    const accessB = await openOAuthAccess({ env, secret: secrets.b, now: CLOCK_NOW });
    if (accessA?.scope !== GrantShape.Project || accessB?.scope !== GrantShape.Project) throw new Error('both tokens should open');
    const stubA = accessA.grantProject.project;
    const stubB = accessB.grantProject.project;
    unwrap(await stubA.addTasks({ openTasksMax: PROJECT_OPEN_TASKS_MAX, actor: AGENT_ACTOR, drafts: [draftOf('A one')] }));
    unwrap(
      await stubB.addTasks({
        openTasksMax: PROJECT_OPEN_TASKS_MAX,
        actor: AGENT_ACTOR,
        drafts: [draftOf('B secret alpha'), draftOf('B two')],
      }),
    );
    return { stubA, stubB };
  }

  test('placing after an anchor that only B has fails as not found', async () => {
    const { stubA } = await twoProjects();
    const patch = { placement: { kind: TaskPlacement.After, anchor: 2 } };
    expect(await stubA.updateTask({ actor: AGENT_ACTOR, number: 1, patch })).toEqual({
      ok: false,
      failure: { kind: ProjectFailureKind.TaskNotFound, number: 2 },
    });
  });

  test('a text search with any case or wildcard finds no task of B', async () => {
    const { stubA } = await twoProjects();
    const texts = ['SECRET', 'secret', '%', '_', 'alpha'];
    const matches = await Promise.all(
      texts.map(async (text) =>
        unwrap(await stubA.listTasks({ today: TODAY, filter: { ...openTasksFilter(), state: TaskState.Open, text } })).tasks.map(
          (task) => task.title,
        ),
      ),
    );
    expect(matches.flat()).not.toContain('B secret alpha');
    expect(matches.flat()).not.toContain('B two');
  });

  test('an idempotency key that differs only in case adds a second task in the same project', async () => {
    const { stubA } = await twoProjects();
    const lower = { ...draftOf('Lower'), idempotencyKey: 'run-x' };
    const upper = { ...draftOf('Upper'), idempotencyKey: 'RUN-X' };
    const first = unwrap(await stubA.addTasks({ openTasksMax: PROJECT_OPEN_TASKS_MAX, actor: AGENT_ACTOR, drafts: [lower] }));
    const second = unwrap(await stubA.addTasks({ openTasksMax: PROJECT_OPEN_TASKS_MAX, actor: AGENT_ACTOR, drafts: [upper] }));
    expect([first[0]?.replayed, second[0]?.replayed]).toEqual([false, false]);
  });

  test('an idempotency key used in B replays nothing in A', async () => {
    const { stubA, stubB } = await twoProjects();
    const draft = { ...draftOf('Keyed'), idempotencyKey: 'only-b' };
    unwrap(await stubB.addTasks({ openTasksMax: PROJECT_OPEN_TASKS_MAX, actor: AGENT_ACTOR, drafts: [draft] }));
    const throughA = unwrap(
      await stubA.addTasks({ openTasksMax: PROJECT_OPEN_TASKS_MAX, actor: AGENT_ACTOR, drafts: [{ ...draft, title: 'Keyed in A' }] }),
    );
    expect(throughA.map(({ task, replayed }) => ({ title: task.title, number: task.number, replayed }))).toEqual([
      { title: 'Keyed in A', number: 2, replayed: false },
    ]);
  });
});

describe('the number counter', () => {
  test('a number is never reissued after the last task row is deleted by hand', async () => {
    const stub = newProjectStub();
    unwrap(await stub.addTasks({ openTasksMax: PROJECT_OPEN_TASKS_MAX, actor: AGENT_ACTOR, drafts: [draftOf('One'), draftOf('Two')] }));
    await runInDurableObject(stub, (_instance, state) => {
      state.storage.sql.exec('DELETE FROM task_history WHERE task_number = 2');
      state.storage.sql.exec('DELETE FROM tasks WHERE number = 2');
    });
    const added = unwrap(await stub.addTasks({ openTasksMax: PROJECT_OPEN_TASKS_MAX, actor: AGENT_ACTOR, drafts: [draftOf('Three')] }));
    expect(added.map(({ task }) => task.number)).toEqual([3]);
  });
});

describe('arguments that arrive through RPC', () => {
  const TASK_NUMBER_INVALID = {
    ok: false,
    failure: { kind: ProjectFailureKind.RuleViolated, issue: RuleIssue.TaskNumberInvalid, index: null },
  };

  test.each([{ number: 1.5 }, { number: -1 }, { number: Number.NaN }])(
    'updateTask with number $number is an invalid number',
    async ({ number }) => {
      const stub = newProjectStub();
      unwrap(await stub.addTasks({ openTasksMax: PROJECT_OPEN_TASKS_MAX, actor: AGENT_ACTOR, drafts: [draftOf('One')] }));
      expect(await stub.updateTask({ actor: AGENT_ACTOR, number, patch: { title: 'Changed' } })).toEqual(TASK_NUMBER_INVALID);
    },
  );

  test('extra fields on an owner actor are dropped from the stored creator', async () => {
    const stub = newProjectStub();
    const actor = { kind: ActorKind.Owner, ownerId: 'another-owner' } as unknown as Actor;
    const added = unwrap(await stub.addTasks({ openTasksMax: PROJECT_OPEN_TASKS_MAX, actor, drafts: [draftOf('One')] }));
    expect(added[0]?.task.createdBy).toEqual({ kind: ActorKind.Owner });
  });

  test('a row that does not map leaves the tasks, the counter and the history as they were after a failed completion', async () => {
    const stub = newProjectStub();
    unwrap(await stub.addTasks({ openTasksMax: PROJECT_OPEN_TASKS_MAX, actor: AGENT_ACTOR, drafts: [draftOf('One')] }));
    const countRows = () =>
      runInDurableObject(stub, (_instance, state) => ({
        tasks: state.storage.sql.exec('SELECT number FROM tasks').toArray().length,
        counter: state.storage.sql.exec('SELECT last_issued_number FROM task_counter').toArray(),
        history: state.storage.sql.exec('SELECT id FROM task_history').toArray().length,
      }));
    const before = await countRows();
    await runInDurableObject(stub, (_instance, state) => {
      state.storage.sql.exec("UPDATE tasks SET created_by_kind = 'agent', created_by_client = NULL");
    });
    const message = await rejectionMessageOf({
      stub,
      call: (instance) => instance.completeTasks({ actor: AGENT_ACTOR, numbers: [1], note: null }),
    });
    expect(message).toBe('tasks.created_by_client of task 1 is not valid');
    expect(await countRows()).toEqual(before);
  });
});

describe('a resolved session owner', () => {
  test('an owner resolved for one owner opens nothing of another owner project and addresses no Durable Object', async () => {
    const { countedEnv, addressingCalls } = countingEnv();
    const firstOwner = await seedLiveOwner({ ownerId: await seedOwner() });
    const secondProjectId = await seedProject({ ownerId: await seedOwner() });
    expect(await openOwnedProject({ env: countedEnv, owner: firstOwner, projectId: secondProjectId })).toBeNull();
    expect(addressingCalls).toEqual([]);
  });

  test('the same resolved owner opens its project on every call', async () => {
    const { countedEnv, addressingCalls } = countingEnv();
    const ownerId = await seedOwner();
    const projectId = await seedProject({ ownerId });
    const owner = await seedLiveOwner({ ownerId });
    expect(await openOwnedProject({ env: countedEnv, owner, projectId })).not.toBeNull();
    expect(await openOwnedProject({ env: countedEnv, owner, projectId })).not.toBeNull();
    expect(addressingCalls.filter((call) => call === 'get')).toHaveLength(2);
  });
});
