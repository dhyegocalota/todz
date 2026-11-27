import { MILLISECONDS_PER_DAY, MILLISECONDS_PER_HOUR, OAUTH_ACCESS_TOKEN_PREFIX } from '@todz/types';
import { env } from 'cloudflare:workers';
import { digestCredential } from '../src/credential-digest';
import { base64UrlOf, generateCredentialSecret } from '../src/credential-secret';
import { type GrantScope, GrantScopeKind, type SelectionScope } from '../src/oauth/oauth-grant-scope';
import { OAuthTokenKind } from '../src/oauth/oauth-store';
import { type SessionOwner, resolveSessionOwner } from '../src/project-routing';
import { CLOCK_NOW } from './task-fixtures';

const SEEDED_CLIENT_NAME = 'Claude Code';
const SEEDED_REDIRECT_URI = 'http://127.0.0.1:33418/callback';
const CLIENT_IDENTIFIER_BYTE_LENGTH = 32;

export async function seedOwner(timeZone = 'UTC'): Promise<string> {
  const ownerId = crypto.randomUUID();
  await env.DIRECTORY.prepare('INSERT INTO owners (id, time_zone, created_at) VALUES (?, ?, ?)').bind(ownerId, timeZone, CLOCK_NOW).run();
  return ownerId;
}

export async function enableAgentNudge({ directory, ownerId }: { directory: D1Database; ownerId: string }): Promise<void> {
  await directory.prepare('UPDATE owners SET agent_nudge = 1 WHERE id = ?').bind(ownerId).run();
}

export async function enableDayEmail({
  directory,
  ownerId,
  minutes,
}: {
  directory: D1Database;
  ownerId: string;
  minutes: number;
}): Promise<void> {
  await directory.prepare('UPDATE owners SET day_email = 1, day_email_minutes = ? WHERE id = ?').bind(minutes, ownerId).run();
}

export async function seedEmailIdentity({ ownerId, email }: { ownerId: string; email: string }): Promise<void> {
  await env.DIRECTORY.prepare('INSERT INTO owner_identities (provider, subject, owner_id, created_at) VALUES (?, ?, ?, ?)')
    .bind('email', email, ownerId, CLOCK_NOW)
    .run();
}

export async function seedWorkspace({ ownerId }: { ownerId: string }): Promise<string> {
  const workspaceId = crypto.randomUUID();
  await env.DIRECTORY.prepare('INSERT INTO workspaces (id, owner_id, name, created_at) VALUES (?, ?, ?, ?)')
    .bind(workspaceId, ownerId, 'Workspace', CLOCK_NOW)
    .run();
  return workspaceId;
}

export async function seedProject({ ownerId }: { ownerId: string }): Promise<string> {
  const workspaceId = await seedWorkspace({ ownerId });
  const projectId = crypto.randomUUID();
  await env.DIRECTORY.prepare('INSERT INTO projects (id, workspace_id, name, is_inbox, created_at) VALUES (?, ?, ?, ?, ?)')
    .bind(projectId, workspaceId, 'Project', 0, CLOCK_NOW)
    .run();
  return projectId;
}

export async function seedSiblingProject({ projectId, name }: { projectId: string; name: string }): Promise<string> {
  const siblingId = crypto.randomUUID();
  await env.DIRECTORY.prepare(
    'INSERT INTO projects (id, workspace_id, name, is_inbox, created_at) SELECT ?, workspace_id, ?, 0, ? FROM projects WHERE id = ?',
  )
    .bind(siblingId, name, CLOCK_NOW, projectId)
    .run();
  return siblingId;
}

type SeededToken = { secret?: string; clientName?: string; expiresAt?: number };

export function accessSecret(): string {
  return `${OAUTH_ACCESS_TOKEN_PREFIX}${generateCredentialSecret()}`;
}

function scopeInsertion({ grantId, scope }: { grantId: string; scope: GrantScope }) {
  const workspaceId = scope.kind === GrantScopeKind.Workspace ? scope.workspaceId : null;
  const projectId = scope.kind === GrantScopeKind.Project ? scope.projectId : null;
  return env.DIRECTORY.prepare('INSERT INTO oauth_grant_scopes (grant_id, kind, workspace_id, project_id) VALUES (?, ?, ?, ?)').bind(
    grantId,
    scope.kind,
    workspaceId,
    projectId,
  );
}

