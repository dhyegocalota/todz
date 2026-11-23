import { type RuleIssue, TASK_BATCH_MAX_SIZE, TaskState } from '@todz/types';
import { OWNER_ACTOR } from './actor';
import { addTasks } from './add-tasks';
import { RuleViolation, TaskNotFoundError } from './errors';
import type { Clock, TaskStore } from './ports';
import type { CalendarDate, Task } from './task';

export const CLOCK_NOW = 1_795_446_000_000;
export const TODAY = '2026-11-23' as CalendarDate;

export function fixedClock(now: number): Clock {
  return { now: () => now };
}

export function seedTasks({ store, count }: { store: TaskStore; count: number }): Task[] {
  const batchCount = Math.ceil(count / TASK_BATCH_MAX_SIZE);
  return Array.from({ length: batchCount }, (_, batchIndex) => batchIndex).flatMap((batchIndex) => {
    const firstNumber = batchIndex * TASK_BATCH_MAX_SIZE + 1;
    const batchSize = Math.min(TASK_BATCH_MAX_SIZE, count - batchIndex * TASK_BATCH_MAX_SIZE);
    return addTasks({
      store,
      clock: fixedClock(CLOCK_NOW),
      actor: OWNER_ACTOR,
      drafts: Array.from({ length: batchSize }, (_, offset) => ({
        title: `Task ${firstNumber + offset}`,
        notes: null,
        dueDate: null,
        idempotencyKey: null,
      })),
    }).map((added) => added.task);
  });
}

export function markTaskDone({ store, number }: { store: TaskStore; number: number }): void {
  const task = store.findTask(number);
  if (!task) throw new Error(`T-${number} should exist`);
  store.replaceTask({ ...task, state: TaskState.Done, completedAt: CLOCK_NOW });
}

export function itemAt<Item>({ items, index }: { items: Item[]; index: number }): Item {
  const item = items[index];
  if (item === undefined) throw new Error(`expected an item at ${index}`);
  return item;
}

function captureError<ErrorInstance extends Error>({
  run,
  errorClass,
}: {
  run: () => unknown;
  errorClass: new (...parameters: never[]) => ErrorInstance;
}): ErrorInstance {
  try {
    run();
  } catch (error) {
    if (error instanceof errorClass) return error;
    throw error;
  }
  throw new Error(`expected ${errorClass.name}`);
}

export function captureViolation(run: () => unknown): RuleViolation {
  return captureError({ run, errorClass: RuleViolation });
}

export function captureNotFound(run: () => unknown): TaskNotFoundError {
  return captureError({ run, errorClass: TaskNotFoundError });
}

export function violationIssueOf(run: () => unknown): RuleIssue {
  return captureViolation(run).issue;
}

export function violationMessageOf(run: () => unknown): string {
  return captureViolation(run).message;
}
