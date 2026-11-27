import { z } from 'zod';
import { parsedJson } from '../parsed-json';
import {
  OAUTH_IDLE_CLIENT_LIFETIME_MS,
  OAUTH_LIVE_ACCESS_TOKENS_PER_GRANT_MAX,
  OAUTH_SPENT_REFRESH_TOKENS_PER_GRANT_MAX,
  OAUTH_UNUSED_CLIENT_LIFETIME_MS,
} from './oauth-paths';

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

const CLIENT_HAS_GRANT = 'EXISTS (SELECT 1 FROM oauth_grants WHERE oauth_grants.client_id = oauth_clients.id)';
const CLIENT_IS_LIVE = `(${CLIENT_HAS_GRANT} OR (active_at > created_at AND active_at > ?) OR created_at > ?)`;
const ACTIVE_CLIENT_QUERY = `SELECT id, name, redirect_uris FROM oauth_clients WHERE id = ? AND ${CLIENT_IS_LIVE}`;
const ACCESS_GRANT_QUERY = `SELECT oauth_grants.id AS grant_id, oauth_clients.name AS client_name, owners.id AS owner_id, owners.suspended_at, owners.time_zone, owners.agent_nudge, oauth_grants.project_id, projects.workspace_id
FROM oauth_tokens
JOIN oauth_grants ON oauth_grants.id = oauth_tokens.grant_id
JOIN oauth_clients ON oauth_clients.id = oauth_grants.client_id
JOIN owners ON owners.id = oauth_grants.owner_id
LEFT JOIN projects ON projects.id = oauth_grants.project_id
LEFT JOIN workspaces ON workspaces.id = projects.workspace_id
WHERE oauth_tokens.digest = ? AND oauth_tokens.kind = ? AND oauth_tokens.expires_at > ? AND (oauth_grants.project_id IS NULL OR workspaces.owner_id = oauth_grants.owner_id)`;
const CLIENT_GRANTS = 'SELECT id FROM oauth_grants WHERE client_id = ?';
const GRANT_EXISTS = 'EXISTS (SELECT 1 FROM oauth_grants WHERE id = ?)';
const IS_SUPERSEDED =
  '(EXISTS (SELECT 1 FROM oauth_tokens AS successor WHERE successor.kind = ? AND successor.spent_at IS NOT NULL AND successor.digest <> oauth_tokens.digest AND (successor.parent_digest = oauth_tokens.digest OR successor.parent_digest = oauth_tokens.parent_digest)))';
const RETURNING_CLIENT = 'RETURNING client_id';
const CAP_STATEMENT_INDEX = 2;

type ClientIdRow = { client_id: string };

export type InsertedGrant = { isGranted: boolean; evictedClientIds: string[] };

function onlyResultOf<Row>(result: D1Result<unknown> | undefined): Row | null {
  if (result === undefined) throw new Error('the batch answers one result per statement');
  const [row] = result.results;
  if (row === undefined) return null;
  return row as Row;
}

