import type { Clock, TaskStore } from './ports';
import type { Task } from './task';

export function deleteTask(_parameters: { store: TaskStore; clock: Clock; number: number; confirmation: string }): Task {
  throw new Error('deleteTask is not implemented');
}
