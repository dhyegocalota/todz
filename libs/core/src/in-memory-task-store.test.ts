import { ActorKind, HistoryAction, TaskState } from '@todz/types';
import { describe, expect, test } from 'vitest';
import { InMemoryTaskStore } from './in-memory-task-store';
import type { CalendarDate, Task } from './task';

const FIRST_TASK_NUMBER = 1;
const SECOND_TASK_NUMBER = 2;
const CLOCK_NOW = 1_795_446_000_000;

function buildTask(overrides: Partial<Task>): Task {
  return {
    number: FIRST_TASK_NUMBER,
    title: 'Fix the login',
    notes: null,
    dueDate: '2026-11-23' as CalendarDate,
    state: TaskState.Open,
    orderKey: 'a0',
    idempotencyKey: null,
    createdBy: { kind: ActorKind.Owner },
    createdAt: CLOCK_NOW,
    updatedAt: CLOCK_NOW,
    completedAt: null,
    ...overrides,
  };
}

describe('InMemoryTaskStore', () => {
  test('lastIssuedTaskNumber is null before the first task and the highest number after', () => {
    const store = new InMemoryTaskStore();
    expect(store.lastIssuedTaskNumber()).toBeNull();
    store.insertTask(buildTask({ number: SECOND_TASK_NUMBER }));
    expect(store.lastIssuedTaskNumber()).toBe(SECOND_TASK_NUMBER);
  });

  test('returned tasks are copies, so mutating one does not change the store', () => {
    const store = new InMemoryTaskStore();
    store.insertTask(buildTask({}));
    const found = store.findTask(FIRST_TASK_NUMBER);
    if (!found) throw new Error('task should exist');
    found.title = 'Changed';
    expect(store.findTask(FIRST_TASK_NUMBER)?.title).toBe('Fix the login');
  });

  test('finds a task by idempotency key and lists by state', () => {
    const store = new InMemoryTaskStore();
    store.insertTask(buildTask({ idempotencyKey: 'k1' }));
    store.insertTask(buildTask({ number: SECOND_TASK_NUMBER, state: TaskState.Done }));
    expect(store.findTaskByIdempotencyKey('k1')?.number).toBe(FIRST_TASK_NUMBER);
    expect(store.findTaskByIdempotencyKey('k2')).toBeNull();
    expect(store.listTasksInState(TaskState.Done).map((task) => task.number)).toEqual([SECOND_TASK_NUMBER]);
  });

  test('keeps the history it receives and counts every write', () => {
    const store = new InMemoryTaskStore();
    store.insertTask(buildTask({}));
    const entry = { at: CLOCK_NOW, actor: { kind: ActorKind.Owner as const }, action: HistoryAction.Created, fields: [], note: null };
    store.appendHistory({ number: FIRST_TASK_NUMBER, entry });
    expect(store.historyOf(FIRST_TASK_NUMBER)).toEqual([entry]);
    expect(store.writeCount).toBe(2);
  });
});
