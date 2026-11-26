import { MILLISECONDS_PER_HOUR, PROJECT_OPEN_TASKS_MAX, TaskPlacement, TaskState } from '@todz/types';
import { runInDurableObject } from 'cloudflare:test';
import { env } from 'cloudflare:workers';
import { describe, expect, test } from 'vitest';
import { ProjectFailureKind } from '../src/project-result';
import { openKeyProject, openOwnedProject, resolveSessionOwner } from '../src/project-routing';
import type { ProjectStore } from '../src/project-store';
import { SqliteTaskStore } from '../src/sqlite-task-store';
import { countingEnv } from './counting-namespace';
import { seedKey, seedOwner, seedProject, seedSession } from './directory-seed';
import { AGENT_ACTOR, CLOCK_NOW, TODAY, draftOf, openTasksFilter, unwrap } from './task-fixtures';

type Stub = DurableObjectStub<ProjectStore>;

const NEVER_EXISTING_NUMBER = 99;
const SECRET_TEXT = 'secret';
const SHARED_IDEMPOTENCY_KEY = 'run-1';

type World = {
  projectIds: { a: string; b: string; c: string };
  keys: { a: string; b: string; c: string; revokedA: string };
  sessions: { firstOwnerLive: string; firstOwnerExpired: string; secondOwnerLive: string };
};

function newSecret(): string {
  return crypto.randomUUID();
}

async function openKey(secret: string): Promise<Stub> {
  const keyProject = await openKeyProject({ env, secret });
  if (keyProject === null) throw new Error('the key should open a project');
  return keyProject.project;
}

async function seedWorld(): Promise<World> {
  const firstOwnerId = await seedOwner();
  const secondOwnerId = await seedOwner();
  const projectIds = {
    a: await seedProject({ ownerId: firstOwnerId }),
    b: await seedProject({ ownerId: firstOwnerId }),
    c: await seedProject({ ownerId: secondOwnerId }),
  };
  const keys = { a: newSecret(), b: newSecret(), c: newSecret(), revokedA: newSecret() };
  await seedKey({ projectId: projectIds.a, secret: keys.a });
  await seedKey({ projectId: projectIds.b, secret: keys.b });
  await seedKey({ projectId: projectIds.c, secret: keys.c });
  await seedKey({ projectId: projectIds.a, secret: keys.revokedA, revokedAt: CLOCK_NOW });
  const sessions = { firstOwnerLive: newSecret(), firstOwnerExpired: newSecret(), secondOwnerLive: newSecret() };
  await seedSession({ ownerId: firstOwnerId, secret: sessions.firstOwnerLive, expiresAt: CLOCK_NOW + MILLISECONDS_PER_HOUR });
  await seedSession({ ownerId: firstOwnerId, secret: sessions.firstOwnerExpired, expiresAt: CLOCK_NOW });
  await seedSession({ ownerId: secondOwnerId, secret: sessions.secondOwnerLive, expiresAt: CLOCK_NOW + MILLISECONDS_PER_HOUR });
  unwrap(await (await openKey(keys.a)).addTasks({ openTasksMax: PROJECT_OPEN_TASKS_MAX, actor: AGENT_ACTOR, drafts: [draftOf('A one')] }));
  unwrap(
    await (
      await openKey(keys.b)
    ).addTasks({
      openTasksMax: PROJECT_OPEN_TASKS_MAX,
      actor: AGENT_ACTOR,
      drafts: [{ ...draftOf('B secret alpha'), notes: 'B notes' }, draftOf('B two'), draftOf('B three')],
    }),
  );
  unwrap(await (await openKey(keys.c)).addTasks({ openTasksMax: PROJECT_OPEN_TASKS_MAX, actor: AGENT_ACTOR, drafts: [draftOf('C one')] }));
  return { projectIds, keys, sessions };
}

async function openTitles(stub: Stub): Promise<string[]> {
  return unwrap(await stub.listTasks({ today: TODAY, filter: openTasksFilter() })).tasks.map((task) => task.title);
}

