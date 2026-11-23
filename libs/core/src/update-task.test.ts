import { HistoryAction, ORDER_KEY_MAX_LENGTH, RuleIssue, TASK_TITLE_MAX_LENGTH, TaskField, TaskPlacement, TaskState } from '@todz/types';
import { describe, expect, test } from 'vitest';
import { OWNER_ACTOR, agentActor } from './actor';
import { InMemoryTaskStore } from './in-memory-task-store';
import type { Task, TaskPatch } from './task';
import { CLOCK_NOW, captureNotFound, captureViolation, fixedClock, markTaskDone, seedTasks } from './test-support';
import { updateTask } from './update-task';

const SENTINEL = 'SENTINEL-CONTENT';
const LATER = CLOCK_NOW + 60_000;
const MISSING_NUMBER = 9;
const NOTES_LIMIT_OVERFLOW = 20_001;
const CLAUDE_CODE = 'Claude Code';
const LARGE_PROJECT_SIZE = 300;
const MIDDLE_TASK = 150;

function setup(taskCount: number) {
  const store = new InMemoryTaskStore();
  seedTasks({ store, count: taskCount });
  function update({ number, patch }: { number: number; patch: TaskPatch }) {
    return updateTask({ store, clock: fixedClock(LATER), actor: OWNER_ACTOR, number, patch });
  }
  function markDone(number: number) {
    markTaskDone({ store, number });
  }
  function orderOf(state: TaskState) {
    return store
      .listTasksInState(state)
      .sort((left, right) => (left.orderKey < right.orderKey ? -1 : 1))
      .map((task) => task.number);
  }
  function keyOf(number: number) {
    const task = store.findTask(number);
    if (!task) throw new Error(`T-${number} should exist`);
    return task.orderKey;
  }
  return { store, update, markDone, orderOf, keyOf };
}

function setKey({ store, number, orderKey }: { store: InMemoryTaskStore; number: number; orderKey: string }) {
  const task = store.findTask(number);
  if (!task) throw new Error(`T-${number} should exist`);
  store.replaceTask({ ...task, orderKey });
}

function expectNoWrite({ store, run }: { store: InMemoryTaskStore; run: () => unknown }) {
  const writesBefore = store.writeCount;
  run();
  expect(store.writeCount).toBe(writesBefore);
}

describe('updateTask fields', () => {
  test('a title change returns the new title, stamps updatedAt and writes one Updated line', () => {
    const { store, update } = setup(1);
    const updated = update({ number: 1, patch: { title: 'New title' } });
    expect(updated.title).toBe('New title');
    expect(updated.updatedAt).toBe(LATER);
    expect(updated.createdAt).toBe(CLOCK_NOW);
    expect(store.findTask(1)).toEqual(updated);
    expect(store.historyOf(1).at(-1)).toEqual({
      at: LATER,
      actor: OWNER_ACTOR,
      action: HistoryAction.Updated,
      fields: [TaskField.Title],
      note: null,
    });
    expect(store.historyOf(1)).toHaveLength(2);
  });

  test('records the acting agent in the history line', () => {
    const { store } = setup(1);
    const actor = agentActor(CLAUDE_CODE);
    updateTask({ store, clock: fixedClock(LATER), actor, number: 1, patch: { title: 'By agent' } });
    expect(store.historyOf(1).at(-1)?.actor).toEqual(actor);
  });

  test('title, notes and due date in one patch write one line listing the fields in order', () => {
    const { store, update } = setup(1);
    const updated = update({ number: 1, patch: { dueDate: '2026-12-01', notes: 'Notes', title: 'Changed' } });
    expect(updated).toMatchObject({ title: 'Changed', notes: 'Notes', dueDate: '2026-12-01' });
    expect(store.historyOf(1)).toHaveLength(2);
    expect(store.historyOf(1).at(-1)?.fields).toEqual([TaskField.Title, TaskField.Notes, TaskField.DueDate]);
  });

  test('null notes and null due date clear the fields', () => {
    const { update } = setup(1);
    update({ number: 1, patch: { notes: 'Notes', dueDate: '2026-12-01' } });
    const cleared = update({ number: 1, patch: { notes: null, dueDate: null } });
    expect(cleared.notes).toBeNull();
    expect(cleared.dueDate).toBeNull();
  });

  test('a patch whose values equal the current ones changes nothing and writes nothing', () => {
    const { store, update } = setup(1);
    const before = store.findTask(1);
    expectNoWrite({ store, run: () => update({ number: 1, patch: { title: 'Task 1', notes: null, dueDate: null } }) });
    expect(store.findTask(1)).toEqual(before);
    expect(store.historyOf(1)).toHaveLength(1);
  });

  test('a title that normalizes to the current one writes nothing', () => {
    const { store, update } = setup(1);
    expectNoWrite({ store, run: () => update({ number: 1, patch: { title: '  Task   1 ' } }) });
    expect(store.historyOf(1)).toHaveLength(1);
  });

  test('updating a done task keeps it done', () => {
    const { store, update, markDone } = setup(1);
    markDone(1);
    const updated = update({ number: 1, patch: { title: 'Renamed' } });
    expect(updated.state).toBe(TaskState.Done);
    expect(updated.completedAt).toBe(CLOCK_NOW);
    expect(store.findTask(1)?.title).toBe('Renamed');
  });

  test.each([
    { name: 'a blank title', patch: { title: '  ' }, issue: RuleIssue.TitleEmpty },
    { name: 'an impossible due date', patch: { dueDate: '2026-02-30' }, issue: RuleIssue.DueDateInvalid },
    { name: 'notes over the limit', patch: { notes: 'a'.repeat(NOTES_LIMIT_OVERFLOW) }, issue: RuleIssue.NotesTooLong },
    { name: 'a title over the limit', patch: { title: 'a'.repeat(TASK_TITLE_MAX_LENGTH + 1) }, issue: RuleIssue.TitleTooLong },
  ])('$name is $issue and nothing is written', ({ patch, issue }) => {
    const { store, update } = setup(1);
    const writesBefore = store.writeCount;
    expect(captureViolation(() => update({ number: 1, patch })).issue).toBe(issue);
    expect(store.writeCount).toBe(writesBefore);
  });

  test('a violation holds the issue only, never the notes', () => {
    const { update } = setup(1);
    const violation = captureViolation(() => update({ number: 1, patch: { notes: `${SENTINEL}${'a'.repeat(NOTES_LIMIT_OVERFLOW)}` } }));
    expect(violation.message).not.toContain(SENTINEL);
  });

  test('an empty patch is NothingToUpdate', () => {
    const { update } = setup(1);
    expect(captureViolation(() => update({ number: 1, patch: {} })).issue).toBe(RuleIssue.NothingToUpdate);
  });

  test('a missing task is TaskNotFoundError with its number', () => {
    const { update } = setup(1);
    const notFound = captureNotFound(() => update({ number: MISSING_NUMBER, patch: { title: 'x' } }));
    expect(notFound.number).toBe(MISSING_NUMBER);
    expect(notFound.message).toBe('T-9');
  });

  test('reads the clock once', () => {
    const { store } = setup(1);
    let readCount = 0;
    const clock = {
      now: () => {
        readCount += 1;
        return LATER;
      },
    };
    updateTask({ store, clock, actor: OWNER_ACTOR, number: 1, patch: { title: 'A', notes: 'B' } });
    expect(readCount).toBe(1);
  });
});

