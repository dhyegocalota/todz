import { describe, expect, test } from 'vitest';
import { OWNER_ACTOR } from './actor';
import { addTasks } from './add-tasks';
import { dueNow } from './due-now';
import { InMemoryTaskStore } from './in-memory-task-store';
import { CLOCK_NOW, TODAY, fixedClock, markTaskDone } from './test-support';

function setup(dueDates: Array<string | null>) {
  const store = new InMemoryTaskStore();
  addTasks({
    store,
    clock: fixedClock(CLOCK_NOW),
    actor: OWNER_ACTOR,
    drafts: dueDates.map((dueDate) => ({ title: 'Task', notes: null, dueDate, idempotencyKey: null })),
  });
  return store;
}

describe('dueNow', () => {
  test('a project with no open tasks has nothing due', () => {
    expect(dueNow({ store: new InMemoryTaskStore(), today: TODAY })).toEqual({ count: 0, overdue: 0 });
  });

  test('one task due today counts once and is not overdue', () => {
    expect(dueNow({ store: setup(['2026-11-23']), today: TODAY })).toEqual({ count: 1, overdue: 0 });
  });

  test('an overdue task and one due today count together', () => {
    expect(dueNow({ store: setup(['2026-11-20', '2026-11-23']), today: TODAY })).toEqual({ count: 2, overdue: 1 });
  });

  test('two overdue tasks are all overdue', () => {
    expect(dueNow({ store: setup(['2026-11-20', '2026-11-22']), today: TODAY })).toEqual({ count: 2, overdue: 2 });
  });

  test('upcoming, undated and done tasks never count', () => {
    const store = setup(['2026-11-24', null, '2026-11-23', '2026-11-20']);
    markTaskDone({ store, number: 3 });
    markTaskDone({ store, number: 4 });
    expect(dueNow({ store, today: TODAY })).toEqual({ count: 0, overdue: 0 });
  });
});
