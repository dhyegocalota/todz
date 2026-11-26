import type { Actor, Task } from '@todz/core';
import { RuleIssue, TaskState } from '@todz/types';
import { MCP_COPY } from './mcp-copy';
import { type ProjectFailure, type ProjectResult, ProjectFailureKind } from './project-result';
import type { ProjectStore } from './project-store';

export const MOVE_KEY_PREFIX = 'move:';

export type MovedTask = { task: Task; arrived: Task };

// NB ADR 0102: a move adds to the destination first under a key naming the source task, then deletes the source, so a failure leaves a copy and a retry finishes the move.
export async function moveTask({
  source,
  sourceProjectId,
  sourceProjectName,
  destination,
  isDestinationListed,
  openTasksMax,
  actor,
  number,
}: {
  openTasksMax: number;
  source: DurableObjectStub<ProjectStore>;
  sourceProjectId: string;
  sourceProjectName: string;
  destination: DurableObjectStub<ProjectStore>;
  isDestinationListed: () => Promise<boolean>;
  actor: Actor;
  number: number;
}): Promise<ProjectResult<MovedTask>> {
  const read = await source.readTask({ number });
  if (!read.ok) return read;
  const task = read.value;
  const drafts = [
    { title: task.title, notes: task.notes, dueDate: task.dueDate, idempotencyKey: `${MOVE_KEY_PREFIX}${sourceProjectId}:${number}` },
  ];
  const added = await destination.addTasks({ actor, drafts, openTasksMax, arrivalNote: MCP_COPY.movedFrom(sourceProjectName) });
  if (!added.ok) return added;
  const [addition] = added.value;
  if (addition === undefined) throw new Error('adding one task answers one task');
  const isSameTask = addition.task.title === task.title && addition.task.notes === task.notes;
  if (!isSameTask) return { ok: false, failure: { kind: ProjectFailureKind.RuleViolated, issue: RuleIssue.MoveConflict, index: null } };
  const isDestinationPresent = await isDestinationListed();
  if (!isDestinationPresent) {
    await destination.wipe();
    return { ok: false, failure: { kind: ProjectFailureKind.RuleViolated, issue: RuleIssue.DestinationGone, index: null } };
  }
  const arrival = await arrivedAs({ destination, actor, task, arrived: addition.task });
  if (!arrival.ok) return arrival;
  const deleted = await source.deleteTask({ number, confirmation: task.title, unchangedFrom: task });
  if (!deleted.ok && isEditedSource(deleted.failure)) {
    await destination.deleteTask({ number: arrival.value.number, confirmation: arrival.value.title, unchangedFrom: arrival.value });
  }
  if (!deleted.ok) return deleted;
  return { ok: true, value: { task, arrived: arrival.value } };
}

function isEditedSource(failure: ProjectFailure): boolean {
  return failure.kind === ProjectFailureKind.RuleViolated && failure.issue === RuleIssue.TaskChanged;
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
