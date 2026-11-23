import type { Clock, TaskStore } from './ports';
import type { Actor, Task, TaskPatch } from './task';

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
  throw new Error('updateTask is not implemented');
}
