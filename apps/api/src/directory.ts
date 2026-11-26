type KeyRow = { project_id: string; workspace_id: string; time_zone: string; agent_nudge: number };
type SessionRow = { owner_id: string };
type SessionProjectRow = { owner_id: string; project_id: string | null };
type ProjectRow = { id: string };
type McpSessionRow = { client_name: string };

const KEY_PROJECT_QUERY =
  'SELECT project_keys.project_id, projects.workspace_id, owners.time_zone, owners.agent_nudge FROM project_keys JOIN projects ON projects.id = project_keys.project_id JOIN workspaces ON workspaces.id = projects.workspace_id JOIN owners ON owners.id = workspaces.owner_id WHERE project_keys.digest = ? AND project_keys.revoked_at IS NULL';
const MCP_SESSION_QUERY = 'SELECT client_name FROM mcp_sessions WHERE digest = ? AND key_digest = ? AND expires_at > ?';
const SESSION_PROJECT_QUERY =
  'SELECT sessions.owner_id, (SELECT projects.id FROM projects JOIN workspaces ON workspaces.id = projects.workspace_id WHERE projects.id = ? AND workspaces.owner_id = sessions.owner_id) AS project_id FROM sessions WHERE sessions.digest = ? AND sessions.expires_at > ?';

export type KeyProjectRecord = { projectId: string; workspaceId: string; timeZone: string; agentNudge: boolean };

export type KeyProjectSessionRecord = { keyProject: KeyProjectRecord | null; sessionClientName: string | null };

export type SessionProjectRecord = { ownerId: string; ownedProjectId: string | null };

function keyProjectRecordOf(row: KeyRow | null): KeyProjectRecord | null {
  if (row === null) return null;
  return { projectId: row.project_id, workspaceId: row.workspace_id, timeZone: row.time_zone, agentNudge: row.agent_nudge === 1 };
}

function onlyRowOf<Row>(result: D1Result<unknown> | undefined): Row | null {
  if (result === undefined) throw new Error('the batch answered fewer results than statements');
  const [row] = result.results;
  if (row === undefined) return null;
  return row as Row;
}

export async function findKeyProject({ directory, digest }: { directory: D1Database; digest: string }): Promise<KeyProjectRecord | null> {
  return keyProjectRecordOf(await directory.prepare(KEY_PROJECT_QUERY).bind(digest).first<KeyRow>());
}

export async function findKeyProjectAndSession({
  directory,
  digest,
  sessionDigest,
  now,
}: {
  directory: D1Database;
  digest: string;
  sessionDigest: string;
  now: number;
}): Promise<KeyProjectSessionRecord> {
  const [keyResult, sessionResult] = await directory.batch([
    directory.prepare(KEY_PROJECT_QUERY).bind(digest),
    directory.prepare(MCP_SESSION_QUERY).bind(sessionDigest, digest, now),
  ]);
  const sessionRow = onlyRowOf<McpSessionRow>(sessionResult);
  return {
    keyProject: keyProjectRecordOf(onlyRowOf<KeyRow>(keyResult)),
    sessionClientName: sessionRow === null ? null : sessionRow.client_name,
  };
}

export async function insertProjectKey({
  directory,
  digest,
  id,
  hint,
  projectId,
  now,
  liveKeysPerProjectMax,
}: {
  directory: D1Database;
  digest: string;
  id: string;
  hint: string;
  projectId: string;
  now: number;
  liveKeysPerProjectMax: number;
}): Promise<boolean> {
  const insertion = await directory
    .prepare(
      'INSERT INTO project_keys (digest, id, hint, project_id, created_at, revoked_at) SELECT ?, ?, ?, ?, ?, NULL WHERE (SELECT count(*) FROM project_keys WHERE project_id = ? AND revoked_at IS NULL) < ?',
    )
    .bind(digest, id, hint, projectId, now, projectId, liveKeysPerProjectMax)
    .run();
  return insertion.meta.changes > 0;
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
  const row = await directory.prepare(MCP_SESSION_QUERY).bind(digest, keyDigest, now).first<McpSessionRow>();
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
  return { ownerId: row.owner_id, ownedProjectId: row.project_id };
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
