import { HistoryAction, ORDER_KEY_MAX_LENGTH, RuleIssue, TaskField, TaskPlacement } from '@todz/types';
import { normalizeDueDate } from './calendar-date';
import { RuleViolation, TaskNotFoundError } from './errors';
import { orderKeyBetween } from './order-key';
import type { Clock, TaskStore } from './ports';
import type { Actor, Placement, Task, TaskPatch } from './task';
import { assertTaskNumber } from './task-number';
import { normalizeNotes, normalizeTitle } from './task-text';

type Neighbours = { before: string | null; after: string | null };

function anchorOrderKeyOf({ anchor, task, store }: { anchor: number; task: Task; store: TaskStore }): string {
  if (anchor === task.number) throw new RuleViolation({ issue: RuleIssue.PlacementAnchorInvalid });
  const anchorTask = store.findTask(anchor);
  if (anchorTask === null) throw new TaskNotFoundError(anchor);
  return anchorTask.orderKey;
}

function neighboursOf({ placement, task, store }: { placement: Placement; task: Task; store: TaskStore }): Neighbours {
  const excludingNumber = task.number;
  if (placement.kind === TaskPlacement.First) return { before: null, after: store.firstOrderKey({ excludingNumber }) };
  if (placement.kind === TaskPlacement.Last) return { before: store.lastOrderKey({ excludingNumber }), after: null };
  const anchorOrderKey = anchorOrderKeyOf({ anchor: placement.anchor, task, store });
  if (placement.kind === TaskPlacement.Before) {
    return { before: store.orderKeyBefore({ orderKey: anchorOrderKey, excludingNumber }), after: anchorOrderKey };
  }
  return { before: anchorOrderKey, after: store.orderKeyAfter({ orderKey: anchorOrderKey, excludingNumber }) };
}

function orderKeyAfterPlacement({ placement, task, store }: { placement: Placement; task: Task; store: TaskStore }): string {
  const { before, after } = neighboursOf({ placement, task, store });
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
