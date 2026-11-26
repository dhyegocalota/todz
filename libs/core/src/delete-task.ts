import { RuleIssue } from '@todz/types';
import { RuleViolation, TaskNotFoundError } from './errors';
import type { Clock, TaskStore } from './ports';
import type { Task } from './task';
import { assertTaskNumber } from './task-number';

export function deleteTask({
  store,
  clock,
  number,
  confirmation,
}: {
  store: TaskStore;
  clock: Clock;
  number: number;
  confirmation: string;
}): Task {
  assertTaskNumber(number);
  const task = store.findTask(number);
  if (task === null) throw new TaskNotFoundError(number);
  const isConfirmed = confirmation.trim() === task.title;
  if (!isConfirmed) throw new RuleViolation({ issue: RuleIssue.ConfirmationMismatch });
  store.removeTask({ number, at: clock.now() });
  return task;
}
