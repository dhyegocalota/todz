import { RuleIssue } from '@todz/types';
import { assertBatchSize } from './batch-size';
import { RuleViolation, TaskNotFoundError, atBatchIndex } from './errors';
import type { TaskStore } from './ports';
import { FIRST_TASK_NUMBER } from './project-tasks';
import type { Task } from './task';

function assertTaskNumber(number: number): void {
  const isTaskNumber = Number.isSafeInteger(number) && number >= FIRST_TASK_NUMBER;
  if (!isTaskNumber) throw new RuleViolation({ issue: RuleIssue.TaskNumberInvalid });
}

function requireTask({ store, number }: { store: TaskStore; number: number }): Task {
  const task = store.findTask(number);
  if (task === null) throw new TaskNotFoundError(number);
  return task;
}

export function findBatchTasks({ store, numbers }: { store: TaskStore; numbers: number[] }): Task[] {
  assertBatchSize(numbers.length);
  numbers.forEach((number, index) => atBatchIndex({ index, run: () => assertTaskNumber(number) }));
  return [...new Set(numbers)].map((number) => requireTask({ store, number }));
}
