import { HistoryAction, RuleIssue, TASK_BATCH_MAX_SIZE, TaskState } from '@todz/types';
import { describe, expect, test } from 'vitest';
import { OWNER_ACTOR } from './actor';
import { InMemoryTaskStore } from './in-memory-task-store';
import { reopenTasks } from './reopen-tasks';
import { CLOCK_NOW, captureNotFound, captureViolation, fixedClock, markTaskDone, seedTasks } from './test-support';

const LATER = CLOCK_NOW + 60_000;
const MISSING_NUMBER = 9;
const SECOND_INDEX = 1;

function setup(taskCount: number) {
  const store = new InMemoryTaskStore();
  seedTasks({ store, count: taskCount });
  function reopen(numbers: number[]) {
    return reopenTasks({ store, clock: fixedClock(LATER), actor: OWNER_ACTOR, numbers });
  }
  return { store, reopen };
}

describe('reopenTasks', () => {
  test('a done task becomes open, clears completedAt, keeps its order key and gets one Reopened line', () => {
    const { store, reopen } = setup(1);
    const keyBefore = store.findTask(1)?.orderKey;
    markTaskDone({ store, number: 1 });
    const [result] = reopen([1]);
    expect(result?.alreadyOpen).toBe(false);
    expect(result?.task).toMatchObject({ state: TaskState.Open, completedAt: null, orderKey: keyBefore, updatedAt: LATER });
    expect(store.findTask(1)).toEqual(result?.task);
    expect(store.historyOf(1).at(-1)).toEqual({
      at: LATER,
      actor: OWNER_ACTOR,
      action: HistoryAction.Reopened,
      fields: [],
      note: null,
    });
  });

  test('an open task is returned untouched with alreadyOpen and no write', () => {
    const { store, reopen } = setup(1);
    const writesBefore = store.writeCount;
    const [result] = reopen([1]);
    expect(result).toEqual({ task: store.findTask(1), alreadyOpen: true });
    expect(store.writeCount).toBe(writesBefore);
  });

  test('duplicates collapse in first-seen order', () => {
    const { store, reopen } = setup(2);
    markTaskDone({ store, number: 1 });
    markTaskDone({ store, number: 2 });
    expect(reopen([2, 1, 2]).map((result) => result.task.number)).toEqual([2, 1]);
  });

  test('a missing number is TaskNotFoundError and nothing is written', () => {
    const { store, reopen } = setup(1);
    markTaskDone({ store, number: 1 });
    const writesBefore = store.writeCount;
    expect(captureNotFound(() => reopen([1, MISSING_NUMBER])).number).toBe(MISSING_NUMBER);
    expect(store.findTask(1)?.state).toBe(TaskState.Done);
    expect(store.writeCount).toBe(writesBefore);
  });

  test('an invalid number is TaskNumberInvalid at its position', () => {
    const { reopen } = setup(1);
    const violation = captureViolation(() => reopen([1, 0]));
    expect(violation.issue).toBe(RuleIssue.TaskNumberInvalid);
    expect(violation.index).toBe(SECOND_INDEX);
  });

  test('an empty batch is BatchEmpty and an oversized one BatchTooLarge', () => {
    const { reopen } = setup(1);
    const numbers = Array.from({ length: TASK_BATCH_MAX_SIZE + 1 }, (_, index) => index + 1);
    expect(captureViolation(() => reopen([])).issue).toBe(RuleIssue.BatchEmpty);
    expect(captureViolation(() => reopen(numbers)).issue).toBe(RuleIssue.BatchTooLarge);
  });
});
