import type { ProjectRecord, WorkspaceRecord } from './owner-records';

type WorkspaceRow = { id: string; name: string; created_at: number };
type ProjectRow = { id: string; workspace_id: string; name: string; is_inbox: number; created_at: number };

export type WorkspaceListing = { workspace: WorkspaceRecord; projects: ProjectRecord[] };

function projectRecordOf(row: ProjectRow): ProjectRecord {
  return { id: row.id, name: row.name, isInbox: row.is_inbox === 1, createdAt: row.created_at };
}

export async function listOwnerWorkspaces({ directory, ownerId }: { directory: D1Database; ownerId: string }): Promise<WorkspaceListing[]> {
  const [workspaceRows, projectRows] = await Promise.all([
    directory
      .prepare('SELECT id, name, created_at FROM workspaces WHERE owner_id = ? ORDER BY created_at, rowid')
      .bind(ownerId)
      .all<WorkspaceRow>(),
    directory
      .prepare(
        'SELECT projects.id, projects.workspace_id, projects.name, projects.is_inbox, projects.created_at FROM projects JOIN workspaces ON workspaces.id = projects.workspace_id WHERE workspaces.owner_id = ? ORDER BY projects.is_inbox DESC, projects.created_at, projects.rowid',
      )
      .bind(ownerId)
      .all<ProjectRow>(),
  ]);
  return workspaceRows.results.map((row) => ({
    workspace: { id: row.id, name: row.name, createdAt: row.created_at },
    projects: projectRows.results.filter((project) => project.workspace_id === row.id).map(projectRecordOf),
  }));
}

export async function insertWorkspaceWithInbox({
  directory,
  ownerId,
  workspaceId,
  inboxId,
  name,
  inboxName,
  now,
}: {
  directory: D1Database;
  ownerId: string;
  workspaceId: string;
  inboxId: string;
  name: string;
  inboxName: string;
  now: number;
}): Promise<void> {
  await directory.batch([
    directory.prepare('INSERT INTO workspaces (id, owner_id, name, created_at) VALUES (?, ?, ?, ?)').bind(workspaceId, ownerId, name, now),
    directory
      .prepare('INSERT INTO projects (id, workspace_id, name, is_inbox, created_at) VALUES (?, ?, ?, 1, ?)')
      .bind(inboxId, workspaceId, inboxName, now),
  ]);
}

export async function updateWorkspaceName({
  directory,
  workspaceId,
  name,
}: {
  directory: D1Database;
  ownerId: string;
  workspaceId: string;
  name: string;
}): Promise<boolean> {
  await directory.prepare('UPDATE workspaces SET name = ? WHERE id = ?').bind(name, workspaceId).run();
  return true;
}

export async function findOwnerWorkspace(_parameters: {
  directory: D1Database;
  ownerId: string;
  workspaceId: string;
}): Promise<WorkspaceListing | null> {
  throw new Error('findOwnerWorkspace is not implemented');
}

export async function insertProject({
  directory,
  projectId,
  workspaceId,
  name,
  now,
}: {
  directory: D1Database;
  ownerId: string;
  projectId: string;
  workspaceId: string;
  name: string;
  now: number;
}): Promise<boolean> {
  await directory
    .prepare('INSERT INTO projects (id, workspace_id, name, is_inbox, created_at) VALUES (?, ?, ?, 0, ?)')
    .bind(projectId, workspaceId, name, now)
    .run();
  return true;
}

export async function findProject({ directory, projectId }: { directory: D1Database; projectId: string }): Promise<ProjectRecord | null> {
  const row = await directory
    .prepare('SELECT id, workspace_id, name, is_inbox, created_at FROM projects WHERE id = ?')
    .bind(projectId)
    .first<ProjectRow>();
  if (row === null) return null;
  return projectRecordOf(row);
}

export async function updateProjectName({
  directory,
  projectId,
  name,
}: {
  directory: D1Database;
  ownerId: string;
  projectId: string;
  name: string;
}): Promise<boolean> {
  await directory.prepare('UPDATE projects SET name = ? WHERE id = ? AND is_inbox = 0').bind(name, projectId).run();
  return true;
}
