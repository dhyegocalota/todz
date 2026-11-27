import { z } from 'zod';
import { parsedJson } from '../parsed-json';

export enum OAuthTokenKind {
  Access = 'access',
  Refresh = 'refresh',
}

export type OAuthClientRecord = { id: string; name: string; redirectUris: string[] };

export type OAuthCodeRecord = {
  clientId: string;
  ownerId: string;
  projectId: string | null;
  redirectUri: string;
  codeChallenge: string;
  expiresAt: number;
};

export type StoredToken = { digest: string; kind: OAuthTokenKind; expiresAt: number };

export type AccessGrantRecord = {
  grantId: string;
  clientName: string;
  ownerId: string;
  isSuspended: boolean;
  timeZone: string;
  agentNudge: boolean;
  projectId: string | null;
  workspaceId: string | null;
};

export type ConnectedAppRecord = {
  id: string;
  clientName: string;
  redirectUri: string;
  projectId: string | null;
  projectName: string | null;
  createdAt: number;
  lastUsedAt: number;
};

type ClientRow = { id: string; name: string; redirect_uris: string };
type CodeRow = {
  client_id: string;
  owner_id: string;
  project_id: string | null;
  redirect_uri: string;
  code_challenge: string;
  expires_at: number;
};
type AccessGrantRow = {
  grant_id: string;
  client_name: string;
  owner_id: string;
  suspended_at: number | null;
  time_zone: string;
  agent_nudge: number;
  project_id: string | null;
  workspace_id: string | null;
};
type ConnectedAppRow = {
  id: string;
  client_name: string;
  redirect_uri: string;
  project_id: string | null;
  project_name: string | null;
  created_at: number;
  last_used_at: number;
};

const RedirectUrisSchema = z.array(z.string());

const ACTIVE_CLIENT_QUERY =
  'SELECT id, name, redirect_uris FROM oauth_clients WHERE id = ? AND (active_at > ? OR EXISTS (SELECT 1 FROM oauth_grants WHERE oauth_grants.client_id = oauth_clients.id))';
const ACCESS_GRANT_QUERY = `SELECT oauth_grants.id AS grant_id, oauth_clients.name AS client_name, owners.id AS owner_id, owners.suspended_at, owners.time_zone, owners.agent_nudge, oauth_grants.project_id, projects.workspace_id
FROM oauth_tokens
JOIN oauth_grants ON oauth_grants.id = oauth_tokens.grant_id
JOIN oauth_clients ON oauth_clients.id = oauth_grants.client_id
JOIN owners ON owners.id = oauth_grants.owner_id
LEFT JOIN projects ON projects.id = oauth_grants.project_id
LEFT JOIN workspaces ON workspaces.id = projects.workspace_id
WHERE oauth_tokens.digest = ? AND oauth_tokens.kind = ? AND oauth_tokens.expires_at > ? AND (oauth_grants.project_id IS NULL OR workspaces.owner_id = oauth_grants.owner_id)`;
const CLIENT_GRANTS = 'SELECT id FROM oauth_grants WHERE client_id = ?';

function onlyResultOf<Row>(result: D1Result<unknown> | undefined): Row | null {
  if (result === undefined) throw new Error('the batch answers one result per statement');
  const [row] = result.results;
  if (row === undefined) return null;
  return row as Row;
}

export async function insertClient({
  directory,
  id,
  name,
  redirectUris,
  now,
}: {
  directory: D1Database;
  id: string;
  name: string;
  redirectUris: string[];
  now: number;
}): Promise<void> {
  await directory
    .prepare('INSERT INTO oauth_clients (id, name, redirect_uris, created_at, active_at) VALUES (?, ?, ?, ?, ?)')
    .bind(id, name, JSON.stringify(redirectUris), now, now)
    .run();
}

