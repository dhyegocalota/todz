import { MILLISECONDS_PER_HOUR } from '@todz/types';
import { env } from 'cloudflare:workers';
import { digestCredential } from '../src/credential-digest';
import { issueProjectKey } from '../src/project-keys';
import { type SessionOwner, resolveSessionOwner } from '../src/project-routing';
import { CLOCK_NOW } from './task-fixtures';

const SEEDED_KEY_HINT = 'seed';

export async function seedOwner(timeZone = 'UTC'): Promise<string> {
  const ownerId = crypto.randomUUID();
  await env.DIRECTORY.prepare('INSERT INTO owners (id, time_zone, created_at) VALUES (?, ?, ?)').bind(ownerId, timeZone, CLOCK_NOW).run();
  return ownerId;
}

export async function enableAgentNudge({ directory, ownerId }: { directory: D1Database; ownerId: string }): Promise<void> {
  await directory.prepare('UPDATE owners SET agent_nudge = 1 WHERE id = ?').bind(ownerId).run();
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

export async function seedKey({
  projectId,
  secret,
  revokedAt = null,
}: {
  projectId: string;
  secret: string;
  revokedAt?: number | null;
}): Promise<void> {
  const digest = await digestCredential(secret);
  await env.DIRECTORY.prepare('INSERT INTO project_keys (digest, id, hint, project_id, created_at, revoked_at) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(digest, crypto.randomUUID(), SEEDED_KEY_HINT, projectId, CLOCK_NOW, revokedAt)
    .run();
}

export async function seedIssuedKey(timeZone = 'UTC'): Promise<{ projectId: string; key: string }> {
  const projectId = await seedProject({ ownerId: await seedOwner(timeZone) });
  const { secret } = await issueProjectKey({ directory: env.DIRECTORY, projectId, now: CLOCK_NOW });
  return { projectId, key: secret };
}

export async function seedNudgedKey(): Promise<{ projectId: string; key: string }> {
  const ownerId = await seedOwner();
  await enableAgentNudge({ directory: env.DIRECTORY, ownerId });
  const projectId = await seedProject({ ownerId });
  const { secret } = await issueProjectKey({ directory: env.DIRECTORY, projectId, now: CLOCK_NOW });
  return { projectId, key: secret };
}

export async function revokeKey(key: string): Promise<void> {
  await env.DIRECTORY.prepare('UPDATE project_keys SET revoked_at = ? WHERE digest = ?')
    .bind(CLOCK_NOW, await digestCredential(key))
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
