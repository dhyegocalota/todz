import { HistoryAction, ORDER_KEY_MAX_LENGTH, RuleIssue, TaskField, TaskPlacement } from '@todz/types';
import { normalizeDueDate } from './calendar-date';
import { RuleViolation, TaskNotFoundError } from './errors';
import { orderKeyBetween } from './order-key';
import type { Clock, TaskStore } from './ports';
import { listAllTasks, orderKeyAt } from './project-tasks';
import type { Actor, Placement, Task, TaskPatch } from './task';
import { assertTaskNumber } from './task-number';
import { normalizeNotes, normalizeTitle } from './task-text';

const NO_ANCHOR_POSITION = 0;
const ABSENT_INDEX = -1;

type Neighbours = { before: string | null; after: string | null };
type NeighbourContext = { others: Task[]; anchorPosition: number };

const NEIGHBOURS_OF_PLACEMENT: Record<TaskPlacement, (context: NeighbourContext) => Neighbours> = {
  [TaskPlacement.First]: ({ others }) => ({ before: null, after: orderKeyAt({ tasks: others, index: 0 }) }),
  [TaskPlacement.Last]: ({ others }) => ({ before: orderKeyAt({ tasks: others, index: others.length - 1 }), after: null }),
  [TaskPlacement.Before]: ({ others, anchorPosition }) => ({
    before: orderKeyAt({ tasks: others, index: anchorPosition - 1 }),
    after: orderKeyAt({ tasks: others, index: anchorPosition }),
  }),
  [TaskPlacement.After]: ({ others, anchorPosition }) => ({
    before: orderKeyAt({ tasks: others, index: anchorPosition }),
    after: orderKeyAt({ tasks: others, index: anchorPosition + 1 }),
  }),
};

function anchorPositionOf({ placement, task, others }: { placement: Placement; task: Task; others: Task[] }): number {
  if (placement.kind === TaskPlacement.First || placement.kind === TaskPlacement.Last) return NO_ANCHOR_POSITION;
  if (placement.anchor === task.number) throw new RuleViolation({ issue: RuleIssue.PlacementAnchorInvalid });
  const anchorPosition = others.findIndex((other) => other.number === placement.anchor);
  if (anchorPosition === ABSENT_INDEX) throw new TaskNotFoundError(placement.anchor);
  return anchorPosition;
}

function orderKeyAfterPlacement({ placement, task, store }: { placement: Placement; task: Task; store: TaskStore }): string {
  const others = listAllTasks(store).filter((other) => other.number !== task.number);
  const anchorPosition = anchorPositionOf({ placement, task, others });
  const { before, after } = NEIGHBOURS_OF_PLACEMENT[placement.kind]({ others, anchorPosition });
  const isAboveBefore = before === null || before < task.orderKey;
  const isBelowAfter = after === null || task.orderKey < after;
  if (isAboveBefore && isBelowAfter) return task.orderKey;
  const newOrderKey = orderKeyBetween({ before, after });
  if (newOrderKey.length > ORDER_KEY_MAX_LENGTH) throw new RuleViolation({ issue: RuleIssue.OrderKeyTooLong });
  return newOrderKey;
}

function assertPlacementAnchor(placement: Placement | undefined): void {
  if (placement === undefined) return;
  if (placement.kind === TaskPlacement.First || placement.kind === TaskPlacement.Last) return;
  assertTaskNumber(placement.anchor);
}

export function updateTask({
  store,
  clock,
  actor,
  number,
  patch,
}: {
  store: TaskStore;
  clock: Clock;
  actor: Actor;
  number: number;
  patch: TaskPatch;
}): Task {
  assertTaskNumber(number);
  assertPlacementAnchor(patch.placement);
  const isEmptyPatch = [patch.title, patch.notes, patch.dueDate, patch.placement].every((value) => value === undefined);
  if (isEmptyPatch) throw new RuleViolation({ issue: RuleIssue.NothingToUpdate });
  const task = store.findTask(number);
  if (task === null) throw new TaskNotFoundError(number);
  const title = patch.title === undefined ? task.title : normalizeTitle(patch.title);
  const notes = patch.notes === undefined ? task.notes : normalizeNotes(patch.notes);
  const dueDate = patch.dueDate === undefined ? task.dueDate : normalizeDueDate(patch.dueDate);
  const orderKey = patch.placement === undefined ? task.orderKey : orderKeyAfterPlacement({ placement: patch.placement, task, store });
  const changedFields = [
    { field: TaskField.Title, isChanged: title !== task.title },
    { field: TaskField.Notes, isChanged: notes !== task.notes },
    { field: TaskField.DueDate, isChanged: dueDate !== task.dueDate },
    { field: TaskField.Order, isChanged: orderKey !== task.orderKey },
  ]
    .filter(({ isChanged }) => isChanged)
    .map(({ field }) => field);
  if (changedFields.length === 0) return task;
  const now = clock.now();
  const updatedTask: Task = { ...task, title, notes, dueDate, orderKey, updatedAt: now };
  store.replaceTask(updatedTask);
  store.appendHistory({ number, entry: { at: now, actor, action: HistoryAction.Updated, fields: changedFields, note: null } });
  return updatedTask;
}
