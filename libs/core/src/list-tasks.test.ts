import { DueWindow, LIST_LIMIT_MAX, RuleIssue, SEARCH_TEXT_MAX_LENGTH, TaskState } from '@todz/types';
import { describe, expect, test } from 'vitest';
import { OWNER_ACTOR } from './actor';
import { addTasks } from './add-tasks';
import { InMemoryTaskStore } from './in-memory-task-store';
import { listTasks } from './list-tasks';
import type { TaskDraft, TaskFilter } from './task';
import { CLOCK_NOW, TODAY, captureViolation, fixedClock } from './test-support';

const SENTINEL = 'SENTINEL-CONTENT';
const DEFAULT_LIMIT = 50;

function draftOf(overrides: Partial<TaskDraft>): TaskDraft {
  return { title: 'Task', notes: null, dueDate: null, idempotencyKey: null, ...overrides };
}

function filterOf(overrides: Partial<TaskFilter>): TaskFilter {
  return { state: TaskState.Open, dueWindows: [], text: null, limit: DEFAULT_LIMIT, ...overrides };
}

function setup(drafts: TaskDraft[]) {
  const store = new InMemoryTaskStore();
  addTasks({ store, clock: fixedClock(CLOCK_NOW), actor: OWNER_ACTOR, drafts });
  function completeAt({ number, completedAt }: { number: number; completedAt: number }) {
    const task = store.findTask(number);
    if (!task) throw new Error(`T-${number} should exist`);
    store.replaceTask({ ...task, state: TaskState.Done, completedAt });
  }
  function list(filter: Partial<TaskFilter>) {
    return listTasks({ store, today: TODAY, filter: filterOf(filter) });
  }
  function listNumbers(filter: Partial<TaskFilter>) {
    return list(filter).tasks.map((task) => task.number);
  }
  return { store, completeAt, list, listNumbers };
}

describe('listTasks', () => {
  test('open tasks come in order-key order and done tasks are absent', () => {
    const { store, completeAt, listNumbers } = setup([draftOf({ title: 'A' }), draftOf({ title: 'B' }), draftOf({ title: 'C' })]);
    completeAt({ number: 2, completedAt: CLOCK_NOW });
    const first = store.findTask(1);
    const third = store.findTask(3);
    if (!first || !third) throw new Error('tasks should exist');
    store.replaceTask({ ...first, orderKey: third.orderKey });
    store.replaceTask({ ...third, orderKey: first.orderKey });
    expect(listNumbers({})).toEqual([3, 1]);
  });

  test('done tasks come newest completedAt first, ties by highest number first', () => {
    const { completeAt, listNumbers } = setup([draftOf({}), draftOf({}), draftOf({}), draftOf({})]);
    completeAt({ number: 1, completedAt: CLOCK_NOW + 3 });
    completeAt({ number: 2, completedAt: CLOCK_NOW + 1 });
    completeAt({ number: 3, completedAt: CLOCK_NOW + 3 });
    completeAt({ number: 4, completedAt: CLOCK_NOW + 2 });
    expect(listNumbers({ state: TaskState.Done })).toEqual([3, 1, 4, 2]);
  });

  test('due windows Overdue and Today keep the first two of four tasks', () => {
    const { listNumbers } = setup([
      draftOf({ dueDate: '2026-11-22' }),
      draftOf({ dueDate: '2026-11-23' }),
      draftOf({ dueDate: '2026-11-24' }),
      draftOf({}),
    ]);
    expect(listNumbers({ dueWindows: [DueWindow.Overdue, DueWindow.Today] })).toEqual([1, 2]);
    expect(listNumbers({ dueWindows: [DueWindow.Undated] })).toEqual([4]);
    expect(listNumbers({ dueWindows: [DueWindow.Upcoming] })).toEqual([3]);
  });

  test('text matches titles and notes without case or accents', () => {
    const { listNumbers } = setup([
      draftOf({ title: 'Reunião com Ana' }),
      draftOf({ title: 'Other', notes: 'sobre a REUNIÃO de hoje' }),
      draftOf({ title: 'Unrelated' }),
    ]);
    expect(listNumbers({ text: 'reuniao' })).toEqual([1, 2]);
  });

  test('blank text means no text filter', () => {
    const { listNumbers } = setup([draftOf({ title: 'A' }), draftOf({ title: 'B' })]);
    expect(listNumbers({ text: '  ' })).toEqual([1, 2]);
  });

  test('search text that folds to nothing, such as a lone combining mark, means no text filter (pin)', () => {
    const { listNumbers } = setup([draftOf({ title: 'A' }), draftOf({ title: 'B' })]);
    expect(listNumbers({ text: '̃' })).toEqual([1, 2]);
  });

  test('text typed with combining marks matches precomposed titles and capitals (pin)', () => {
    const { listNumbers } = setup([draftOf({ title: 'Reunião' })]);
    expect(listNumbers({ text: 'Reunião' })).toEqual([1]);
    expect(listNumbers({ text: 'REUNIAO' })).toEqual([1]);
  });

  test('the limit cuts the list and totalMatched counts before it', () => {
    const { list } = setup(Array.from({ length: 5 }, () => draftOf({})));
    const result = list({ limit: 2 });
    expect(result.tasks.map((task) => task.number)).toEqual([1, 2]);
    expect(result.totalMatched).toBe(5);
  });

  test('a limit of the maximum is accepted', () => {
    const { list } = setup([draftOf({})]);
    expect(list({ limit: LIST_LIMIT_MAX }).tasks).toHaveLength(1);
  });

  test.each([0, LIST_LIMIT_MAX + 1, 1.5, -1, Number.NaN])('the limit %j is LimitInvalid', (limit) => {
    const { list } = setup([draftOf({})]);
    expect(captureViolation(() => list({ limit })).issue).toBe(RuleIssue.LimitInvalid);
  });

  test('search text over the limit is SearchTextTooLong, without its text', () => {
    const { list } = setup([draftOf({})]);
    const violation = captureViolation(() => list({ text: `${SENTINEL}${'a'.repeat(SEARCH_TEXT_MAX_LENGTH)}` }));
    expect(violation.issue).toBe(RuleIssue.SearchTextTooLong);
    expect(violation.message).not.toContain(SENTINEL);
  });

  test('a state with no tasks lists nothing', () => {
    const { list } = setup([draftOf({})]);
    expect(list({ state: TaskState.Done })).toEqual({ tasks: [], totalMatched: 0 });
  });
});
