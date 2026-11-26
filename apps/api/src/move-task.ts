import type { Actor, Task } from '@todz/core';
import { TaskState } from '@todz/types';
import type { ProjectResult } from './project-result';
import type { ProjectStore } from './project-store';

const MOVE_KEY_PREFIX = 'move:';

export type MovedTask = { task: Task; arrived: Task };

// NB ADR 0101: a move adds to the destination first under a key naming the source task, then deletes the source, so a failure leaves a copy and a retry finishes the move.
export async function moveTask({
  source,
  sourceProjectId,
  destination,
  actor,
  number,
}: {
  source: DurableObjectStub<ProjectStore>;
  sourceProjectId: string;
  destination: DurableObjectStub<ProjectStore>;
  actor: Actor;
  number: number;
}): Promise<ProjectResult<MovedTask>> {
  const read = await source.readTask({ number });
  if (!read.ok) return read;
  const task = read.value;
  const drafts = [
    { title: task.title, notes: task.notes, dueDate: task.dueDate, idempotencyKey: `${MOVE_KEY_PREFIX}${sourceProjectId}:${number}` },
  ];
  const added = await destination.addTasks({ actor, drafts });
  if (!added.ok) return added;
  const [addition] = added.value;
  if (addition === undefined) throw new Error('adding one task answers one task');
  const arrival = await arrivedAs({ destination, actor, task, arrived: addition.task });
  if (!arrival.ok) return arrival;
  const deleted = await source.deleteTask({ number, confirmation: task.title });
  if (!deleted.ok) return deleted;
  return { ok: true, value: { task, arrived: arrival.value } };
}

async function arrivedAs({
  destination,
  actor,
  task,
  arrived,
}: {
  destination: DurableObjectStub<ProjectStore>;
  actor: Actor;
  task: Task;
  arrived: Task;
}): Promise<ProjectResult<Task>> {
  const isInItsState = task.state === TaskState.Open || arrived.state === TaskState.Done;
  if (isInItsState) return { ok: true, value: arrived };
  const completed = await destination.completeTasks({ actor, numbers: [arrived.number], note: null });
  if (!completed.ok) return completed;
  const [completion] = completed.value;
  if (completion === undefined) throw new Error('completing one task answers one task');
  return { ok: true, value: completion.task };
}
