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

  describe('the order key reads', () => {
    const NO_EXCLUDED_NUMBER = 0;
    const KEY_ABSENT_FROM_STORE = 'a3V';

    function storeOfTasks(count: number): InMemoryTaskStore {
      const store = new InMemoryTaskStore();
      Array.from({ length: count }, (_unused, index) => index + 1).forEach((number) =>
        store.insertTask(buildTask({ number, orderKey: `a${number}`, state: number % 2 === 0 ? TaskState.Done : TaskState.Open })),
      );
      return store;
    }

    test('on an empty store every read answers null', () => {
      const store = storeOfTasks(0);
      expect(store.firstOrderKey({ excludingNumber: NO_EXCLUDED_NUMBER })).toBeNull();
      expect(store.lastOrderKey({ excludingNumber: NO_EXCLUDED_NUMBER })).toBeNull();
      expect(store.orderKeyBefore({ orderKey: 'a1', excludingNumber: NO_EXCLUDED_NUMBER })).toBeNull();
      expect(store.orderKeyAfter({ orderKey: 'a1', excludingNumber: NO_EXCLUDED_NUMBER })).toBeNull();
    });

    test('on one task the first and the last are its key until it is excluded, and it has no neighbour', () => {
      const store = storeOfTasks(1);
      expect(store.firstOrderKey({ excludingNumber: NO_EXCLUDED_NUMBER })).toBe('a1');
      expect(store.lastOrderKey({ excludingNumber: NO_EXCLUDED_NUMBER })).toBe('a1');
      expect(store.firstOrderKey({ excludingNumber: FIRST_TASK_NUMBER })).toBeNull();
      expect(store.lastOrderKey({ excludingNumber: FIRST_TASK_NUMBER })).toBeNull();
      expect(store.orderKeyBefore({ orderKey: 'a1', excludingNumber: NO_EXCLUDED_NUMBER })).toBeNull();
      expect(store.orderKeyAfter({ orderKey: 'a1', excludingNumber: NO_EXCLUDED_NUMBER })).toBeNull();
      expect(store.orderKeyBefore({ orderKey: 'a2', excludingNumber: NO_EXCLUDED_NUMBER })).toBe('a1');
      expect(store.orderKeyAfter({ orderKey: 'a0', excludingNumber: NO_EXCLUDED_NUMBER })).toBe('a1');
    });

    test('on five tasks, open and done mixed, the first and the last are the smallest and the largest key of either state', () => {
      const store = storeOfTasks(5);
      expect(store.firstOrderKey({ excludingNumber: NO_EXCLUDED_NUMBER })).toBe('a1');
      expect(store.lastOrderKey({ excludingNumber: NO_EXCLUDED_NUMBER })).toBe('a5');
    });

    test('excluding the first task the first read gives the second, and excluding the last the last read gives the fourth', () => {
      const store = storeOfTasks(5);
      expect(store.firstOrderKey({ excludingNumber: 1 })).toBe('a2');
      expect(store.lastOrderKey({ excludingNumber: 5 })).toBe('a4');
      expect(store.firstOrderKey({ excludingNumber: 3 })).toBe('a1');
      expect(store.lastOrderKey({ excludingNumber: 3 })).toBe('a5');
    });

    test('the neighbour before a key is the largest smaller key and the neighbour after the smallest larger one', () => {
      const store = storeOfTasks(5);
      expect(store.orderKeyBefore({ orderKey: 'a3', excludingNumber: NO_EXCLUDED_NUMBER })).toBe('a2');
      expect(store.orderKeyAfter({ orderKey: 'a3', excludingNumber: NO_EXCLUDED_NUMBER })).toBe('a4');
      expect(store.orderKeyBefore({ orderKey: 'a1', excludingNumber: NO_EXCLUDED_NUMBER })).toBeNull();
      expect(store.orderKeyAfter({ orderKey: 'a5', excludingNumber: NO_EXCLUDED_NUMBER })).toBeNull();
      expect(store.orderKeyBefore({ orderKey: KEY_ABSENT_FROM_STORE, excludingNumber: NO_EXCLUDED_NUMBER })).toBe('a3');
      expect(store.orderKeyAfter({ orderKey: KEY_ABSENT_FROM_STORE, excludingNumber: NO_EXCLUDED_NUMBER })).toBe('a4');
    });

    test('a neighbour read skips the excluded task', () => {
      const store = storeOfTasks(5);
      expect(store.orderKeyBefore({ orderKey: 'a3', excludingNumber: 2 })).toBe('a1');
      expect(store.orderKeyAfter({ orderKey: 'a3', excludingNumber: 4 })).toBe('a5');
      expect(store.orderKeyBefore({ orderKey: 'a2', excludingNumber: 1 })).toBeNull();
      expect(store.orderKeyAfter({ orderKey: 'a4', excludingNumber: 5 })).toBeNull();
    });
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
