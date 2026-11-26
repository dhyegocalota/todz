import { type Actor, type TaskDraft } from '@todz/core';
import { ActorKind, DueWindow, PROJECT_OPEN_TASKS_MAX, RuleIssue, TASK_BATCH_MAX_SIZE, TaskPlacement, TaskState } from '@todz/types';
import { runInDurableObject } from 'cloudflare:test';
import { describe, expect, test } from 'vitest';
import { ProjectFailureKind, type ProjectResult } from '../src/project-result';
import type { ProjectStore } from '../src/project-store';
import { AGENT_ACTOR, TODAY, draftOf, execInside, newProjectStub, openTasksFilter, rejectionMessageOf, unwrap } from './task-fixtures';

const MISSING_NUMBER = 9;
const INVALID_TASK_NUMBER = 0;
const INVALID_LIMIT = 0;
const INVALID_TODAY = '2026-13-01';
const COMPLETION_NOTE = 'shipped';
type StoreCounts = { tasks: number; counter: Record<string, SqlStorageValue>[]; history: number };

const UNMAPPED_ROW_MESSAGE = 'tasks.created_by_client of task 1 is not valid';

function ruleViolated({ issue, index }: { issue: RuleIssue; index: number | null }): ProjectResult<never> {
  return { ok: false, failure: { kind: ProjectFailureKind.RuleViolated, issue, index } };
}

function taskNotFound(number: number): ProjectResult<never> {
  return { ok: false, failure: { kind: ProjectFailureKind.TaskNotFound, number } };
}

async function openTaskCount(stub: ReturnType<typeof newProjectStub>): Promise<number> {
  return unwrap(await stub.listTasks({ today: TODAY, filter: openTasksFilter() })).totalMatched;
}

async function seededStub(...titles: string[]): Promise<ReturnType<typeof newProjectStub>> {
  const stub = newProjectStub();
  unwrap(await stub.addTasks({ openTasksMax: PROJECT_OPEN_TASKS_MAX, actor: AGENT_ACTOR, drafts: titles.map(draftOf) }));
  return stub;
}

describe('ProjectStore addTasks', () => {
  test('two drafts by the agent become T-1 and T-2 and are listed', async () => {
    const stub = newProjectStub();
    const added = unwrap(
      await stub.addTasks({ openTasksMax: PROJECT_OPEN_TASKS_MAX, actor: AGENT_ACTOR, drafts: [draftOf('First'), draftOf('Second')] }),
    );
    expect(added.map(({ task, replayed }) => ({ number: task.number, replayed }))).toEqual([
      { number: 1, replayed: false },
      { number: 2, replayed: false },
    ]);
    const listed = unwrap(await stub.listTasks({ today: TODAY, filter: openTasksFilter() }));
    expect(listed.tasks.map((task) => task.number)).toEqual([1, 2]);
    expect(listed.totalMatched).toBe(2);
  });

  test('the same idempotency key replays the first task and adds nothing', async () => {
    const stub = newProjectStub();
    const draft: TaskDraft = { ...draftOf('Once'), idempotencyKey: 'run-1' };
    const first = unwrap(await stub.addTasks({ openTasksMax: PROJECT_OPEN_TASKS_MAX, actor: AGENT_ACTOR, drafts: [draft] }));
    const replay = unwrap(await stub.addTasks({ openTasksMax: PROJECT_OPEN_TASKS_MAX, actor: AGENT_ACTOR, drafts: [draft] }));
    expect(replay).toEqual([{ task: first[0]?.task, replayed: true }]);
    expect(await openTaskCount(stub)).toBe(1);
  });

  test('a blank third title fails at index 2 and nothing is written', async () => {
    const stub = newProjectStub();
    const result = await stub.addTasks({
      openTasksMax: PROJECT_OPEN_TASKS_MAX,
      actor: AGENT_ACTOR,
      drafts: [draftOf('One'), draftOf('Two'), draftOf('  ')],
    });
    expect(result).toEqual(ruleViolated({ issue: RuleIssue.TitleEmpty, index: 2 }));
    expect(await openTaskCount(stub)).toBe(0);
  });

  test('more than the batch limit fails without an index', async () => {
    const stub = newProjectStub();
    const drafts = Array.from({ length: TASK_BATCH_MAX_SIZE + 1 }, (_, index) => draftOf(`Task ${index}`));
    expect(await stub.addTasks({ openTasksMax: PROJECT_OPEN_TASKS_MAX, actor: AGENT_ACTOR, drafts })).toEqual(
      ruleViolated({ issue: RuleIssue.BatchTooLarge, index: null }),
    );
  });

  test('a failure carries neither a title nor a note', async () => {
    const stub = newProjectStub();
    const secretDraft: TaskDraft = { ...draftOf('B secret alpha'), notes: 'B notes' };
    const result = await stub.addTasks({ openTasksMax: PROJECT_OPEN_TASKS_MAX, actor: AGENT_ACTOR, drafts: [secretDraft, draftOf('')] });
    expect(result.ok).toBe(false);
    expect(JSON.stringify(result)).not.toContain('secret');
    expect(JSON.stringify(result)).not.toContain('notes');
  });
});

