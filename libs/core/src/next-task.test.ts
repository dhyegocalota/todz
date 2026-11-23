import { TaskState } from '@todz/types';
import { describe, expect, test } from 'vitest';
import { OWNER_ACTOR } from './actor';
import { addTasks } from './add-tasks';
import { InMemoryTaskStore } from './in-memory-task-store';
import { nextTask } from './next-task';
import type { TaskStore } from './ports';
import type { TaskDraft } from './task';
import { CLOCK_NOW, TODAY, fixedClock, markTaskDone } from './test-support';

function draftOf(dueDate: string | null): TaskDraft {
  return { title: 'Task', notes: null, dueDate, idempotencyKey: null };
}

function setup(dueDates: Array<string | null>) {
  const store = new InMemoryTaskStore();
  addTasks({ store, clock: fixedClock(CLOCK_NOW), actor: OWNER_ACTOR, drafts: dueDates.map(draftOf) });
  return store;
}

function nextNumber(store: InMemoryTaskStore) {
  return nextTask({ store, today: TODAY })?.number;
}

describe('nextTask', () => {
  test('an empty project has no next task', () => {
    expect(nextTask({ store: new InMemoryTaskStore(), today: TODAY })).toBeNull();
  });

  test('a project with only done tasks has no next task', () => {
    const store = setup([null, '2026-11-23']);
    markTaskDone({ store, number: 1 });
    markTaskDone({ store, number: 2 });
    expect(nextTask({ store, today: TODAY })).toBeNull();
  });

  test('overdue wins over due today, undated and upcoming even with the last order key', () => {
    const store = setup(['2026-11-23', null, '2026-11-25', '2026-11-20']);
    expect(nextNumber(store)).toBe(4);
  });

  test('two tasks due today go by order key', () => {
    const store = setup([null, '2026-11-23', '2026-11-23']);
    expect(nextNumber(store)).toBe(2);
  });

  test('the earliest due date wins among overdue and due today, whatever the order key', () => {
    const store = setup(['2026-11-23', '2026-11-21', '2026-11-22']);
    expect(nextNumber(store)).toBe(2);
  });

  test('with only undated and upcoming, the undated task with the lowest order key wins', () => {
    const store = setup(['2026-11-24', null, null]);
    expect(nextNumber(store)).toBe(2);
  });

  test('with only upcoming tasks, the earliest due date wins', () => {
    const store = setup(['2026-11-30', '2026-11-25']);
    expect(nextNumber(store)).toBe(2);
  });

  test('does not reorder the array the store returned (pin)', () => {
    const store = setup(['2026-11-30', null, '2026-11-20']);
    const openTasks = store.listTasksInState(TaskState.Open);
    const numbersBefore = openTasks.map((task) => task.number);
    const sharingStore: TaskStore = Object.assign(Object.create(store), { listTasksInState: () => openTasks });
    nextTask({ store: sharingStore, today: TODAY });
    expect(openTasks.map((task) => task.number)).toEqual(numbersBefore);
  });

  test('done tasks are never next', () => {
    const store = setup(['2026-11-20', null]);
    markTaskDone({ store, number: 1 });
    expect(nextNumber(store)).toBe(2);
    expect(nextTask({ store, today: TODAY })?.state).toBe(TaskState.Open);
  });
});