async function historyLength({ stub, number }: { stub: Stub; number: number }): Promise<number> {
  return runInDurableObject(stub, (_instance, state) => new SqliteTaskStore(state.storage.sql).listHistory(number).length);
}

describe('a key of project A', () => {
  test('updating a task of B answers exactly what a task that never existed answers, and B is unchanged', async () => {
    const world = await seedWorld();
    const stubA = await openKey(world.keys.a);
    const missing = await stubA.updateTask({ actor: AGENT_ACTOR, number: NEVER_EXISTING_NUMBER, patch: { title: 'Hijacked' } });
    const crossProject = await stubA.updateTask({ actor: AGENT_ACTOR, number: 2, patch: { title: 'Hijacked' } });
    expect(crossProject).toEqual({ ok: false, failure: { kind: ProjectFailureKind.TaskNotFound, number: 2 } });
    expect(missing).toEqual({ ok: false, failure: { kind: ProjectFailureKind.TaskNotFound, number: NEVER_EXISTING_NUMBER } });
    expect(await openTitles(await openKey(world.keys.b))).toEqual(['B secret alpha', 'B two', 'B three']);
  });

  test('completing and reopening a task of B fail as not found and B gains no history line', async () => {
    const world = await seedWorld();
    const stubA = await openKey(world.keys.a);
    const stubB = await openKey(world.keys.b);
    const historyBefore = await historyLength({ stub: stubB, number: 2 });
    const expected = { ok: false, failure: { kind: ProjectFailureKind.TaskNotFound, number: 2 } };
    expect(await stubA.completeTasks({ actor: AGENT_ACTOR, numbers: [2], note: null })).toEqual(expected);
    expect(await stubA.reopenTasks({ openTasksMax: PROJECT_OPEN_TASKS_MAX, actor: AGENT_ACTOR, numbers: [2] })).toEqual(expected);
    expect(await openTitles(stubB)).toContain('B two');
    expect(await historyLength({ stub: stubB, number: 2 })).toBe(historyBefore);
  });

  test('placing a task of A before an anchor that only B has fails as not found', async () => {
    const world = await seedWorld();
    const patch = { placement: { kind: TaskPlacement.Before, anchor: 3 } };
    expect(await (await openKey(world.keys.a)).updateTask({ actor: AGENT_ACTOR, number: 1, patch })).toEqual({
      ok: false,
      failure: { kind: ProjectFailureKind.TaskNotFound, number: 3 },
    });
  });

  test('searching for text only B has finds nothing, and listing shows only its own task', async () => {
    const world = await seedWorld();
    const stubA = await openKey(world.keys.a);
    const searches = await Promise.all(
      [TaskState.Open, TaskState.Done].map(async (state) =>
        unwrap(await stubA.listTasks({ today: TODAY, filter: { ...openTasksFilter(), state, text: SECRET_TEXT } })),
      ),
    );
    expect(searches.map((search) => ({ tasks: search.tasks.length, totalMatched: search.totalMatched }))).toEqual([
      { tasks: 0, totalMatched: 0 },
      { tasks: 0, totalMatched: 0 },
    ]);
    expect(await openTitles(stubA)).toEqual(['A one']);
  });

  test('the next task is its own, never one of B', async () => {
    const world = await seedWorld();
    const next = unwrap(await (await openKey(world.keys.a)).nextTask({ today: TODAY }));
    expect(next?.title).toBe('A one');
  });

  test('completing T-1 leaves T-1 of B open', async () => {
    const world = await seedWorld();
    unwrap(await (await openKey(world.keys.a)).completeTasks({ actor: AGENT_ACTOR, numbers: [1], note: null }));
    expect(await openTitles(await openKey(world.keys.b))).toContain('B secret alpha');
  });

  test('the same idempotency key adds one task in each project', async () => {
    const world = await seedWorld();
    const draft = { ...draftOf('Replayable'), idempotencyKey: SHARED_IDEMPOTENCY_KEY };
    const throughA = unwrap(
      await (await openKey(world.keys.a)).addTasks({ openTasksMax: PROJECT_OPEN_TASKS_MAX, actor: AGENT_ACTOR, drafts: [draft] }),
    );
    const throughB = unwrap(
      await (await openKey(world.keys.b)).addTasks({ openTasksMax: PROJECT_OPEN_TASKS_MAX, actor: AGENT_ACTOR, drafts: [draft] }),
    );
    expect([throughA[0]?.replayed, throughB[0]?.replayed]).toEqual([false, false]);
  });

  test('a batch mixing its own T-1 with T-2 of B fails as not found and T-1 stays open', async () => {
    const world = await seedWorld();
    const stubA = await openKey(world.keys.a);
    expect(await stubA.completeTasks({ actor: AGENT_ACTOR, numbers: [1, 2], note: null })).toEqual({
      ok: false,
      failure: { kind: ProjectFailureKind.TaskNotFound, number: 2 },
    });
    expect(await openTitles(stubA)).toEqual(['A one']);
  });
});