function deletedClientIdsOf(result: D1Result<unknown> | undefined): string[] {
  if (result === undefined) throw new Error('the batch answers one result per statement');
  return (result.results as ClientIdRow[]).map((row) => row.client_id);
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

// NB ADR 0109: a registration never used lasts a day, one with no grant lasts 30 days after its last token, so the nightly run may delete the rest.
export async function findActiveClient({
  directory,
  clientId,
  now,
}: {
  directory: D1Database;
  clientId: string;
  now: number;
}): Promise<OAuthClientRecord | null> {
  const row = await directory
    .prepare(ACTIVE_CLIENT_QUERY)
    .bind(clientId, now - OAUTH_IDLE_CLIENT_LIFETIME_MS, now - OAUTH_UNUSED_CLIENT_LIFETIME_MS)
    .first<ClientRow>();
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

export async function hasIssuedCode({
  directory,
  clientId,
  redirectUri,
  codeChallenge,
}: {
  directory: D1Database;
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
}): Promise<boolean> {
  const row = await directory
    .prepare('SELECT 1 AS issued FROM oauth_codes WHERE client_id = ? AND redirect_uri = ? AND code_challenge = ? LIMIT 1')
    .bind(clientId, redirectUri, codeChallenge)
    .first<{ issued: number }>();
  return row !== null;
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

// NB ADR 0109: a spent code presented again is marked replayed and deletes the grant it produced; a grant whose code is marked is never stored.
export async function revokeReplayedCode({
  directory,
  digest,
  now,
}: {
  directory: D1Database;
  digest: string;
  now: number;
}): Promise<string[]> {
  const [, deletion] = await directory.batch([
    directory.prepare('UPDATE oauth_codes SET replayed_at = ? WHERE digest = ? AND consumed_at IS NOT NULL').bind(now, digest),
    directory
      .prepare(
        `DELETE FROM oauth_grants WHERE id = (SELECT grant_id FROM oauth_codes WHERE digest = ? AND consumed_at IS NOT NULL) ${RETURNING_CLIENT}`,
      )
      .bind(digest),
  ]);
  return deletedClientIdsOf(deletion);
}

function tokenInsertion({
  directory,
  grantId,
  token,
  now,
  parentDigest,
}: {
  directory: D1Database;
  grantId: string;
  token: StoredToken;
  now: number;
  parentDigest: string | null;
}) {
  return directory
    .prepare(
      `INSERT INTO oauth_tokens (digest, grant_id, kind, created_at, expires_at, parent_digest) SELECT ?, ?, ?, ?, ?, ? WHERE ${GRANT_EXISTS}`,
    )
    .bind(token.digest, grantId, token.kind, now, token.expiresAt, parentDigest, grantId);
}

function tokensBeyondNewest({
  directory,
  grantId,
  kind,
  keep,
}: {
  directory: D1Database;
  grantId: string;
  kind: OAuthTokenKind;
  keep: number;
}) {
  return directory
    .prepare(
      'DELETE FROM oauth_tokens WHERE grant_id = ? AND kind = ? AND digest NOT IN (SELECT digest FROM oauth_tokens WHERE grant_id = ? AND kind = ? ORDER BY created_at DESC, rowid DESC LIMIT ?)',
    )
    .bind(grantId, kind, grantId, kind, keep);
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
}): Promise<InsertedGrant> {
  const results = await directory.batch([
    directory
      .prepare(
        'INSERT INTO oauth_grants (id, client_id, owner_id, project_id, redirect_uri, created_at, last_used_at) SELECT ?, ?, ?, ?, ?, ?, ? WHERE NOT EXISTS (SELECT 1 FROM oauth_codes WHERE digest = ? AND replayed_at IS NOT NULL)',
      )
      .bind(grantId, code.clientId, code.ownerId, code.projectId, code.redirectUri, now, now, codeDigest),
    directory.prepare(`UPDATE oauth_codes SET grant_id = ? WHERE digest = ? AND ${GRANT_EXISTS}`).bind(grantId, codeDigest, grantId),
    ...tokens.map((token) => tokenInsertion({ directory, grantId, token, now, parentDigest: null })),
    clientActivity({ directory, grantId, now }),
    directory
      .prepare(
        `DELETE FROM oauth_grants WHERE owner_id = ? AND id NOT IN (SELECT id FROM oauth_grants WHERE owner_id = ? ORDER BY last_used_at DESC, rowid DESC LIMIT ?) ${RETURNING_CLIENT}`,
      )
      .bind(code.ownerId, code.ownerId, grantsPerOwnerMax),
  ]);
  const [grantInsertion] = results;
  if (grantInsertion === undefined) throw new Error('the batch answers one result per statement');
  return { isGranted: grantInsertion.meta.changes > 0, evictedClientIds: deletedClientIdsOf(results.at(-1)) };
}

// NB ADR 0125: one statement spends a refresh token for the client its grant belongs to, and honours it again until a token issued from it or a sibling of it is spent.
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
      `UPDATE oauth_tokens SET spent_at = coalesce(spent_at, ?) WHERE digest = ? AND kind = ? AND expires_at > ? AND grant_id IN (${CLIENT_GRANTS}) AND NOT ${IS_SUPERSEDED} RETURNING grant_id`,
    )
    .bind(now, digest, OAuthTokenKind.Refresh, now, clientId, OAuthTokenKind.Refresh)
    .first<{ grant_id: string }>();
  if (row === null) return null;
  return row.grant_id;
}

// NB ADR 0125: a refresh token presented after a token issued from it or a sibling of it was spent deletes its whole grant, the family.
export async function revokeGrantOfSupersededRefreshToken({
  directory,
  digest,
  clientId,
}: {
  directory: D1Database;
  digest: string;
  clientId: string;
}): Promise<string[]> {
  const { results } = await directory
    .prepare(
      `DELETE FROM oauth_grants WHERE id = (SELECT grant_id FROM oauth_tokens WHERE digest = ? AND kind = ? AND grant_id IN (${CLIENT_GRANTS}) AND ${IS_SUPERSEDED}) ${RETURNING_CLIENT}`,
    )
    .bind(digest, OAuthTokenKind.Refresh, clientId, OAuthTokenKind.Refresh)
    .all<ClientIdRow>();
  return results.map((row) => row.client_id);
}

export type RotatedGrant = { projectId: string | null };

export type Rotation = { grant: RotatedGrant | null; cappedClientIds: string[] };

