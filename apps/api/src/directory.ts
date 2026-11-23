type SessionRow = { owner_id: string };
type ProjectRow = { id: string };

export type KeyProjectRecord = { projectId: string; timeZone: string };

export async function findKeyProject({ directory, digest }: { directory: D1Database; digest: string }): Promise<KeyProjectRecord | null> {
  throw new Error('findKeyProject is not implemented');
}

export async function insertProjectKey({
  directory,
  digest,
  projectId,
  now,
}: {
  directory: D1Database;
  digest: string;
  projectId: string;
  now: number;
}): Promise<void> {
  await directory
    .prepare('INSERT INTO project_keys (digest, project_id, created_at, revoked_at) VALUES (?, ?, ?, NULL)')
    .bind(digest, projectId, now)
    .run();
}

export async function insertMcpSession({
  directory,
  digest,
  keyDigest,
  clientName,
  now,
  expiresAt,
}: {
  directory: D1Database;
  digest: string;
  keyDigest: string;
  clientName: string;
  now: number;
  expiresAt: number;
}): Promise<void> {
  throw new Error('insertMcpSession is not implemented');
}

export async function findMcpSessionClient({
  directory,
  digest,
  keyDigest,
  now,
}: {
  directory: D1Database;
  digest: string;
  keyDigest: string;
  now: number;
}): Promise<string | null> {
  throw new Error('findMcpSessionClient is not implemented');
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
