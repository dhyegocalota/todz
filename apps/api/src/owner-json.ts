import type { Actor, HistoryEntry, Task } from '@todz/core';
import { ActorKind } from '@todz/types';
import type { KeyRecord, OwnerRecord, ProjectRecord, WorkspaceRecord } from './owner-records';

export function ownerJson(owner: OwnerRecord) {
  return {
    id: owner.id,
    time_zone: owner.timeZone,
    agent_nudge: owner.agentNudge,
    day_email: owner.dayEmail,
    day_email_minutes: owner.dayEmailMinutes,
  };
}

export function projectJson(project: ProjectRecord) {
  return { id: project.id, name: project.name, is_inbox: project.isInbox, created_at: project.createdAt };
}

export function workspaceJson({ workspace, projects }: { workspace: WorkspaceRecord; projects: ProjectRecord[] }) {
  return { id: workspace.id, name: workspace.name, created_at: workspace.createdAt, projects: projects.map(projectJson) };
}

export function keyJson(key: KeyRecord) {
  return { id: key.id, hint: key.hint, created_at: key.createdAt };
}

export function actorJson(actor: Actor) {
  if (actor.kind === ActorKind.Owner) return { kind: actor.kind, client_name: null };
  return { kind: actor.kind, client_name: actor.clientName };
}

export function taskJson(task: Task) {
  return {
    number: task.number,
    title: task.title,
    notes: task.notes,
    due_date: task.dueDate,
    state: task.state,
    order_key: task.orderKey,
    idempotency_key: task.idempotencyKey,
    created_by: actorJson(task.createdBy),
    created_at: task.createdAt,
    updated_at: task.updatedAt,
    completed_at: task.completedAt,
  };
}

export function historyEntryJson(entry: HistoryEntry) {
  return { at: entry.at, actor: actorJson(entry.actor), action: entry.action, fields: entry.fields, note: entry.note };
}