function grantAtSpentRefreshCap({ directory, grantId }: { directory: D1Database; grantId: string }) {
  return directory
    .prepare(
      `DELETE FROM oauth_grants WHERE id = ? AND (SELECT count(*) FROM oauth_tokens WHERE grant_id = ? AND kind = ?) >= ? ${RETURNING_CLIENT}`,
    )
    .bind(grantId, grantId, OAuthTokenKind.Refresh, OAUTH_SPENT_REFRESH_TOKENS_PER_GRANT_MAX);
}

// NB ADR 0109: a refresh keeps the live access tokens until they expire and every unexpired spent refresh token for reuse detection; a grant that reaches the cap is revoked instead of forgetting one.
export async function rotateTokens({
  directory,
  grantId,
  tokens,
  now,
  parentDigest,
}: {
  directory: D1Database;
  grantId: string;
  tokens: StoredToken[];
  now: number;
  parentDigest: string;
}): Promise<Rotation> {
  const results = await directory.batch([
    directory.prepare('DELETE FROM oauth_tokens WHERE grant_id = ? AND expires_at <= ?').bind(grantId, now),
    tokensBeyondNewest({ directory, grantId, kind: OAuthTokenKind.Access, keep: OAUTH_LIVE_ACCESS_TOKENS_PER_GRANT_MAX - 1 }),
    grantAtSpentRefreshCap({ directory, grantId }),
    ...tokens.map((token) => tokenInsertion({ directory, grantId, token, now, parentDigest })),
    directory.prepare('UPDATE oauth_grants SET last_used_at = ? WHERE id = ?').bind(now, grantId),
    clientActivity({ directory, grantId, now }),
    directory.prepare('SELECT project_id FROM oauth_grants WHERE id = ?').bind(grantId),
  ]);
  const cappedClientIds = deletedClientIdsOf(results[CAP_STATEMENT_INDEX]);
  const grant = onlyResultOf<{ project_id: string | null }>(results.at(-1));
  if (grant === null) return { grant: null, cappedClientIds };
  return { grant: { projectId: grant.project_id }, cappedClientIds };
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
}): Promise<string[]> {
  const { results } = await directory
    .prepare(
      `DELETE FROM oauth_grants WHERE id = (SELECT grant_id FROM oauth_tokens WHERE digest = ? AND grant_id IN (${CLIENT_GRANTS})) ${RETURNING_CLIENT}`,
    )
    .bind(digest, clientId)
    .all<ClientIdRow>();
  return results.map((row) => row.client_id);
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
}): Promise<string[]> {
  const { results } = await directory
    .prepare(`DELETE FROM oauth_grants WHERE id = ? AND owner_id = ? ${RETURNING_CLIENT}`)
    .bind(grantId, ownerId)
    .all<ClientIdRow>();
  return results.map((row) => row.client_id);
}

export async function clientIdsOfProjectGrants({ directory, projectId }: { directory: D1Database; projectId: string }): Promise<string[]> {
  const { results } = await directory.prepare('SELECT client_id FROM oauth_grants WHERE project_id = ?').bind(projectId).all<ClientIdRow>();
  return results.map((row) => row.client_id);
}

export async function clientIdsOfWorkspaceGrants({
  directory,
  workspaceId,
}: {
  directory: D1Database;
  workspaceId: string;
}): Promise<string[]> {
  const { results } = await directory
    .prepare('SELECT client_id FROM oauth_grants WHERE project_id IN (SELECT id FROM projects WHERE workspace_id = ?)')
    .bind(workspaceId)
    .all<ClientIdRow>();
  return results.map((row) => row.client_id);
}

export async function clientNamesOf({ directory, clientIds }: { directory: D1Database; clientIds: string[] }): Promise<string[]> {
  const { results } = await directory
    .prepare('SELECT oauth_clients.name FROM json_each(?) AS deleted JOIN oauth_clients ON oauth_clients.id = deleted.value')
    .bind(JSON.stringify(clientIds))
    .all<{ name: string }>();
  return results.map((row) => row.name);
}

export async function deleteSpentOAuthRows({ directory, now }: { directory: D1Database; now: number }): Promise<void> {
  await directory.batch([
    directory.prepare('DELETE FROM oauth_codes WHERE expires_at <= ?').bind(now),
    directory.prepare('DELETE FROM oauth_sessions WHERE expires_at <= ?').bind(now),
    directory.prepare('DELETE FROM oauth_tokens WHERE expires_at <= ?').bind(now),
    directory
      .prepare(`DELETE FROM oauth_clients WHERE NOT ${CLIENT_IS_LIVE}`)
      .bind(now - OAUTH_IDLE_CLIENT_LIFETIME_MS, now - OAUTH_UNUSED_CLIENT_LIFETIME_MS),
  ]);
}

export async function deleteOAuthSession({ directory, digest }: { directory: D1Database; digest: string }): Promise<void> {
  await directory.prepare('DELETE FROM oauth_sessions WHERE digest = ?').bind(digest).run();
}
