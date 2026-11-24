import { OWNER_ACTOR } from '@todz/core';
import { ActorKind, HistoryAction, TASK_BATCH_MAX_SIZE, TaskField } from '@todz/types';
import { describe, expect, test } from 'vitest';
import { ProjectFailureKind } from '../src/project-result';
import { CHANGE_PAGE_SIZE } from '../src/project-store';
import { AGENT_ACTOR, draftOf, newProjectStub, unwrap } from './task-fixtures';

const MISSING_NUMBER = 9;
const BEYOND_LAST_CHANGE = 4;
const BEFORE_FIRST_CHANGE = 0;
const NEW_STORE_CURSOR = 1;

async function addTitled({ stub, count }: { stub: ReturnType<typeof newProjectStub>; count: number }): Promise<void> {
  const titles = Array.from({ length: count }, (_unused, index) => `Task ${index + 1}`);
  const batches = Array.from({ length: Math.ceil(count / TASK_BATCH_MAX_SIZE) }, (_unused, index) =>
    titles.slice(index * TASK_BATCH_MAX_SIZE, (index + 1) * TASK_BATCH_MAX_SIZE),
  );
  await batches.reduce(async (previous, batch) => {
    await previous;
    unwrap(await stub.addTasks({ actor: AGENT_ACTOR, drafts: batch.map(draftOf) }));
  }, Promise.resolve());
}

describe('ProjectStore readChanges', () => {
  test('three tasks come back at cursor 0 with the cursor on the last one', async () => {
    const stub = newProjectStub();
    await addTitled({ stub, count: 3 });
    const changes = unwrap(await stub.readChanges({ cursor: 0 }));
    expect(changes.tasks.map((task) => task.number)).toEqual([1, 2, 3]);
    expect(changes.cursor).toBe(3);
    expect(changes.hasMore).toBe(false);
  });

  test('101 tasks page as 100 with more, then 1, then nothing at the same cursor', async () => {
    const stub = newProjectStub();
    await addTitled({ stub, count: CHANGE_PAGE_SIZE + 1 });
    const firstPage = unwrap(await stub.readChanges({ cursor: 0 }));
    expect(firstPage.tasks).toHaveLength(CHANGE_PAGE_SIZE);
    expect(firstPage.cursor).toBe(CHANGE_PAGE_SIZE);
    expect(firstPage.hasMore).toBe(true);
    const secondPage = unwrap(await stub.readChanges({ cursor: firstPage.cursor }));
    expect(secondPage.tasks.map((task) => task.number)).toEqual([CHANGE_PAGE_SIZE + 1]);
    expect(secondPage.cursor).toBe(CHANGE_PAGE_SIZE + 1);
    expect(secondPage.hasMore).toBe(false);
    const emptyPage = unwrap(await stub.readChanges({ cursor: secondPage.cursor }));
    expect(emptyPage).toEqual({ tasks: [], cursor: CHANGE_PAGE_SIZE + 1, hasMore: false });
  });

  test('a task updated twice after the cursor appears once, in its latest state', async () => {
    const stub = newProjectStub();
    await addTitled({ stub, count: 3 });
    unwrap(await stub.updateTask({ actor: AGENT_ACTOR, number: 1, patch: { title: 'Renamed once' } }));
    unwrap(await stub.updateTask({ actor: AGENT_ACTOR, number: 1, patch: { title: 'Renamed twice' } }));
    const changes = unwrap(await stub.readChanges({ cursor: 3 }));
    expect(changes.tasks.map((task) => ({ number: task.number, title: task.title }))).toEqual([{ number: 1, title: 'Renamed twice' }]);
    expect(changes.cursor).toBe(5);
  });

  test('a cursor above the last change number is cursor ahead', async () => {
    const stub = newProjectStub();
    await addTitled({ stub, count: 3 });
    expect(await stub.readChanges({ cursor: BEYOND_LAST_CHANGE })).toEqual({
      ok: false,
      failure: { kind: ProjectFailureKind.CursorAhead },
    });
  });

  test('a cursor on the last change number is an empty page at that cursor', async () => {
    const stub = newProjectStub();
    await addTitled({ stub, count: 3 });
    expect(unwrap(await stub.readChanges({ cursor: 3 }))).toEqual({ tasks: [], cursor: 3, hasMore: false });
  });

  test('a new store counts its last change number as 0: cursor 1 is ahead, cursor 0 is empty', async () => {
    const stub = newProjectStub();
    expect(await stub.readChanges({ cursor: NEW_STORE_CURSOR })).toEqual({ ok: false, failure: { kind: ProjectFailureKind.CursorAhead } });
    expect(unwrap(await stub.readChanges({ cursor: BEFORE_FIRST_CHANGE }))).toEqual({ tasks: [], cursor: 0, hasMore: false });
  });
});

describe('ProjectStore readHistory', () => {
  test('a task created and then completed has two entries', async () => {
    const stub = newProjectStub();
    await addTitled({ stub, count: 1 });
    unwrap(await stub.completeTasks({ actor: OWNER_ACTOR, numbers: [1], note: null }));
    const history = unwrap(await stub.readHistory({ number: 1 }));
    expect(history.map((entry) => ({ action: entry.action, actorKind: entry.actor.kind }))).toEqual([
      { action: HistoryAction.Created, actorKind: ActorKind.Agent },
      { action: HistoryAction.Completed, actorKind: ActorKind.Owner },
    ]);
    expect(history.every((entry) => entry.fields.every((field) => Object.values(TaskField).includes(field)))).toBe(true);
  });

  test('a missing number is task not found', async () => {
    const stub = newProjectStub();
    expect(await stub.readHistory({ number: MISSING_NUMBER })).toEqual({
      ok: false,
      failure: { kind: ProjectFailureKind.TaskNotFound, number: MISSING_NUMBER },
    });
  });
});