describe('ProjectStore updateTask', () => {
  test('a new title is stored and returned', async () => {
    const stub = await seededStub('Old');
    const task = unwrap(await stub.updateTask({ actor: AGENT_ACTOR, number: 1, patch: { title: 'New' } }));
    expect(task.title).toBe('New');
  });

  test('a missing task fails as not found', async () => {
    const stub = await seededStub('Old');
    expect(await stub.updateTask({ actor: AGENT_ACTOR, number: MISSING_NUMBER, patch: { title: 'New' } })).toEqual(
      taskNotFound(MISSING_NUMBER),
    );
  });

  test('task number 0 fails as an invalid number', async () => {
    const stub = await seededStub('Old');
    expect(await stub.updateTask({ actor: AGENT_ACTOR, number: INVALID_TASK_NUMBER, patch: { title: 'New' } })).toEqual(
      ruleViolated({ issue: RuleIssue.TaskNumberInvalid, index: null }),
    );
  });

  test('a placement anchor that does not exist fails as not found', async () => {
    const stub = await seededStub('One');
    const patch = { placement: { kind: TaskPlacement.After, anchor: MISSING_NUMBER } };
    expect(await stub.updateTask({ actor: AGENT_ACTOR, number: 1, patch })).toEqual(taskNotFound(MISSING_NUMBER));
  });
});

describe('ProjectStore completeTasks and reopenTasks', () => {
  test('completing two tasks marks both done, and completing one again says it was already done', async () => {
    const stub = await seededStub('One', 'Two');
    const completed = unwrap(await stub.completeTasks({ actor: AGENT_ACTOR, numbers: [1, 2], note: COMPLETION_NOTE }));
    expect(completed.map(({ task, alreadyDone }) => ({ state: task.state, alreadyDone }))).toEqual([
      { state: TaskState.Done, alreadyDone: false },
      { state: TaskState.Done, alreadyDone: false },
    ]);
    const again = unwrap(await stub.completeTasks({ actor: AGENT_ACTOR, numbers: [1], note: null }));
    expect(again.map(({ alreadyDone }) => alreadyDone)).toEqual([true]);
  });

  test('a missing number fails the whole batch and leaves the other task open', async () => {
    const stub = await seededStub('One');
    expect(await stub.completeTasks({ actor: AGENT_ACTOR, numbers: [1, MISSING_NUMBER], note: null })).toEqual(
      taskNotFound(MISSING_NUMBER),
    );
    expect(await openTaskCount(stub)).toBe(1);
  });

  test('reopening a completed task opens it and clears its completion', async () => {
    const stub = await seededStub('One');
    unwrap(await stub.completeTasks({ actor: AGENT_ACTOR, numbers: [1], note: null }));
    const reopened = unwrap(await stub.reopenTasks({ openTasksMax: PROJECT_OPEN_TASKS_MAX, actor: AGENT_ACTOR, numbers: [1] }));
    expect(reopened.map(({ task, alreadyOpen }) => ({ state: task.state, completedAt: task.completedAt, alreadyOpen }))).toEqual([
      { state: TaskState.Open, completedAt: null, alreadyOpen: false },
    ]);
  });
});

