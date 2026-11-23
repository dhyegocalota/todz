import { env } from 'cloudflare:workers';
import { digestCredential } from '../src/credential-digest';
import { CLOCK_NOW } from './task-fixtures';

export async function seedOwner(): Promise<string> {
  const ownerId = crypto.randomUUID();
  await env.DIRECTORY.prepare('INSERT INTO owners (id, created_at) VALUES (?, ?)').bind(ownerId, CLOCK_NOW).run();
  return ownerId;
}

export async function seedProject({ ownerId }: { ownerId: string }): Promise<string> {
  const workspaceId = crypto.randomUUID();
  const projectId = crypto.randomUUID();
  await env.DIRECTORY.batch([
    env.DIRECTORY.prepare('INSERT INTO workspaces (id, owner_id, name, created_at) VALUES (?, ?, ?, ?)').bind(
      workspaceId,
      ownerId,
      'Workspace',
      CLOCK_NOW,
    ),
    env.DIRECTORY.prepare('INSERT INTO projects (id, workspace_id, name, created_at) VALUES (?, ?, ?, ?)').bind(
      projectId,
      workspaceId,
      'Project',
      CLOCK_NOW,
    ),
  ]);
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
  await env.DIRECTORY.prepare('INSERT INTO project_keys (digest, project_id, created_at, revoked_at) VALUES (?, ?, ?, ?)')
    .bind(digest, projectId, CLOCK_NOW, revokedAt)
    .run();
}

export async function seedSession({ ownerId, secret, expiresAt }: { ownerId: string; secret: string; expiresAt: number }): Promise<void> {
  const digest = await digestCredential(secret);
  await env.DIRECTORY.prepare('INSERT INTO sessions (digest, owner_id, created_at, expires_at) VALUES (?, ?, ?, ?)')
    .bind(digest, ownerId, CLOCK_NOW, expiresAt)
    .run();
}
