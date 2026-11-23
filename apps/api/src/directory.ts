type KeyRow = { project_id: string };
type SessionRow = { owner_id: string };
type ProjectRow = { id: string };

export async function findKeyProject({ directory, digest }: { directory: D1Database; digest: string }): Promise<string | null> {
  const row = await directory
    .prepare('SELECT project_id FROM project_keys WHERE digest = ? AND revoked_at IS NULL')
    .bind(digest)
    .first<KeyRow>();
  if (row === null) return null;
  return row.project_id;
}

export async function findSessionOwner({
  directory,
  digest,
  now,
}: {
  directory: D1Database;
  digest: string;
  now: number;
}): Promise<string | null> {
  const row = await directory
    .prepare('SELECT owner_id FROM sessions WHERE digest = ? AND expires_at > ?')
    .bind(digest, now)
    .first<SessionRow>();
  if (row === null) return null;
  return row.owner_id;
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