describe('updateTask placement', () => {
  test.each([
    { name: 'T-3 Before T-1', number: 3, placement: { kind: TaskPlacement.Before, anchor: 1 } as const, expected: [3, 1, 2] },
    { name: 'T-3 After T-1', number: 3, placement: { kind: TaskPlacement.After, anchor: 1 } as const, expected: [1, 3, 2] },
    { name: 'T-3 First', number: 3, placement: { kind: TaskPlacement.First } as const, expected: [3, 1, 2] },
    { name: 'T-1 Last', number: 1, placement: { kind: TaskPlacement.Last } as const, expected: [2, 3, 1] },
  ])('moving $name gives the open order $expected', ({ placement, expected, number }) => {
    const { store, update, orderOf } = setup(3);
    update({ number, patch: { placement } });
    expect(orderOf(TaskState.Open)).toEqual(expected);
    expect(store.historyOf(number).at(-1)).toMatchObject({ action: HistoryAction.Updated, fields: [TaskField.Order] });
  });

  test('a move changes the key of the moved task alone', () => {
    const { update, keyOf } = setup(3);
    const untouchedKeys = [keyOf(1), keyOf(2)];
    update({ number: 3, patch: { placement: { kind: TaskPlacement.First } } });
    expect([keyOf(1), keyOf(2)]).toEqual(untouchedKeys);
  });

  test('placing a task where it already sits writes nothing', () => {
    const { store, update } = setup(3);
    expectNoWrite({ store, run: () => update({ number: 2, patch: { placement: { kind: TaskPlacement.After, anchor: 1 } } }) });
    expect(store.historyOf(2)).toHaveLength(1);
  });

  test('First on the task holding the lowest key writes nothing', () => {
    const { store, update } = setup(3);
    expectNoWrite({ store, run: () => update({ number: 1, patch: { placement: { kind: TaskPlacement.First } } }) });
  });

  test('Last on the task holding the highest key writes nothing', () => {
    const { store, update } = setup(3);
    expectNoWrite({ store, run: () => update({ number: 3, patch: { placement: { kind: TaskPlacement.Last } } }) });
  });

  test('a done task between open neighbours keeps every key unique across both states', () => {
    const { store, update, markDone } = setup(4);
    markDone(2);
    update({ number: 4, patch: { placement: { kind: TaskPlacement.After, anchor: 1 } } });
    const keys = store.allTasks().map((task: Task) => task.orderKey);
    expect(new Set(keys).size).toBe(keys.length);
    expect(
      store
        .allTasks()
        .sort((left, right) => (left.orderKey < right.orderKey ? -1 : 1))
        .map((task) => task.number),
    ).toEqual([1, 4, 2, 3]);
  });

  test('First on an open task preceded only by done tasks moves it before them', () => {
    const { update, markDone, keyOf } = setup(3);
    markDone(1);
    markDone(2);
    update({ number: 3, patch: { placement: { kind: TaskPlacement.First } } });
    expect(keyOf(3) < keyOf(1)).toBe(true);
  });

  test('After a done anchor puts the key right after the anchor key', () => {
    const { update, markDone, keyOf } = setup(3);
    markDone(2);
    update({ number: 1, patch: { placement: { kind: TaskPlacement.After, anchor: 2 } } });
    expect(keyOf(2) < keyOf(1) && keyOf(1) < keyOf(3)).toBe(true);
  });

  test('After the middle one of 299 done tasks keeps the key strictly between its neighbours and every key unique', () => {
    const { store, update, markDone, keyOf } = setup(LARGE_PROJECT_SIZE);
    Array.from({ length: LARGE_PROJECT_SIZE - 1 }, (_, index) => index + 1).forEach(markDone);
    update({ number: LARGE_PROJECT_SIZE, patch: { placement: { kind: TaskPlacement.First } } });
    update({ number: LARGE_PROJECT_SIZE, patch: { placement: { kind: TaskPlacement.After, anchor: MIDDLE_TASK } } });
    const keys = store.allTasks().map((task) => task.orderKey);
    expect(keyOf(MIDDLE_TASK) < keyOf(LARGE_PROJECT_SIZE) && keyOf(LARGE_PROJECT_SIZE) < keyOf(MIDDLE_TASK + 1)).toBe(true);
    expect(new Set(keys).size).toBe(keys.length);
  });

  test('a new key longer than the limit is OrderKeyTooLong and nothing is written', () => {
    const { store, update } = setup(3);
    const lowerKey = `a0${'1'.repeat(ORDER_KEY_MAX_LENGTH - 2)}`;
    const upperKey = `${lowerKey}2`;
    setKey({ store, number: 1, orderKey: lowerKey });
    setKey({ store, number: 2, orderKey: upperKey });
    const writesBefore = store.writeCount;
    const violation = captureViolation(() => update({ number: 3, patch: { placement: { kind: TaskPlacement.After, anchor: 1 } } }));
    expect(violation.issue).toBe(RuleIssue.OrderKeyTooLong);
    expect(store.writeCount).toBe(writesBefore);
  });

  test('a new key exactly at the limit is accepted (pin)', () => {
    const { store, update, keyOf } = setup(3);
    const lowerKey = `a0${'1'.repeat(ORDER_KEY_MAX_LENGTH - 3)}`;
    setKey({ store, number: 1, orderKey: lowerKey });
    setKey({ store, number: 2, orderKey: `${lowerKey}2` });
    update({ number: 3, patch: { placement: { kind: TaskPlacement.After, anchor: 1 } } });
    expect(keyOf(3)).toHaveLength(ORDER_KEY_MAX_LENGTH);
  });

  test.each([
    { name: 'a fractional number', number: 1.5, patch: { title: 'x' } },
    { name: 'NaN', number: Number.NaN, patch: { title: 'x' } },
    { name: 'zero', number: 0, patch: { title: 'x' } },
    { name: 'a negative anchor', number: 1, patch: { placement: { kind: TaskPlacement.After, anchor: -1 } } as const },
    { name: 'a fractional anchor', number: 1, patch: { placement: { kind: TaskPlacement.Before, anchor: 1.5 } } as const },
  ])('$name is TaskNumberInvalid and nothing is written', ({ number, patch }) => {
    const { store, update } = setup(2);
    const writesBefore = store.writeCount;
    expect(captureViolation(() => update({ number, patch })).issue).toBe(RuleIssue.TaskNumberInvalid);
    expect(store.writeCount).toBe(writesBefore);
  });

  test('a placement and a title change in one patch list both fields', () => {
    const { store, update } = setup(3);
    update({ number: 3, patch: { title: 'Moved', placement: { kind: TaskPlacement.First } } });
    expect(store.historyOf(3).at(-1)?.fields).toEqual([TaskField.Title, TaskField.Order]);
  });

  test('a missing anchor is TaskNotFoundError naming the anchor', () => {
    const { update } = setup(2);
    const notFound = captureNotFound(() =>
      update({ number: 1, patch: { placement: { kind: TaskPlacement.Before, anchor: MISSING_NUMBER } } }),
    );
    expect(notFound.number).toBe(MISSING_NUMBER);
  });

  test('the task as its own anchor is PlacementAnchorInvalid', () => {
    const { store, update } = setup(2);
    const writesBefore = store.writeCount;
    const violation = captureViolation(() => update({ number: 1, patch: { placement: { kind: TaskPlacement.After, anchor: 1 } } }));
    expect(violation.issue).toBe(RuleIssue.PlacementAnchorInvalid);
    expect(store.writeCount).toBe(writesBefore);
  });
});
