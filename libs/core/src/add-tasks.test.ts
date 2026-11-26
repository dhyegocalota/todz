import { HistoryAction, RuleIssue, TASK_BATCH_MAX_SIZE, TaskState } from '@todz/types';
import { describe, expect, test } from 'vitest';
import { OWNER_ACTOR, agentActor } from './actor';
import { addTasks } from './add-tasks';
import { InMemoryTaskStore } from './in-memory-task-store';
import type { TaskDraft } from './task';
import { CLOCK_NOW, captureViolation, fixedClock, itemAt, markTaskDone } from './test-support';

const SENTINEL = 'SENTINEL-CONTENT';
const CLAUDE_CODE = 'Claude Code';
const TITLE_LIMIT_OVERFLOW = 501;
const NOTES_LIMIT_OVERFLOW = 10_241;
const KEY_LIMIT_OVERFLOW = 129;
const SECOND_INSERT = 2;
const FIRST_INDEX = 0;
const SECOND_INDEX = 1;
const THIRD_INDEX = 2;

function draftOf(overrides: Partial<TaskDraft>): TaskDraft {
  return { title: 'Fix the login', notes: null, dueDate: null, idempotencyKey: null, ...overrides };
}

function setup() {
  const store = new InMemoryTaskStore();
  const clock = fixedClock(CLOCK_NOW);
  function add(drafts: TaskDraft[]) {
    return addTasks({ store, clock, actor: OWNER_ACTOR, drafts });
  }
  return { store, clock, add };
}

