import type { ProjectRecord, WorkspaceRecord } from './owner-records';

type WorkspaceRow = { id: string; name: string; created_at: number };
type WorkspaceIdRow = { id: string };
type ProjectIdRow = { id: string };
type ProjectRow = { id: string; workspace_id: string; name: string; is_inbox: number; created_at: number };

export type WorkspaceListing = { workspace: WorkspaceRecord; projects: ProjectRecord[] };

function projectRecordOf(row: ProjectRow): ProjectRecord {
  return { id: row.id, name: row.name, isInbox: row.is_inbox === 1, createdAt: row.created_at };
}

function workspaceRecordOf(row: WorkspaceRow): WorkspaceRecord {
  return { id: row.id, name: row.name, createdAt: row.created_at };
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
    workspace: workspaceRecordOf(row),
    projects: projectRows.results.filter((project) => project.workspace_id === row.id).map(projectRecordOf),
  }));
}

export async function listWorkspaceProjects({
  directory,
  workspaceId,
}: {
  directory: D1Database;
  workspaceId: string;
}): Promise<ProjectRecord[]> {
  const { results } = await directory
    .prepare(
      'SELECT id, workspace_id, name, is_inbox, created_at FROM projects WHERE workspace_id = ? ORDER BY is_inbox DESC, created_at, rowid',
    )
    .bind(workspaceId)
    .all<ProjectRow>();
  return results.map(projectRecordOf);
}

export async function findWorkspaceProject({
  directory,
  workspaceId,
  projectId,
}: {
  directory: D1Database;
  workspaceId: string;
  projectId: string;
}): Promise<ProjectRecord | null> {
  const row = await directory
    .prepare('SELECT id, workspace_id, name, is_inbox, created_at FROM projects WHERE id = ? AND workspace_id = ?')
    .bind(projectId, workspaceId)
    .first<ProjectRow>();
  if (row === null) return null;
  return projectRecordOf(row);
}

export async function listOwnerProjectIds({ directory, ownerId }: { directory: D1Database; ownerId: string }): Promise<string[]> {
  const { results } = await directory
    .prepare('SELECT projects.id FROM projects JOIN workspaces ON workspaces.id = projects.workspace_id WHERE workspaces.owner_id = ?')
    .bind(ownerId)
    .all<ProjectIdRow>();
  return results.map((row) => row.id);
}

export async function findOwnerWorkspace({
  directory,
  ownerId,
  workspaceId,
}: {
  directory: D1Database;
  ownerId: string;
  workspaceId: string;
}): Promise<WorkspaceListing | null> {
  const [workspaceRow, projectRows] = await Promise.all([
    directory
      .prepare('SELECT id, name, created_at FROM workspaces WHERE id = ? AND owner_id = ?')
      .bind(workspaceId, ownerId)
      .first<WorkspaceRow>(),
    directory
      .prepare(
        'SELECT projects.id, projects.workspace_id, projects.name, projects.is_inbox, projects.created_at FROM projects JOIN workspaces ON workspaces.id = projects.workspace_id WHERE workspaces.id = ? AND workspaces.owner_id = ? ORDER BY projects.is_inbox DESC, projects.created_at, projects.rowid',
      )
      .bind(workspaceId, ownerId)
      .all<ProjectRow>(),
  ]);
  if (workspaceRow === null) return null;
  return { workspace: workspaceRecordOf(workspaceRow), projects: projectRows.results.map(projectRecordOf) };
}

export async function findOwnedWorkspace({
  directory,
  ownerId,
  workspaceId,
}: {
  directory: D1Database;
  ownerId: string;
  workspaceId: string;
}): Promise<string | null> {
  const row = await directory
    .prepare('SELECT id FROM workspaces WHERE id = ? AND owner_id = ?')
    .bind(workspaceId, ownerId)
    .first<WorkspaceIdRow>();
  if (row === null) return null;
  return row.id;
}

export async function insertWorkspaceWithInbox({
  directory,
  ownerId,
  workspaceId,
  inboxId,
  name,
  inboxName,
  now,
  workspacesPerOwnerMax,
}: {
  directory: D1Database;
  ownerId: string;
  workspaceId: string;
  inboxId: string;
  name: string;
  inboxName: string;
  now: number;
  workspacesPerOwnerMax: number;
}): Promise<boolean> {
  const [workspaceInsertion] = await directory.batch([
    directory
      .prepare(
        'INSERT INTO workspaces (id, owner_id, name, created_at) SELECT ?, ?, ?, ? WHERE (SELECT count(*) FROM workspaces WHERE owner_id = ?) < ?',
      )
      .bind(workspaceId, ownerId, name, now, ownerId, workspacesPerOwnerMax),
    directory
      .prepare('INSERT INTO projects (id, workspace_id, name, is_inbox, created_at) SELECT ?, id, ?, 1, ? FROM workspaces WHERE id = ?')
      .bind(inboxId, inboxName, now, workspaceId),
  ]);
  if (workspaceInsertion === undefined) throw new Error('the batch answered fewer results than statements');
  return workspaceInsertion.meta.changes > 0;
}

export async function updateWorkspaceName({
  directory,
  ownerId,
  workspaceId,
  name,
}: {
  directory: D1Database;
  ownerId: string;
  workspaceId: string;
  name: string;
}): Promise<boolean> {
  const result = await directory
    .prepare('UPDATE workspaces SET name = ? WHERE id = ? AND owner_id = ?')
    .bind(name, workspaceId, ownerId)
    .run();
  return result.meta.changes > 0;
}

export async function insertProject({
  directory,
  ownerId,
  projectId,
  workspaceId,
  name,
  now,
  projectsPerWorkspaceMax,
}: {
  directory: D1Database;
  ownerId: string;
  projectId: string;
  workspaceId: string;
  name: string;
  now: number;
  projectsPerWorkspaceMax: number;
}): Promise<boolean> {
  const result = await directory
    .prepare(
      'INSERT INTO projects (id, workspace_id, name, is_inbox, created_at) SELECT ?, id, ?, 0, ? FROM workspaces WHERE id = ? AND owner_id = ? AND (SELECT count(*) FROM projects WHERE workspace_id = ?) < ?',
    )
    .bind(projectId, name, now, workspaceId, ownerId, workspaceId, projectsPerWorkspaceMax)
    .run();
  return result.meta.changes > 0;
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
  ownerId,
  projectId,
  name,
}: {
  directory: D1Database;
  ownerId: string;
  projectId: string;
  name: string;
}): Promise<boolean> {
  const result = await directory
    .prepare(
      'UPDATE projects SET name = ? WHERE id = ? AND is_inbox = 0 AND workspace_id IN (SELECT id FROM workspaces WHERE owner_id = ?)',
    )
    .bind(name, projectId, ownerId)
    .run();
  return result.meta.changes > 0;
}