async function seedGrant({
  ownerId,
  scopes,
  secret = accessSecret(),
  clientName = SEEDED_CLIENT_NAME,
  expiresAt = Math.max(CLOCK_NOW, Date.now()) + MILLISECONDS_PER_DAY,
  reachesWorkspace,
}: SeededToken & { ownerId: string; scopes: GrantScope[]; reachesWorkspace: boolean }): Promise<string> {
  const clientId = base64UrlOf(crypto.getRandomValues(new Uint8Array(CLIENT_IDENTIFIER_BYTE_LENGTH)));
  const grantId = crypto.randomUUID();
  await env.DIRECTORY.batch([
    env.DIRECTORY.prepare('INSERT INTO oauth_clients (id, name, redirect_uris, created_at, active_at) VALUES (?, ?, ?, ?, ?)').bind(
      clientId,
      clientName,
      JSON.stringify([SEEDED_REDIRECT_URI]),
      CLOCK_NOW,
      CLOCK_NOW,
    ),
    env.DIRECTORY.prepare(
      'INSERT INTO oauth_grants (id, client_id, owner_id, redirect_uri, created_at, last_used_at, reaches_workspace) VALUES (?, ?, ?, ?, ?, ?, ?)',
    ).bind(grantId, clientId, ownerId, SEEDED_REDIRECT_URI, CLOCK_NOW, CLOCK_NOW, Number(reachesWorkspace)),
    env.DIRECTORY.prepare('INSERT INTO oauth_tokens (digest, grant_id, kind, created_at, expires_at) VALUES (?, ?, ?, ?, ?)').bind(
      await digestCredential(secret),
      grantId,
      OAuthTokenKind.Access,
      CLOCK_NOW,
      expiresAt,
    ),
    ...scopes.map((scope) => scopeInsertion({ grantId, scope })),
  ]);
  return secret;
}

export async function seedSelectionToken({
  ownerId,
  scopes,
  ...token
}: SeededToken & { ownerId: string; scopes: SelectionScope[] }): Promise<string> {
  return seedGrant({ ownerId, scopes, reachesWorkspace: false, ...token });
}

export async function seedOwnerToken({ ownerId, ...token }: SeededToken & { ownerId: string }): Promise<string> {
  return seedGrant({ ownerId, scopes: [{ kind: GrantScopeKind.Account }], reachesWorkspace: false, ...token });
}

export async function seedProjectToken({ projectId, ...token }: SeededToken & { projectId: string }): Promise<string> {
  const owner = await env.DIRECTORY.prepare(
    'SELECT workspaces.owner_id FROM projects JOIN workspaces ON workspaces.id = projects.workspace_id WHERE projects.id = ?',
  )
    .bind(projectId)
    .first<{ owner_id: string }>();
  if (owner === null) throw new Error('the seeded project should exist');
  return seedGrant({ ownerId: owner.owner_id, scopes: [{ kind: GrantScopeKind.Project, projectId }], reachesWorkspace: true, ...token });
}

export async function seedProjectWithToken({ timeZone = 'UTC', clientName }: { timeZone?: string; clientName?: string } = {}): Promise<{
  projectId: string;
  token: string;
}> {
  const projectId = await seedProject({ ownerId: await seedOwner(timeZone) });
  return { projectId, token: await seedProjectToken({ projectId, clientName }) };
}

export async function seedNudgedProjectWithToken(): Promise<{ projectId: string; token: string }> {
  const ownerId = await seedOwner();
  await enableAgentNudge({ directory: env.DIRECTORY, ownerId });
  const projectId = await seedProject({ ownerId });
  return { projectId, token: await seedProjectToken({ projectId }) };
}

export async function revokeToken(secret: string): Promise<void> {
  await env.DIRECTORY.prepare('DELETE FROM oauth_grants WHERE id IN (SELECT grant_id FROM oauth_tokens WHERE digest = ?)')
    .bind(await digestCredential(secret))
    .run();
}

export async function seedLiveOwner({ ownerId }: { ownerId: string }): Promise<SessionOwner> {
  const secret = crypto.randomUUID();
  await seedSession({ ownerId, secret, expiresAt: CLOCK_NOW + MILLISECONDS_PER_HOUR });
  const owner = await resolveSessionOwner({ env, secret, now: CLOCK_NOW });
  if (owner === null) throw new Error('the seeded session should resolve');
  return owner;
}

export async function seedSession({ ownerId, secret, expiresAt }: { ownerId: string; secret: string; expiresAt: number }): Promise<void> {
  const digest = await digestCredential(secret);
  await env.DIRECTORY.prepare('INSERT INTO sessions (digest, owner_id, created_at, expires_at) VALUES (?, ?, ?, ?)')
    .bind(digest, ownerId, CLOCK_NOW, expiresAt)
    .run();
}
