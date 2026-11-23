import type { Clock, TaskStore } from './ports';
import type { Actor, Task } from './task';

export type CompletedTask = { task: Task; alreadyDone: boolean };

export function completeTasks({
  store,
  clock,
  actor,
  numbers,
  note,
}: {
  store: TaskStore;
  clock: Clock;
  actor: Actor;
  numbers: number[];
  note: string | null;
}): CompletedTask[] {
  throw new Error('completeTasks is not implemented');
}
