import { RuleIssue } from '@todz/types';
import { RuleViolation, TaskNotFoundError } from './errors';
import type { Clock, TaskStore } from './ports';
import type { Task } from './task';
import { assertTaskNumber } from './task-number';

const UNCHANGED_FIELDS: (keyof Task)[] = ['title', 'notes', 'dueDate', 'state', 'orderKey', 'updatedAt', 'completedAt'];

export function deleteTask({
  store,
  clock,
  number,
  confirmation,
  unchangedFrom,
}: {
  store: TaskStore;
  clock: Clock;
  number: number;
  confirmation: string;
  unchangedFrom?: Task;
}): Task {
  assertTaskNumber(number);
  const task = store.findTask(number);
  if (task === null) throw new TaskNotFoundError(number);
  const isConfirmed = confirmation.trim() === task.title;
  if (!isConfirmed) throw new RuleViolation({ issue: RuleIssue.ConfirmationMismatch });
  const isChangedSinceRead = unchangedFrom !== undefined && UNCHANGED_FIELDS.some((field) => task[field] !== unchangedFrom[field]);
  if (isChangedSinceRead) throw new RuleViolation({ issue: RuleIssue.TaskChanged });
  store.removeTask({ number, at: clock.now() });
  return task;
}
