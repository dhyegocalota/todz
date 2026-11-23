import { HistoryAction, LAST_INDEX, TaskState } from '@todz/types';
import { assertBatchSize } from './batch-size';
import { normalizeDueDate } from './calendar-date';
import { atBatchIndex } from './errors';
import { orderKeyBetween } from './order-key';
import type { Clock, TaskStore } from './ports';
import { FIRST_TASK_NUMBER, listAllTasks } from './project-tasks';
import type { Actor, Task, TaskDraft } from './task';
import { normalizeIdempotencyKey, normalizeNotes, normalizeTitle } from './task-text';

export type AddedTask = { task: Task; replayed: boolean };

type ValidatedDraft = Pick<Task, 'title' | 'notes' | 'dueDate' | 'idempotencyKey'>;
type BatchState = {
  results: AddedTask[];
  createdTasks: Task[];
  nextNumber: number;
  lastOrderKey: string | null;
};

function validateDraft({ draft, index }: { draft: TaskDraft; index: number }): ValidatedDraft {
  return atBatchIndex({
    index,
    run: () => ({
      title: normalizeTitle(draft.title),
      notes: normalizeNotes(draft.notes),
      dueDate: normalizeDueDate(draft.dueDate),
      idempotencyKey: normalizeIdempotencyKey(draft.idempotencyKey),
    }),
  });
}

function findExistingTask({
  store,
  createdTasks,
  idempotencyKey,
}: {
  store: TaskStore;
  createdTasks: Task[];
  idempotencyKey: string | null;
}): Task | undefined {
  if (idempotencyKey === null) return undefined;
  const storedTask = store.findTaskByIdempotencyKey(idempotencyKey);
  if (storedTask) return storedTask;
  return createdTasks.find((task) => task.idempotencyKey === idempotencyKey);
}

function planDraft({
  state,
  draft,
  store,
  actor,
  now,
}: {
  state: BatchState;
  draft: ValidatedDraft;
  store: TaskStore;
  actor: Actor;
  now: number;
}): BatchState {
  const existingTask = findExistingTask({ store, createdTasks: state.createdTasks, idempotencyKey: draft.idempotencyKey });
  if (existingTask) return { ...state, results: [...state.results, { task: existingTask, replayed: true }] };
  const task: Task = {
    ...draft,
    number: state.nextNumber,
    state: TaskState.Open,
    orderKey: orderKeyBetween({ before: state.lastOrderKey, after: null }),
    createdBy: actor,
    createdAt: now,
    updatedAt: now,
    completedAt: null,
  };
  return {
    results: [...state.results, { task, replayed: false }],
    createdTasks: [...state.createdTasks, task],
    nextNumber: state.nextNumber + 1,
    lastOrderKey: task.orderKey,
  };
}

export function addTasks({
  store,
  clock,
  actor,
  drafts,
}: {
  store: TaskStore;
  clock: Clock;
  actor: Actor;
  drafts: TaskDraft[];
}): AddedTask[] {
  assertBatchSize(drafts.length);
  const validatedDrafts = drafts.map((draft, index) => validateDraft({ draft, index }));
  const now = clock.now();
  const lastIssuedNumber = store.lastIssuedTaskNumber();
  const lastTask = listAllTasks(store).at(LAST_INDEX);
  const initialState: BatchState = {
    results: [],
    createdTasks: [],
    nextNumber: lastIssuedNumber === null ? FIRST_TASK_NUMBER : lastIssuedNumber + 1,
    lastOrderKey: lastTask ? lastTask.orderKey : null,
  };
  const { results, createdTasks } = validatedDrafts.reduce((state, draft) => planDraft({ state, draft, store, actor, now }), initialState);
  createdTasks.forEach((task) => {
    store.insertTask(task);
    store.appendHistory({ number: task.number, entry: { at: now, actor, action: HistoryAction.Created, fields: [], note: null } });
  });
  return results;
}