describe('sessions, keys and refusals', () => {
  test('the second owner opens nothing of A, exactly what a random id gets', async () => {
    const world = await seedWorld();
    const owner = await resolveSessionOwner({ env, secret: world.sessions.secondOwnerLive, now: CLOCK_NOW });
    if (owner === null) throw new Error('the second owner session should be live');
    expect(await openOwnedProject({ env, owner, projectId: world.projectIds.a })).toBeNull();
    expect(await openOwnedProject({ env, owner, projectId: crypto.randomUUID() })).toBeNull();
  });

  test('the first owner opens A and B and each sees only its own tasks', async () => {
    const world = await seedWorld();
    const owner = await resolveSessionOwner({ env, secret: world.sessions.firstOwnerLive, now: CLOCK_NOW });
    if (owner === null) throw new Error('the first owner session should be live');
    const stubA = await openOwnedProject({ env, owner, projectId: world.projectIds.a });
    const stubB = await openOwnedProject({ env, owner, projectId: world.projectIds.b });
    if (stubA === null || stubB === null) throw new Error('the owner should open both projects');
    expect(await openTitles(stubA)).toEqual(['A one']);
    expect(await openTitles(stubB)).toEqual(['B secret alpha', 'B two', 'B three']);
  });

  test('the revoked key opens nothing', async () => {
    const world = await seedWorld();
    expect(await openKeyProject({ env, secret: world.keys.revokedA })).toBeNull();
  });

  test('the expired session resolves to nothing', async () => {
    const world = await seedWorld();
    expect(await resolveSessionOwner({ env, secret: world.sessions.firstOwnerExpired, now: CLOCK_NOW })).toBeNull();
  });

  test('the key of C lists exactly the task of C', async () => {
    const world = await seedWorld();
    expect(await openTitles(await openKey(world.keys.c))).toEqual(['C one']);
  });

  test('every refusal addresses no Durable Object', async () => {
    const world = await seedWorld();
    const { countedEnv, addressingCalls } = countingEnv();
    const owner = await resolveSessionOwner({ env: countedEnv, secret: world.sessions.secondOwnerLive, now: CLOCK_NOW });
    if (owner === null) throw new Error('the second owner session should be live');
    const refusals = [
      await openKeyProject({ env: countedEnv, secret: newSecret() }),
      await openKeyProject({ env: countedEnv, secret: world.keys.revokedA }),
      await openKeyProject({ env: countedEnv, secret: '' }),
      await openOwnedProject({ env: countedEnv, owner, projectId: world.projectIds.a }),
      await openOwnedProject({ env: countedEnv, owner, projectId: crypto.randomUUID() }),
    ];
    expect(refusals).toEqual([null, null, null, null, null]);
    expect(addressingCalls).toEqual([]);
  });
});
