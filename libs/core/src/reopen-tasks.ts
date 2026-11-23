import type { Clock, TaskStore } from './ports';
import type { Actor, Task } from './task';

export type ReopenedTask = { task: Task; alreadyOpen: boolean };

export function reopenTasks({
  store,
  clock,
  actor,
  numbers,
}: {
  store: TaskStore;
  clock: Clock;
  actor: Actor;
  numbers: number[];
}): ReopenedTask[] {
  throw new Error('reopenTasks is not implemented');
}
