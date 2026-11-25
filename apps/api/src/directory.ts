type KeyRow = { project_id: string; time_zone: string; agent_nudge: number };
type SessionRow = { owner_id: string };
type ProjectRow = { id: string };
type McpSessionRow = { client_name: string };

export type KeyProjectRecord = { projectId: string; timeZone: string; agentNudge: boolean };

export async function findKeyProject({ directory, digest }: { directory: D1Database; digest: string }): Promise<KeyProjectRecord | null> {
  const row = await directory
    .prepare(
      'SELECT project_keys.project_id, owners.time_zone, owners.agent_nudge FROM project_keys JOIN projects ON projects.id = project_keys.project_id JOIN workspaces ON workspaces.id = projects.workspace_id JOIN owners ON owners.id = workspaces.owner_id WHERE project_keys.digest = ? AND project_keys.revoked_at IS NULL',
    )
    .bind(digest)
    .first<KeyRow>();
  if (row === null) return null;
  return { projectId: row.project_id, timeZone: row.time_zone, agentNudge: row.agent_nudge === 1 };
}

export async function insertProjectKey({
  directory,
  digest,
  id,
  hint,
  projectId,
  now,
}: {
  directory: D1Database;
  digest: string;
  id: string;
  hint: string;
  projectId: string;
  now: number;
}): Promise<void> {
  await directory
    .prepare('INSERT INTO project_keys (digest, id, hint, project_id, created_at, revoked_at) VALUES (?, ?, ?, ?, ?, NULL)')
    .bind(digest, id, hint, projectId, now)
    .run();
}

export async function insertMcpSession({
  directory,
  digest,
  keyDigest,
  clientName,
  now,
  expiresAt,
  sessionsPerKeyMax,
}: {
  directory: D1Database;
  digest: string;
  keyDigest: string;
  clientName: string;
  now: number;
  expiresAt: number;
  sessionsPerKeyMax: number;
}): Promise<void> {
  await directory.batch([
    directory.prepare('DELETE FROM mcp_sessions WHERE key_digest = ? AND expires_at <= ?').bind(keyDigest, now),
    directory
      .prepare('INSERT INTO mcp_sessions (digest, key_digest, client_name, created_at, expires_at) VALUES (?, ?, ?, ?, ?)')
      .bind(digest, keyDigest, clientName, now, expiresAt),
    directory
      .prepare(
        'DELETE FROM mcp_sessions WHERE key_digest = ? AND digest <> ? AND digest NOT IN (SELECT digest FROM mcp_sessions WHERE key_digest = ? AND digest <> ? ORDER BY created_at DESC, rowid DESC LIMIT ?)',
      )
      .bind(keyDigest, digest, keyDigest, digest, sessionsPerKeyMax - 1),
  ]);
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
  const row = await directory
    .prepare('SELECT client_name FROM mcp_sessions WHERE digest = ? AND key_digest = ? AND expires_at > ?')
    .bind(digest, keyDigest, now)
    .first<McpSessionRow>();
  if (row === null) return null;
  return row.client_name;
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
