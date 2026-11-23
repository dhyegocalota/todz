import { assertBatchSize } from './batch-size';
import { TaskNotFoundError, atBatchIndex } from './errors';
import type { TaskStore } from './ports';
import type { Task } from './task';
import { assertTaskNumber } from './task-number';

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