describe('ProjectStore reads', () => {
  test('nextTask prefers the task due today over an undated one', async () => {
    const stub = newProjectStub();
    const dueToday: TaskDraft = { ...draftOf('Due today'), dueDate: TODAY };
    unwrap(await stub.addTasks({ openTasksMax: PROJECT_OPEN_TASKS_MAX, actor: AGENT_ACTOR, drafts: [draftOf('Undated'), dueToday] }));
    const next = unwrap(await stub.nextTask({ today: TODAY }));
    expect(next?.number).toBe(2);
  });

  test('nextTask on an empty project is ok with a null value', async () => {
    expect(await newProjectStub().nextTask({ today: TODAY })).toEqual({ ok: true, value: null });
  });

  test('a limit of 0 fails as an invalid limit', async () => {
    const filter = { state: TaskState.Open, dueWindows: [DueWindow.Today], text: null, limit: INVALID_LIMIT };
    expect(await newProjectStub().listTasks({ today: TODAY, filter })).toEqual(
      ruleViolated({ issue: RuleIssue.LimitInvalid, index: null }),
    );
  });

  test.each([
    { name: 'listTasks', call: (instance: ProjectStore) => instance.listTasks({ today: INVALID_TODAY, filter: openTasksFilter() }) },
    { name: 'nextTask', call: (instance: ProjectStore) => instance.nextTask({ today: INVALID_TODAY }) },
  ])('$name throws for a today that is not a calendar date', async ({ call }) => {
    expect(await rejectionMessageOf({ stub: newProjectStub(), call })).toBe('today is not a calendar date');
  });
});

describe('ProjectStore actors', () => {
  test('an agent whose client name is empty fails and nothing is written', async () => {
    const stub = newProjectStub();
    const actor: Actor = { kind: ActorKind.Agent, clientName: '' };
    expect(await stub.addTasks({ openTasksMax: PROJECT_OPEN_TASKS_MAX, actor, drafts: [draftOf('One')] })).toEqual(
      ruleViolated({ issue: RuleIssue.ClientNameInvalid, index: null }),
    );
    expect(await openTaskCount(stub)).toBe(0);
  });

  test('an actor of an unknown kind throws', async () => {
    const actor = { kind: 'robot' } as unknown as Actor;
    const message = await rejectionMessageOf({
      stub: newProjectStub(),
      call: (instance) => instance.addTasks({ openTasksMax: PROJECT_OPEN_TASKS_MAX, actor, drafts: [draftOf('One')] }),
    });
    expect(message).toBe('the actor kind is not known');
  });
});

describe('ProjectStore when the store fails', () => {
  async function counts(stub: ReturnType<typeof newProjectStub>): Promise<StoreCounts> {
    return runInDurableObject(stub, (_instance, state) => ({
      tasks: state.storage.sql.exec('SELECT number FROM tasks').toArray().length,
      counter: state.storage.sql.exec('SELECT last_issued_number FROM task_counter').toArray(),
      history: state.storage.sql.exec('SELECT id FROM task_history').toArray().length,
    }));
  }

  test('a row that does not map throws from the reads and the write', async () => {
    const stub = await seededStub('One');
    await execInside({ stub, statement: "UPDATE tasks SET created_by_kind = 'agent', created_by_client = NULL" });
    const readMessage = await rejectionMessageOf({
      stub,
      call: (instance) => instance.listTasks({ today: TODAY, filter: openTasksFilter() }),
    });
    const writeMessage = await rejectionMessageOf({
      stub,
      call: (instance) => instance.completeTasks({ actor: AGENT_ACTOR, numbers: [1], note: null }),
    });
    expect(readMessage).toBe(UNMAPPED_ROW_MESSAGE);
    expect(writeMessage).toBe(UNMAPPED_ROW_MESSAGE);
  });

  test('a failure after the task row is written rolls the whole call back', async () => {
    const stub = await seededStub('One');
    const before = await counts(stub);
    await execInside({
      stub,
      statement: "CREATE TRIGGER refuse_history BEFORE INSERT ON task_history BEGIN SELECT RAISE(ABORT, 'refused'); END",
    });
    const message = await rejectionMessageOf({
      stub,
      call: (instance) => instance.addTasks({ openTasksMax: PROJECT_OPEN_TASKS_MAX, actor: AGENT_ACTOR, drafts: [draftOf('Two')] }),
    });
    expect(message).toContain('refused');
    expect(await counts(stub)).toEqual(before);
  });
});
