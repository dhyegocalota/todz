import type { Actor, HistoryEntry, Task } from '@todz/core';
import type { KeyRecord, OwnerRecord, ProjectRecord, WorkspaceRecord } from './owner-records';

export function ownerJson(_owner: OwnerRecord): unknown {
  throw new Error('ownerJson is not implemented');
}

export function projectJson(_project: ProjectRecord): unknown {
  throw new Error('projectJson is not implemented');
}

export function workspaceJson(_parameters: { workspace: WorkspaceRecord; projects: ProjectRecord[] }): unknown {
  throw new Error('workspaceJson is not implemented');
}

export function keyJson(_key: KeyRecord): unknown {
  throw new Error('keyJson is not implemented');
}

export function actorJson(_actor: Actor): unknown {
  throw new Error('actorJson is not implemented');
}

export function taskJson(_task: Task): unknown {
  throw new Error('taskJson is not implemented');
}

export function historyEntryJson(_entry: HistoryEntry): unknown {
  throw new Error('historyEntryJson is not implemented');
}