// NB ADR 0109: a registration with no grant and no token issued for 30 days is unknown, so the nightly run may delete it.
export async function findActiveClient({
  directory,
  clientId,
  activeSince,
}: {
  directory: D1Database;
  clientId: string;
  activeSince: number;
}): Promise<OAuthClientRecord | null> {
  const row = await directory.prepare(ACTIVE_CLIENT_QUERY).bind(clientId, activeSince).first<ClientRow>();
  if (row === null) return null;
  const redirectUris = RedirectUrisSchema.safeParse(parsedJson(row.redirect_uris));
  if (!redirectUris.success) throw new Error('a stored client has unreadable redirect URIs');
  return { id: row.id, name: row.name, redirectUris: redirectUris.data };
}

export async function insertOAuthSession({
  directory,
  digest,
  ownerId,
  now,
  expiresAt,
}: {
  directory: D1Database;
  digest: string;
  ownerId: string;
  now: number;
  expiresAt: number;
}): Promise<void> {
  await directory.batch([
    directory.prepare('DELETE FROM oauth_sessions WHERE expires_at <= ?').bind(now),
    directory
      .prepare('INSERT INTO oauth_sessions (digest, owner_id, created_at, expires_at) VALUES (?, ?, ?, ?)')
      .bind(digest, ownerId, now, expiresAt),
  ]);
}

export async function findOAuthSessionOwner({
  directory,
  digest,
  now,
}: {
  directory: D1Database;
  digest: string;
  now: number;
}): Promise<string | null> {
  const row = await directory
    .prepare('SELECT owner_id FROM oauth_sessions WHERE digest = ? AND expires_at > ?')
    .bind(digest, now)
    .first<{ owner_id: string }>();
  if (row === null) return null;
  return row.owner_id;
}

