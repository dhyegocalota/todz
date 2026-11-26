import { PROJECT_OPEN_TASKS_MAX, RuleIssue } from '@todz/types';
import { runInDurableObject } from 'cloudflare:test';
import { describe, expect, test } from 'vitest';
import { moveTask } from '../src/move-task';
import { ProjectFailureKind } from '../src/project-result';
import type { ProjectStore } from '../src/project-store';
import { AGENT_ACTOR, TODAY, newProjectStub, openTasksFilter, unwrap } from './task-fixtures';

type ProjectStub = DurableObjectStub<ProjectStore>;

const SOURCE_PROJECT_ID = 'source-project';
const SOURCE_PROJECT_NAME = 'Source';
const EDITED_NOTES = 'edited while moving';
const TABLE_COUNT_QUERY = "SELECT count(*) AS total FROM sqlite_master WHERE type = 'table' AND name = 'tasks'";

async function projectWithCarry(): Promise<ProjectStub> {
  const stub = newProjectStub();
  const drafts = [{ title: 'Carry', notes: 'first notes', dueDate: null, idempotencyKey: null }];
  unwrap(await stub.addTasks({ openTasksMax: PROJECT_OPEN_TASKS_MAX, actor: AGENT_ACTOR, drafts }));
  return stub;
}

function editedAfterRead(source: ProjectStub): ProjectStub {
  return new Proxy(source, {
    get(target, property) {
      const member = Reflect.get(target, property);
      if (property !== 'readTask') return member;
      return async (parameters: { number: number }) => {
        const read = await target.readTask(parameters);
        await target.updateTask({ actor: AGENT_ACTOR, number: parameters.number, patch: { notes: EDITED_NOTES } });
        return read;
      };
    },
  });
}

function readThenWaitFor({ source, until }: { source: ProjectStub; until: Promise<unknown> }): ProjectStub {
  return new Proxy(source, {
    get(target, property) {
      const member = Reflect.get(target, property);
      if (property !== 'readTask') return member;
      return async (parameters: { number: number }) => {
        const read = await target.readTask(parameters);
        await until;
        return read;
      };
    },
  });
}

function storedTableCountOf(stub: ProjectStub): Promise<number> {
  return runInDurableObject(stub, (_instance, state) => state.storage.sql.exec<{ total: number }>(TABLE_COUNT_QUERY).one().total);
}

function move({
  source,
  destination,
  isDestinationListed = () => Promise.resolve(true),
}: {
  source: ProjectStub;
  destination: ProjectStub;
  isDestinationListed?: () => Promise<boolean>;
}) {
  return moveTask({
    source,
    sourceProjectId: SOURCE_PROJECT_ID,
    sourceProjectName: SOURCE_PROJECT_NAME,
    destination,
    openTasksMax: PROJECT_OPEN_TASKS_MAX,
    isDestinationListed,
    actor: AGENT_ACTOR,
    number: 1,
  });
}

async function openTitles(stub: ProjectStub): Promise<string[]> {
  return unwrap(await stub.listTasks({ today: TODAY, filter: openTasksFilter() })).tasks.map((task) => task.title);
}

describe('moveTask and a concurrent edit', () => {
  test('a source edited between the read and the delete stays, the destination copy is cleaned up and a retry carries the edit', async () => {
    const source = await projectWithCarry();
    const destination = newProjectStub();
    const failed = await move({ source: editedAfterRead(source), destination });
    expect(failed).toEqual({ ok: false, failure: { kind: ProjectFailureKind.RuleViolated, issue: RuleIssue.TaskChanged, index: null } });
    expect(unwrap(await source.readTask({ number: 1 })).notes).toBe(EDITED_NOTES);
    expect(await openTitles(destination)).toEqual([]);
    unwrap(await move({ source, destination }));
    expect(await openTitles(source)).toEqual([]);
    expect(unwrap(await destination.listTasks({ today: TODAY, filter: openTasksFilter() })).tasks).toMatchObject([{ notes: EDITED_NOTES }]);
  });
});

describe('two moves of the same task', () => {
  test('the one that loses the source keeps the arrival of the one that won', async () => {
    const source = await projectWithCarry();
    const destination = newProjectStub();
    const winner = move({ source, destination });
    const loser = await move({ source: readThenWaitFor({ source, until: winner }), destination });
    expect((await winner).ok).toBe(true);
    expect(loser).toMatchObject({ ok: false, failure: { kind: ProjectFailureKind.TaskNotFound } });
    expect(await openTitles(destination)).toEqual(['Carry']);
    expect(await openTitles(source)).toEqual([]);
  });
});

describe('moveTask into a project deleted mid-move', () => {
  test('rolls the add back, wipes the orphaned storage and leaves the source', async () => {
    const source = await projectWithCarry();
    const destination = newProjectStub();
    const failed = await move({ source, destination, isDestinationListed: () => Promise.resolve(false) });
    expect(failed).toEqual({
      ok: false,
      failure: { kind: ProjectFailureKind.RuleViolated, issue: RuleIssue.DestinationGone, index: null },
    });
    expect(await openTitles(source)).toEqual(['Carry']);
    expect(await storedTableCountOf(destination)).toBe(0);
  });
});
