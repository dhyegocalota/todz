import { RuleIssue } from '@todz/types';
import { describe, expect, test } from 'vitest';
import { deleteTask } from './delete-task';
import { InMemoryTaskStore } from './in-memory-task-store';
import type { Task } from './task';
import { CLOCK_NOW, captureNotFound, captureViolation, fixedClock, seedTasks } from './test-support';

const LATER = CLOCK_NOW + 60_000;
const MISSING_NUMBER = 9;

function setup() {
  const store = new InMemoryTaskStore();
  seedTasks({ store, count: 2 });
  function remove({ number, confirmation, unchangedFrom }: { number: number; confirmation: string; unchangedFrom?: Task }) {
    return deleteTask({ store, clock: fixedClock(LATER), number, confirmation, unchangedFrom });
  }
  return { store, remove };
}

describe('deleteTask', () => {
  test('a confirmation equal to the title removes the task and returns it', () => {
    const { store, remove } = setup();
    const task = store.findTask(1);
    expect(remove({ number: 1, confirmation: 'Task 1' })).toEqual(task);
    expect(store.findTask(1)).toBeNull();
    expect(store.findTask(2)).not.toBeNull();
    expect(store.removals).toEqual([{ number: 1, at: LATER }]);
  });

  test('the confirmation is trimmed before it is compared', () => {
    const { store, remove } = setup();
    remove({ number: 1, confirmation: '  Task 1 ' });
    expect(store.findTask(1)).toBeNull();
  });

  test('a confirmation that differs in case or text is ConfirmationMismatch and removes nothing', () => {
    const { store, remove } = setup();
    expect(captureViolation(() => remove({ number: 1, confirmation: 'task 1' })).issue).toBe(RuleIssue.ConfirmationMismatch);
    expect(captureViolation(() => remove({ number: 1, confirmation: 'Task 2' })).issue).toBe(RuleIssue.ConfirmationMismatch);
    expect(captureViolation(() => remove({ number: 1, confirmation: '' })).issue).toBe(RuleIssue.ConfirmationMismatch);
    expect(store.findTask(1)).not.toBeNull();
    expect(store.removals).toEqual([]);
  });

  test('a task equal to the one it was read as is removed', () => {
    const { store, remove } = setup();
    const readAs = store.findTask(1);
    if (readAs === null) throw new Error('T-1 should exist');
    remove({ number: 1, confirmation: 'Task 1', unchangedFrom: readAs });
    expect(store.findTask(1)).toBeNull();
  });

  test('a task edited since it was read is TaskChanged and removes nothing', () => {
    const { store, remove } = setup();
    const readAs = store.findTask(1);
    if (readAs === null) throw new Error('T-1 should exist');
    store.replaceTask({ ...readAs, notes: 'edited', updatedAt: readAs.updatedAt });
    expect(captureViolation(() => remove({ number: 1, confirmation: 'Task 1', unchangedFrom: readAs })).issue).toBe(RuleIssue.TaskChanged);
    expect(store.findTask(1)).not.toBeNull();
    expect(store.removals).toEqual([]);
  });

  test('a task renamed since it was read is TaskChanged, not ConfirmationMismatch', () => {
    const { store, remove } = setup();
    const readAs = store.findTask(1);
    if (readAs === null) throw new Error('T-1 should exist');
    store.replaceTask({ ...readAs, title: 'Renamed' });
    expect(captureViolation(() => remove({ number: 1, confirmation: 'Task 1', unchangedFrom: readAs })).issue).toBe(RuleIssue.TaskChanged);
  });

  test('a missing number is TaskNotFoundError', () => {
    const { remove } = setup();
    expect(captureNotFound(() => remove({ number: MISSING_NUMBER, confirmation: 'Task 9' })).number).toBe(MISSING_NUMBER);
  });

  test('an invalid number is TaskNumberInvalid', () => {
    const { remove } = setup();
    expect(captureViolation(() => remove({ number: 0, confirmation: 'Task 0' })).issue).toBe(RuleIssue.TaskNumberInvalid);
  });
});
