import type { Task } from './task';

export const FIRST_TASK_NUMBER = 1;
export const NO_EXCLUDED_TASK_NUMBER = 0;

export const SORTS_BEFORE = -1;
export const SORTS_AFTER = 1;
export const SORTS_EQUAL = 0;

export function compareOrderKeys(left: Task, right: Task): number {
  if (left.orderKey < right.orderKey) return SORTS_BEFORE;
  if (left.orderKey > right.orderKey) return SORTS_AFTER;
  return SORTS_EQUAL;
}
