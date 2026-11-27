type SessionRow = { owner_id: string; suspended_at: number | null };
type SessionProjectRow = { owner_id: string; project_id: string | null; suspended_at: number | null };
type ProjectRow = { id: string };

const SESSION_OWNER_QUERY =
  'SELECT sessions.owner_id, owners.suspended_at FROM sessions JOIN owners ON owners.id = sessions.owner_id WHERE sessions.digest = ? AND sessions.expires_at > ?';
const SESSION_PROJECT_QUERY =
  'SELECT sessions.owner_id, owners.suspended_at, (SELECT projects.id FROM projects JOIN workspaces ON workspaces.id = projects.workspace_id WHERE projects.id = ? AND workspaces.owner_id = sessions.owner_id) AS project_id FROM sessions JOIN owners ON owners.id = sessions.owner_id WHERE sessions.digest = ? AND sessions.expires_at > ?';

export type GrantProjectRecord = {
  projectId: string;
  workspaceId: string;
  timeZone: string;
  agentNudge: boolean;
  ownerId: string;
  isSuspended: boolean;
};

export type SessionOwnerRecord = { ownerId: string; isSuspended: boolean };

export type SessionProjectRecord = SessionOwnerRecord & { ownedProjectId: string | null };

export async function findSessionOwner({
  directory,
  digest,
  now,
}: {
  directory: D1Database;
  digest: string;
  now: number;
}): Promise<SessionOwnerRecord | null> {
  const row = await directory.prepare(SESSION_OWNER_QUERY).bind(digest, now).first<SessionRow>();
  if (row === null) return null;
  return { ownerId: row.owner_id, isSuspended: row.suspended_at !== null };
}

export async function findSessionProject({
  directory,
  digest,
  projectId,
  now,
}: {
  directory: D1Database;
  digest: string;
  projectId: string;
  now: number;
}): Promise<SessionProjectRecord | null> {
  const row = await directory.prepare(SESSION_PROJECT_QUERY).bind(projectId, digest, now).first<SessionProjectRow>();
  if (row === null) return null;
  return { ownerId: row.owner_id, isSuspended: row.suspended_at !== null, ownedProjectId: row.project_id };
}

export async function findOwnedProject({
  directory,
  ownerId,
  projectId,
}: {
  directory: D1Database;
  ownerId: string;
  projectId: string;
}): Promise<string | null> {
  const row = await directory
    .prepare(
      'SELECT projects.id FROM projects JOIN workspaces ON workspaces.id = projects.workspace_id WHERE projects.id = ? AND workspaces.owner_id = ?',
    )
    .bind(projectId, ownerId)
    .first<ProjectRow>();
  if (row === null) return null;
  return row.id;
}
