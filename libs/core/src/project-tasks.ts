import { TaskState } from '@todz/types';
import type { TaskStore } from './ports';
import type { Task } from './task';

const SORTS_BEFORE = -1;
const SORTS_AFTER = 1;
const SORTS_EQUAL = 0;

export function compareOrderKeys(left: Task, right: Task): number {
  if (left.orderKey < right.orderKey) return SORTS_BEFORE;
  if (left.orderKey > right.orderKey) return SORTS_AFTER;
  return SORTS_EQUAL;
}

export function orderKeyAt({ tasks, index }: { tasks: Task[]; index: number }): string | null {
  const task = tasks[index];
  if (task === undefined) return null;
  return task.orderKey;
}

export function listAllTasks(store: TaskStore): Task[] {
  return [...store.listTasksInState(TaskState.Open), ...store.listTasksInState(TaskState.Done)].sort(compareOrderKeys);
}