describe('addTasks', () => {
  test('one draft becomes T-1, open, created by the actor, with one Created history line', () => {
    const store = new InMemoryTaskStore();
    const actor = agentActor(CLAUDE_CODE);
    const results = addTasks({
      store,
      clock: fixedClock(CLOCK_NOW),
      actor,
      drafts: [draftOf({ title: '  Fix\n the   login ', notes: 'a\r\nb', dueDate: '2026-11-24', idempotencyKey: 'k1' })],
    });
    const added = itemAt({ items: results, index: FIRST_INDEX });
    expect(added).toEqual({
      replayed: false,
      task: {
        number: 1,
        title: 'Fix the login',
        notes: 'a\nb',
        dueDate: '2026-11-24',
        state: TaskState.Open,
        orderKey: expect.any(String),
        idempotencyKey: 'k1',
        createdBy: actor,
        createdAt: CLOCK_NOW,
        updatedAt: CLOCK_NOW,
        completedAt: null,
      },
    });
    expect(store.findTask(1)).toEqual(added.task);
    expect(store.historyOf(1)).toEqual([{ at: CLOCK_NOW, actor, action: HistoryAction.Created, fields: [], note: null }]);
  });

  test('three drafts take T-1, T-2, T-3 in draft order with strictly increasing order keys', () => {
    const { add } = setup();
    const tasks = add([draftOf({ title: 'A' }), draftOf({ title: 'B' }), draftOf({ title: 'C' })]).map((result) => result.task);
    const orderKeys = tasks.map((task) => task.orderKey);
    expect(tasks.map((task) => task.number)).toEqual([1, 2, 3]);
    expect(tasks.map((task) => task.title)).toEqual(['A', 'B', 'C']);
    expect(orderKeys).toEqual([...orderKeys].sort());
    expect(new Set(orderKeys).size).toBe(orderKeys.length);
  });

  test('a new draft after T-1 to T-3 (one done) is T-4 with an order key above every existing key', () => {
    const { store, add } = setup();
    const created = add([draftOf({ title: 'A' }), draftOf({ title: 'B' }), draftOf({ title: 'C' })]).map((result) => result.task);
    const highestKeyTask = itemAt({ items: created, index: THIRD_INDEX });
    store.replaceTask({ ...highestKeyTask, state: TaskState.Done, completedAt: CLOCK_NOW });
    const added = itemAt({ items: add([draftOf({ title: 'D' })]), index: FIRST_INDEX });
    expect(added.task.number).toBe(4);
    expect(created.every((task) => task.orderKey < added.task.orderKey)).toBe(true);
  });

  test('the same key added twice replays the first task and writes nothing new', () => {
    const { store, add } = setup();
    const first = itemAt({ items: add([draftOf({ idempotencyKey: 'k1' })]), index: FIRST_INDEX });
    const writesAfterFirstCall = store.writeCount;
    const second = itemAt({ items: add([draftOf({ idempotencyKey: 'k1' })]), index: FIRST_INDEX });
    expect(second).toEqual({ task: first.task, replayed: true });
    expect(store.allTasks()).toHaveLength(1);
    expect(store.historyOf(1)).toHaveLength(1);
    expect(store.writeCount).toBe(writesAfterFirstCall);
  });

  test('a replay whose title differs returns the stored task unchanged', () => {
    const { add } = setup();
    const first = itemAt({ items: add([draftOf({ title: 'Original', idempotencyKey: 'k1' })]), index: FIRST_INDEX });
    const replay = itemAt({ items: add([draftOf({ title: 'Different', idempotencyKey: 'k1' })]), index: FIRST_INDEX });
    expect(replay).toEqual({ task: first.task, replayed: true });
    expect(replay.task.title).toBe('Original');
  });

  test('one batch with key k1 twice creates one task and the repeat is replayed', () => {
    const { store, add } = setup();
    const results = add([draftOf({ idempotencyKey: 'k1' }), draftOf({ idempotencyKey: 'k1' })]);
    expect(results.map((result) => result.replayed)).toEqual([false, true]);
    expect(results.map((result) => result.task.number)).toEqual([1, 1]);
    expect(store.allTasks()).toHaveLength(1);
    expect(store.historyOf(1)).toHaveLength(1);
  });

  test('[k1, k1, no key] numbers T-1, T-1, T-2', () => {
    const { add } = setup();
    const results = add([draftOf({ idempotencyKey: 'k1' }), draftOf({ idempotencyKey: 'k1' }), draftOf({})]);
    expect(results.map((result) => result.task.number)).toEqual([1, 1, 2]);
  });

  test('a replayed draft with an empty title is TitleEmpty and nothing is written', () => {
    const { store, add } = setup();
    add([draftOf({ idempotencyKey: 'k1' })]);
    const writesBefore = store.writeCount;
    const violation = captureViolation(() => add([draftOf({ title: '  ', idempotencyKey: 'k1' })]));
    expect(violation.issue).toBe(RuleIssue.TitleEmpty);
    expect(violation.index).toBe(FIRST_INDEX);
    expect(store.writeCount).toBe(writesBefore);
  });

  test('an empty batch is BatchEmpty', () => {
    const { add } = setup();
    expect(captureViolation(() => add([])).issue).toBe(RuleIssue.BatchEmpty);
  });

  test('a batch over the maximum is BatchTooLarge', () => {
    const { store, add } = setup();
    const drafts = Array.from({ length: TASK_BATCH_MAX_SIZE + 1 }, () => draftOf({}));
    expect(captureViolation(() => add(drafts)).issue).toBe(RuleIssue.BatchTooLarge);
    expect(store.writeCount).toBe(0);
  });

  test('a batch of the maximum size is accepted', () => {
    const { add } = setup();
    const drafts = Array.from({ length: TASK_BATCH_MAX_SIZE }, () => draftOf({}));
    expect(add(drafts)).toHaveLength(TASK_BATCH_MAX_SIZE);
  });

  test('a batch whose third draft has an empty title fails with index 2 and writes nothing', () => {
    const { store, add } = setup();
    const violation = captureViolation(() => add([draftOf({}), draftOf({}), draftOf({ title: ' ' })]));
    expect(violation.issue).toBe(RuleIssue.TitleEmpty);
    expect(violation.index).toBe(THIRD_INDEX);
    expect(store.writeCount).toBe(0);
    expect(store.allTasks()).toEqual([]);
  });

  test.each([
    { name: 'an impossible due date', overrides: { dueDate: '2026-02-30' }, issue: RuleIssue.DueDateInvalid },
    { name: 'an idempotency key with a space', overrides: { idempotencyKey: 'k 1' }, issue: RuleIssue.IdempotencyKeyInvalid },
    {
      name: 'an idempotency key of 129 characters',
      overrides: { idempotencyKey: 'k'.repeat(KEY_LIMIT_OVERFLOW) },
      issue: RuleIssue.IdempotencyKeyInvalid,
    },
  ])('$name is $issue with its index and nothing written', ({ overrides, issue }) => {
    const { store, add } = setup();
    const violation = captureViolation(() => add([draftOf({}), draftOf(overrides)]));
    expect(violation.issue).toBe(issue);
    expect(violation.index).toBe(SECOND_INDEX);
    expect(store.writeCount).toBe(0);
  });

  test('a violation message holds the issue only, never the title or the notes', () => {
    const { add } = setup();
    const titleViolation = captureViolation(() => add([draftOf({ title: `${SENTINEL}${'a'.repeat(TITLE_LIMIT_OVERFLOW)}` })]));
    const notesViolation = captureViolation(() => add([draftOf({ notes: `${SENTINEL}${'a'.repeat(NOTES_LIMIT_OVERFLOW)}` })]));
    expect(titleViolation.message).not.toContain(SENTINEL);
    expect(notesViolation.message).not.toContain(SENTINEL);
  });

  test('a mixed batch replays stored keys, repeats and new drafts in draft order', () => {
    const { add } = setup();
    const stored = itemAt({ items: add([draftOf({ title: 'Stored', idempotencyKey: 'k1' })]), index: FIRST_INDEX });
    const results = add([
      draftOf({ title: 'b' }),
      draftOf({ title: 'other', notes: 'other', dueDate: '2026-12-01', idempotencyKey: 'k1' }),
      draftOf({ title: 'c', idempotencyKey: 'k2' }),
      draftOf({ title: 'c again', idempotencyKey: 'k2' }),
      draftOf({ title: 'd' }),
    ]);
    expect(results.map((result) => result.task.number)).toEqual([2, 1, 3, 3, 4]);
    expect(results.map((result) => result.replayed)).toEqual([false, true, false, true, false]);
    expect(itemAt({ items: results, index: SECOND_INDEX }).task).toEqual(stored.task);
  });

  test('a done task is replayed by its key and the store is untouched', () => {
    const { store, add } = setup();
    add([draftOf({ idempotencyKey: 'k1' })]);
    markTaskDone({ store, number: 1 });
    const writesBefore = store.writeCount;
    const replay = itemAt({ items: add([draftOf({ idempotencyKey: 'k1' })]), index: FIRST_INDEX });
    expect(replay).toEqual({ task: store.findTask(1), replayed: true });
    expect(replay.task.state).toBe(TaskState.Done);
    expect(store.writeCount).toBe(writesBefore);
  });

  test('a store that throws on the second insert propagates the error and keeps the first task, as atomicity is the transaction of the caller', () => {
    const store = new InMemoryTaskStore();
    const failure = new Error('boom');
    const insertTask = store.insertTask.bind(store);
    let insertCount = 0;
    store.insertTask = (task) => {
      insertCount += 1;
      if (insertCount === SECOND_INSERT) throw failure;
      insertTask(task);
    };
    expect(() => addTasks({ store, clock: fixedClock(CLOCK_NOW), actor: OWNER_ACTOR, drafts: [draftOf({}), draftOf({})] })).toThrow(
      failure,
    );
    expect(store.allTasks()).toHaveLength(1);
  });

  test('reads the clock once for the whole batch', () => {
    let readCount = 0;
    const clock = {
      now: () => {
        readCount += 1;
        return CLOCK_NOW;
      },
    };
    addTasks({ store: new InMemoryTaskStore(), clock, actor: OWNER_ACTOR, drafts: [draftOf({}), draftOf({})] });
    expect(readCount).toBe(1);
  });
});
