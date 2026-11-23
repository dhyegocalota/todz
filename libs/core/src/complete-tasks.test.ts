import { COMPLETION_NOTE_MAX_LENGTH, HistoryAction, RuleIssue, TASK_BATCH_MAX_SIZE, TaskState } from '@todz/types';
import { describe, expect, test } from 'vitest';
import { OWNER_ACTOR } from './actor';
import { completeTasks } from './complete-tasks';
import { InMemoryTaskStore } from './in-memory-task-store';
import { CLOCK_NOW, captureNotFound, captureViolation, fixedClock, markTaskDone, seedTasks } from './test-support';

const SENTINEL = 'SENTINEL-CONTENT';
const LATER = CLOCK_NOW + 60_000;
const MISSING_NUMBER = 9;
const THIRD_INDEX = 2;

function setup(taskCount: number) {
  const store = new InMemoryTaskStore();
  seedTasks({ store, count: taskCount });
  function complete({ numbers, note = null }: { numbers: number[]; note?: string | null }) {
    return completeTasks({ store, clock: fixedClock(LATER), actor: OWNER_ACTOR, numbers, note });
  }
  return { store, complete };
}

describe('completeTasks', () => {
  test('completes every task and records the note on each Completed line', () => {
    const { store, complete } = setup(2);
    const results = complete({ numbers: [1, 2], note: 'shipped in #4' });
    expect(results.map((result) => result.alreadyDone)).toEqual([false, false]);
    expect(results.map((result) => result.task.state)).toEqual([TaskState.Done, TaskState.Done]);
    expect(results.map((result) => result.task.completedAt)).toEqual([LATER, LATER]);
    expect(results.map((result) => result.task.updatedAt)).toEqual([LATER, LATER]);
    expect(store.findTask(1)?.state).toBe(TaskState.Done);
    expect(store.historyOf(1).at(-1)).toEqual({
      at: LATER,
      actor: OWNER_ACTOR,
      action: HistoryAction.Completed,
      fields: [],
      note: 'shipped in #4',
    });
    expect(store.historyOf(2).at(-1)?.note).toBe('shipped in #4');
  });

  test('keeps the order key of a completed task', () => {
    const { store, complete } = setup(1);
    const keyBefore = store.findTask(1)?.orderKey;
    complete({ numbers: [1] });
    expect(store.findTask(1)?.orderKey).toBe(keyBefore);
  });

  test('an already done task is returned untouched, with no new line, even with a note', () => {
    const { store, complete } = setup(1);
    markTaskDone({ store, number: 1 });
    const writesBefore = store.writeCount;
    const [result] = complete({ numbers: [1], note: 'again' });
    expect(result).toEqual({ task: store.findTask(1), alreadyDone: true });
    expect(result?.task.completedAt).toBe(CLOCK_NOW);
    expect(store.historyOf(1)).toHaveLength(1);
    expect(store.writeCount).toBe(writesBefore);
  });

  test('duplicates collapse in first-seen order', () => {
    const { store, complete } = setup(2);
    const results = complete({ numbers: [2, 1, 2] });
    expect(results.map((result) => result.task.number)).toEqual([2, 1]);
    expect(store.historyOf(2)).toHaveLength(2);
  });

  test('a missing number is TaskNotFoundError and nothing is written', () => {
    const { store, complete } = setup(1);
    const writesBefore = store.writeCount;
    const notFound = captureNotFound(() => complete({ numbers: [1, MISSING_NUMBER] }));
    expect(notFound.number).toBe(MISSING_NUMBER);
    expect(store.findTask(1)?.state).toBe(TaskState.Open);
    expect(store.writeCount).toBe(writesBefore);
  });

  test('an invalid number is TaskNumberInvalid at its position in the original batch', () => {
    const { store, complete } = setup(2);
    const violation = captureViolation(() => complete({ numbers: [2, 2, -1] }));
    expect(violation.issue).toBe(RuleIssue.TaskNumberInvalid);
    expect(violation.index).toBe(THIRD_INDEX);
    expect(store.findTask(2)?.state).toBe(TaskState.Open);
  });

  test.each([0, 1.5, Number.NaN])('the number %j is TaskNumberInvalid', (number) => {
    const { complete } = setup(1);
    expect(captureViolation(() => complete({ numbers: [number] })).issue).toBe(RuleIssue.TaskNumberInvalid);
  });

  test('an empty batch is BatchEmpty', () => {
    const { complete } = setup(1);
    expect(captureViolation(() => complete({ numbers: [] })).issue).toBe(RuleIssue.BatchEmpty);
  });

  test('a batch over the maximum is BatchTooLarge', () => {
    const { complete } = setup(1);
    const numbers = Array.from({ length: TASK_BATCH_MAX_SIZE + 1 }, (_, index) => index + 1);
    expect(captureViolation(() => complete({ numbers })).issue).toBe(RuleIssue.BatchTooLarge);
  });

  test('a note over the limit is CompletionNoteTooLong, without its text, and nothing is written', () => {
    const { store, complete } = setup(1);
    const writesBefore = store.writeCount;
    const violation = captureViolation(() => complete({ numbers: [1], note: `${SENTINEL}${'a'.repeat(COMPLETION_NOTE_MAX_LENGTH)}` }));
    expect(violation.issue).toBe(RuleIssue.CompletionNoteTooLong);
    expect(violation.message).not.toContain(SENTINEL);
    expect(store.writeCount).toBe(writesBefore);
  });

  test('a blank note is recorded as no note', () => {
    const { store, complete } = setup(1);
    complete({ numbers: [1], note: '  ' });
    expect(store.historyOf(1).at(-1)?.note).toBeNull();
  });

  test('reads the clock once', () => {
    const { store } = setup(2);
    let readCount = 0;
    const clock = {
      now: () => {
        readCount += 1;
        return LATER;
      },
    };
    completeTasks({ store, clock, actor: OWNER_ACTOR, numbers: [1, 2], note: null });
    expect(readCount).toBe(1);
  });
});
