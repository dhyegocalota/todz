import { HistoryAction, TaskState } from '@todz/types';
import { findBatchTasks } from './find-batch-tasks';
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
  const tasks = findBatchTasks({ store, numbers });
  const now = clock.now();
  return tasks.map((task) => {
    if (task.state === TaskState.Open) return { task, alreadyOpen: true };
    const reopenedTask: Task = { ...task, state: TaskState.Open, completedAt: null, updatedAt: now };
    store.replaceTask(reopenedTask);
    store.appendHistory({
      number: task.number,
      entry: { at: now, actor, action: HistoryAction.Reopened, fields: [], note: null },
    });
    return { task: reopenedTask, alreadyOpen: false };
  });
}