export async function insertCode({
  directory,
  digest,
  code,
}: {
  directory: D1Database;
  digest: string;
  code: OAuthCodeRecord;
}): Promise<void> {
  await directory
    .prepare(
      'INSERT INTO oauth_codes (digest, client_id, owner_id, project_id, redirect_uri, code_challenge, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    )
    .bind(digest, code.clientId, code.ownerId, code.projectId, code.redirectUri, code.codeChallenge, code.expiresAt)
    .run();
}

// NB ADR 0109: one statement spends a code, so a second exchange of it never finds it unspent.
export async function spendCode({
  directory,
  digest,
  now,
}: {
  directory: D1Database;
  digest: string;
  now: number;
}): Promise<OAuthCodeRecord | null> {
  const row = await directory
    .prepare(
      'UPDATE oauth_codes SET consumed_at = ? WHERE digest = ? AND consumed_at IS NULL RETURNING client_id, owner_id, project_id, redirect_uri, code_challenge, expires_at',
    )
    .bind(now, digest)
    .first<CodeRow>();
  if (row === null) return null;
  return {
    clientId: row.client_id,
    ownerId: row.owner_id,
    projectId: row.project_id,
    redirectUri: row.redirect_uri,
    codeChallenge: row.code_challenge,
    expiresAt: row.expires_at,
  };
}

// NB ADR 0109: a spent code presented again deletes the grant it produced, and its tokens go with it.
export async function revokeGrantOfSpentCode({ directory, digest }: { directory: D1Database; digest: string }): Promise<void> {
  await directory
    .prepare('DELETE FROM oauth_grants WHERE id = (SELECT grant_id FROM oauth_codes WHERE digest = ? AND consumed_at IS NOT NULL)')
    .bind(digest)
    .run();
}

function tokenInsertion({ directory, grantId, token, now }: { directory: D1Database; grantId: string; token: StoredToken; now: number }) {
  return directory
    .prepare('INSERT INTO oauth_tokens (digest, grant_id, kind, created_at, expires_at) VALUES (?, ?, ?, ?, ?)')
    .bind(token.digest, grantId, token.kind, now, token.expiresAt);
}

function clientActivity({ directory, grantId, now }: { directory: D1Database; grantId: string; now: number }) {
  return directory
    .prepare('UPDATE oauth_clients SET active_at = ? WHERE id = (SELECT client_id FROM oauth_grants WHERE id = ?)')
    .bind(now, grantId);
}

// NB ADR 0109: an owner keeps at most the newest grants by last use; storing one evicts the rest in the same batch.
export async function insertGrant({
  directory,
  grantId,
  codeDigest,
  code,
  tokens,
  now,
  grantsPerOwnerMax,
}: {
  directory: D1Database;
  grantId: string;
  codeDigest: string;
  code: OAuthCodeRecord;
  tokens: StoredToken[];
  now: number;
  grantsPerOwnerMax: number;
}): Promise<void> {
  await directory.batch([
    directory
      .prepare(
        'INSERT INTO oauth_grants (id, client_id, owner_id, project_id, redirect_uri, created_at, last_used_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      )
      .bind(grantId, code.clientId, code.ownerId, code.projectId, code.redirectUri, now, now),
    directory.prepare('UPDATE oauth_codes SET grant_id = ? WHERE digest = ?').bind(grantId, codeDigest),
    ...tokens.map((token) => tokenInsertion({ directory, grantId, token, now })),
    clientActivity({ directory, grantId, now }),
    directory
      .prepare(
        'DELETE FROM oauth_grants WHERE owner_id = ? AND id NOT IN (SELECT id FROM oauth_grants WHERE owner_id = ? ORDER BY last_used_at DESC, rowid DESC LIMIT ?)',
      )
      .bind(code.ownerId, code.ownerId, grantsPerOwnerMax),
  ]);
}

// NB ADR 0109: one statement spends a refresh token, and only for the client its grant belongs to.
export async function spendRefreshToken({
  directory,
  digest,
  clientId,
  now,
}: {
  directory: D1Database;
  digest: string;
  clientId: string;
  now: number;
}): Promise<string | null> {
  const row = await directory
    .prepare(
      `UPDATE oauth_tokens SET spent_at = ? WHERE digest = ? AND kind = ? AND spent_at IS NULL AND expires_at > ? AND grant_id IN (${CLIENT_GRANTS}) RETURNING grant_id`,
    )
    .bind(now, digest, OAuthTokenKind.Refresh, now, clientId)
    .first<{ grant_id: string }>();
  if (row === null) return null;
  return row.grant_id;
}

// NB ADR 0109: a spent refresh token presented again deletes its whole grant, the family.
export async function revokeGrantOfSpentRefreshToken({
  directory,
  digest,
  clientId,
}: {
  directory: D1Database;
  digest: string;
  clientId: string;
}): Promise<void> {
  await directory
    .prepare(
      `DELETE FROM oauth_grants WHERE id = (SELECT grant_id FROM oauth_tokens WHERE digest = ? AND kind = ? AND spent_at IS NOT NULL AND grant_id IN (${CLIENT_GRANTS}))`,
    )
    .bind(digest, OAuthTokenKind.Refresh, clientId)
    .run();
}

// NB ADR 0109: a refresh replaces the grant's access tokens and keeps only the refresh token it spent, for reuse detection.
export async function rotateTokens({
  directory,
  grantId,
  spentDigest,
  tokens,
  now,
}: {
  directory: D1Database;
  grantId: string;
  spentDigest: string;
  tokens: StoredToken[];
  now: number;
}): Promise<string | null> {
  const results = await directory.batch([
    directory.prepare('DELETE FROM oauth_tokens WHERE grant_id = ? AND kind = ?').bind(grantId, OAuthTokenKind.Access),
    directory
      .prepare('DELETE FROM oauth_tokens WHERE grant_id = ? AND kind = ? AND spent_at IS NOT NULL AND digest <> ?')
      .bind(grantId, OAuthTokenKind.Refresh, spentDigest),
    ...tokens.map((token) => tokenInsertion({ directory, grantId, token, now })),
    directory.prepare('UPDATE oauth_grants SET last_used_at = ? WHERE id = ?').bind(now, grantId),
    clientActivity({ directory, grantId, now }),
    directory.prepare('SELECT project_id FROM oauth_grants WHERE id = ?').bind(grantId),
  ]);
  const grant = onlyResultOf<{ project_id: string | null }>(results.at(-1));
  if (grant === null) throw new Error('a rotated grant has no row');
  return grant.project_id;
}

export async function findAccessGrant({
  directory,
  digest,
  now,
}: {
  directory: D1Database;
  digest: string;
  now: number;
}): Promise<AccessGrantRecord | null> {
  const row = await directory.prepare(ACCESS_GRANT_QUERY).bind(digest, OAuthTokenKind.Access, now).first<AccessGrantRow>();
  if (row === null) return null;
  return {
    grantId: row.grant_id,
    clientName: row.client_name,
    ownerId: row.owner_id,
    isSuspended: row.suspended_at !== null,
    timeZone: row.time_zone,
    agentNudge: row.agent_nudge === 1,
    projectId: row.project_id,
    workspaceId: row.workspace_id,
  };
}

export async function revokeGrantOfToken({
  directory,
  digest,
  clientId,
}: {
  directory: D1Database;
  digest: string;
  clientId: string;
}): Promise<void> {
  await directory
    .prepare(`DELETE FROM oauth_grants WHERE id = (SELECT grant_id FROM oauth_tokens WHERE digest = ? AND grant_id IN (${CLIENT_GRANTS}))`)
    .bind(digest, clientId)
    .run();
}

export async function listConnectedApps({ directory, ownerId }: { directory: D1Database; ownerId: string }): Promise<ConnectedAppRecord[]> {
  const { results } = await directory
    .prepare(
      'SELECT oauth_grants.id, oauth_clients.name AS client_name, oauth_grants.redirect_uri, oauth_grants.project_id, projects.name AS project_name, oauth_grants.created_at, oauth_grants.last_used_at FROM oauth_grants JOIN oauth_clients ON oauth_clients.id = oauth_grants.client_id LEFT JOIN projects ON projects.id = oauth_grants.project_id WHERE oauth_grants.owner_id = ? ORDER BY oauth_grants.created_at DESC, oauth_grants.rowid DESC',
    )
    .bind(ownerId)
    .all<ConnectedAppRow>();
  return results.map((row) => ({
    id: row.id,
    clientName: row.client_name,
    redirectUri: row.redirect_uri,
    projectId: row.project_id,
    projectName: row.project_name,
    createdAt: row.created_at,
    lastUsedAt: row.last_used_at,
  }));
}

export async function deleteConnectedApp({
  directory,
  ownerId,
  grantId,
}: {
  directory: D1Database;
  ownerId: string;
  grantId: string;
}): Promise<boolean> {
  const deletion = await directory.prepare('DELETE FROM oauth_grants WHERE id = ? AND owner_id = ?').bind(grantId, ownerId).run();
  return deletion.meta.changes > 0;
}

export async function deleteSpentOAuthRows({
  directory,
  now,
  idleSince,
}: {
  directory: D1Database;
  now: number;
  idleSince: number;
}): Promise<void> {
  await directory.batch([
    directory.prepare('DELETE FROM oauth_codes WHERE expires_at <= ?').bind(now),
    directory.prepare('DELETE FROM oauth_sessions WHERE expires_at <= ?').bind(now),
    directory.prepare('DELETE FROM oauth_tokens WHERE expires_at <= ?').bind(now),
    directory
      .prepare(
        'DELETE FROM oauth_clients WHERE active_at <= ? AND NOT EXISTS (SELECT 1 FROM oauth_grants WHERE oauth_grants.client_id = oauth_clients.id)',
      )
      .bind(idleSince),
  ]);
}
