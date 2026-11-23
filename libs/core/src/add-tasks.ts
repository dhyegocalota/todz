import type { Clock, TaskStore } from './ports';
import type { Actor, Task, TaskDraft } from './task';

export type AddedTask = { task: Task; replayed: boolean };

export function addTasks({
  store,
  clock,
  actor,
  drafts,
}: {
  store: TaskStore;
  clock: Clock;
  actor: Actor;
  drafts: TaskDraft[];
}): AddedTask[] {
  throw new Error('addTasks is not implemented');
}
