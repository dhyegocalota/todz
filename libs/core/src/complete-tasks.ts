import { HistoryAction, TaskState } from '@todz/types';
import { findBatchTasks } from './find-batch-tasks';
import type { Clock, TaskStore } from './ports';
import type { Actor, Task } from './task';
import { normalizeCompletionNote } from './task-text';

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
  const completionNote = normalizeCompletionNote(note);
  const tasks = findBatchTasks({ store, numbers });
  const now = clock.now();
  return tasks.map((task) => {
    if (task.state === TaskState.Done) return { task, alreadyDone: true };
    const completedTask: Task = { ...task, state: TaskState.Done, completedAt: now, updatedAt: now };
    store.replaceTask(completedTask);
    store.appendHistory({
      number: task.number,
      entry: { at: now, actor, action: HistoryAction.Completed, fields: [], note: completionNote },
    });
    return { task: completedTask, alreadyDone: false };
  });
}
