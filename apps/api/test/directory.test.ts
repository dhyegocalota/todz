import { env } from 'cloudflare:workers';
import { describe, expect, test } from 'vitest';
import { digestCredential } from '../src/credential-digest';
import { findOwnedProject, findSessionOwner } from '../src/directory';
import { seedOwner, seedProject, seedSession } from './directory-seed';
import { CLOCK_NOW } from './task-fixtures';

const SAO_PAULO_TIME_ZONE = 'America/Sao_Paulo';
const CHECK_FAILURE = 'CHECK constraint failed';
const NOT_NULL_FAILURE = 'NOT NULL constraint failed';
const FOREIGN_KEY_FAILURE = 'FOREIGN KEY constraint failed';

function newSecret(): string {
  return crypto.randomUUID();
}

describe('findSessionOwner', () => {
  test('a session expiring one millisecond after now resolves to its owner', async () => {
    const ownerId = await seedOwner();
    const secret = newSecret();
    await seedSession({ ownerId, secret, expiresAt: CLOCK_NOW + 1 });
    expect(await findSessionOwner({ directory: env.DIRECTORY, digest: await digestCredential(secret), now: CLOCK_NOW })).toEqual({
      ownerId,
      isSuspended: false,
    });
  });

  test('a session expiring exactly at now resolves to nothing', async () => {
    const secret = newSecret();
    await seedSession({ ownerId: await seedOwner(), secret, expiresAt: CLOCK_NOW });
    expect(await findSessionOwner({ directory: env.DIRECTORY, digest: await digestCredential(secret), now: CLOCK_NOW })).toBeNull();
  });

  test('an unknown digest resolves to nothing', async () => {
    expect(await findSessionOwner({ directory: env.DIRECTORY, digest: await digestCredential(newSecret()), now: CLOCK_NOW })).toBeNull();
  });
});

describe('the directory digests', () => {
  const RAW_SECRET = 'secret';

  test('a raw secret is refused as a session digest', async () => {
    const insertion = env.DIRECTORY.prepare('INSERT INTO sessions (digest, owner_id, created_at, expires_at) VALUES (?, ?, ?, ?)')
      .bind(RAW_SECRET, await seedOwner(), CLOCK_NOW, CLOCK_NOW + 1)
      .run();
    await expect(insertion).rejects.toThrow();
  });
});

describe('the owner agent nudge', () => {
  test('an owner seeded without it reads false', async () => {
    const ownerId = await seedOwner();
    const row = await env.DIRECTORY.prepare('SELECT agent_nudge FROM owners WHERE id = ?').bind(ownerId).first<{ agent_nudge: number }>();
    expect(row).toEqual({ agent_nudge: 0 });
  });

  test('a value other than 0 and 1 is refused', async () => {
    const ownerId = await seedOwner();
    const update = env.DIRECTORY.prepare('UPDATE owners SET agent_nudge = 2 WHERE id = ?').bind(ownerId).run();
    await expect(update).rejects.toThrow(CHECK_FAILURE);
  });
});

describe('the owner time zone', () => {
  test('an empty time zone and a missing time zone are refused', async () => {
    const emptyZone = env.DIRECTORY.prepare('INSERT INTO owners (id, time_zone, created_at) VALUES (?, ?, ?)')
      .bind(crypto.randomUUID(), '', CLOCK_NOW)
      .run();
    const missingZone = env.DIRECTORY.prepare('INSERT INTO owners (id, created_at) VALUES (?, ?)')
      .bind(crypto.randomUUID(), CLOCK_NOW)
      .run();
    await expect(emptyZone).rejects.toThrow(CHECK_FAILURE);
    await expect(missingZone).rejects.toThrow(NOT_NULL_FAILURE);
  });

  test('a named time zone is stored', async () => {
    const ownerId = await seedOwner(SAO_PAULO_TIME_ZONE);
    const row = await env.DIRECTORY.prepare('SELECT time_zone FROM owners WHERE id = ?').bind(ownerId).first<{ time_zone: string }>();
    expect(row).toEqual({ time_zone: SAO_PAULO_TIME_ZONE });
  });
});

