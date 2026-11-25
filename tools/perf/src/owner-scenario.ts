export type OwnerConnection = { origin: string; token: string; fetch: typeof fetch };

export type WorkspaceListing = { id: string; name: string; projectIds: string[] };

export type ChangePage = { taskNumbers: number[]; cursor: number; hasMore: boolean };

export function signInOwner(_: { origin: string; fetch: typeof fetch; identity: string }): Promise<OwnerConnection> {
  throw new Error('signInOwner is not implemented');
}

export function listWorkspaces(_: OwnerConnection): Promise<WorkspaceListing[]> {
  throw new Error('listWorkspaces is not implemented');
}

export function readChanges(_: { connection: OwnerConnection; projectId: string; cursor: number }): Promise<ChangePage> {
  throw new Error('readChanges is not implemented');
}

export function addOwnerTasks(_: { connection: OwnerConnection; projectId: string; titles: string[] }): Promise<number[]> {
  throw new Error('addOwnerTasks is not implemented');
}

export function completeOwnerTasks(_: { connection: OwnerConnection; projectId: string; numbers: number[] }): Promise<void> {
  throw new Error('completeOwnerTasks is not implemented');
}

export function createWorkspace(_: { connection: OwnerConnection; name: string }): Promise<{ workspaceId: string; inboxId: string }> {
  throw new Error('createWorkspace is not implemented');
}

export function createProject(_: { connection: OwnerConnection; workspaceId: string; name: string }): Promise<string> {
  throw new Error('createProject is not implemented');
}

export function issueKey(_: { connection: OwnerConnection; projectId: string }): Promise<string> {
  throw new Error('issueKey is not implemented');
}