describe('the owner api schema (pin)', () => {
  const UNIQUE_FAILURE = 'UNIQUE constraint failed';
  const IDENTITY_PROVIDER = 'fake';
  const EXPECTED_INDEXES = ['projects_inbox', 'projects_workspace', 'sessions_owner', 'workspaces_owner'];

  type WorkspaceRow = { workspace_id: string };

  async function workspaceIdOf(projectId: string): Promise<string> {
    const row = await env.DIRECTORY.prepare('SELECT workspace_id FROM projects WHERE id = ?').bind(projectId).first<WorkspaceRow>();
    if (row === null) throw new Error('the seeded project has a workspace');
    return row.workspace_id;
  }

  function insertProject({ workspaceId, isInbox }: { workspaceId: string; isInbox: number }): Promise<D1Result> {
    return env.DIRECTORY.prepare('INSERT INTO projects (id, workspace_id, name, is_inbox, created_at) VALUES (?, ?, ?, ?, ?)')
      .bind(crypto.randomUUID(), workspaceId, 'Name', isInbox, CLOCK_NOW)
      .run();
  }

  function insertIdentity({ subject, ownerId }: { subject: string; ownerId: string }): Promise<D1Result> {
    return env.DIRECTORY.prepare('INSERT INTO owner_identities (provider, subject, owner_id, created_at) VALUES (?, ?, ?, ?)')
      .bind(IDENTITY_PROVIDER, subject, ownerId, CLOCK_NOW)
      .run();
  }

  test('lists the owner api indexes', async () => {
    const { results } = await env.DIRECTORY.prepare(
      "SELECT name FROM sqlite_master WHERE type = 'index' AND name IN ('projects_inbox', 'projects_workspace', 'sessions_owner', 'workspaces_owner') ORDER BY name",
    ).all<{ name: string }>();
    expect(results.map((row) => row.name)).toEqual(EXPECTED_INDEXES);
  });

  test('is_inbox accepts 0 and 1 and refuses 2', async () => {
    const workspaceId = await workspaceIdOf(await seedProject({ ownerId: await seedOwner() }));
    await insertProject({ workspaceId, isInbox: 0 });
    await insertProject({ workspaceId, isInbox: 1 });
    await expect(insertProject({ workspaceId, isInbox: 2 })).rejects.toThrow(CHECK_FAILURE);
  });

  test('a workspace holds at most one inbox and any number of regular projects', async () => {
    const workspaceId = await workspaceIdOf(await seedProject({ ownerId: await seedOwner() }));
    await insertProject({ workspaceId, isInbox: 1 });
    await insertProject({ workspaceId, isInbox: 0 });
    await insertProject({ workspaceId, isInbox: 0 });
    await expect(insertProject({ workspaceId, isInbox: 1 })).rejects.toThrow(UNIQUE_FAILURE);
  });

  test('an identity is unique by provider and subject and names an existing owner', async () => {
    const subject = newSecret();
    await insertIdentity({ subject, ownerId: await seedOwner() });
    await expect(insertIdentity({ subject, ownerId: await seedOwner() })).rejects.toThrow(UNIQUE_FAILURE);
    await expect(insertIdentity({ subject: newSecret(), ownerId: crypto.randomUUID() })).rejects.toThrow(FOREIGN_KEY_FAILURE);
  });
});

describe('findOwnedProject', () => {
  test('the owner of the project gets its id', async () => {
    const ownerId = await seedOwner();
    const projectId = await seedProject({ ownerId });
    expect(await findOwnedProject({ directory: env.DIRECTORY, ownerId, projectId })).toBe(projectId);
  });

  test('another owner gets nothing', async () => {
    const projectId = await seedProject({ ownerId: await seedOwner() });
    expect(await findOwnedProject({ directory: env.DIRECTORY, ownerId: await seedOwner(), projectId })).toBeNull();
  });

  test('a project id that never existed gets nothing', async () => {
    expect(await findOwnedProject({ directory: env.DIRECTORY, ownerId: await seedOwner(), projectId: crypto.randomUUID() })).toBeNull();
  });
});
