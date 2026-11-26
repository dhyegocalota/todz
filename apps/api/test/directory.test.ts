import { env } from 'cloudflare:workers';
import { describe, expect, test } from 'vitest';
import { digestCredential } from '../src/credential-digest';
import { findKeyProject, findMcpSessionClient, findOwnedProject, findSessionOwner, insertMcpSession } from '../src/directory';
import { MCP_SESSIONS_PER_KEY_MAX } from '../src/mcp-sessions';
import { enableAgentNudge, seedKey, seedOwner, seedProject, seedSession } from './directory-seed';
import { CLOCK_NOW } from './task-fixtures';

const SAO_PAULO_TIME_ZONE = 'America/Sao_Paulo';
const CLIENT_NAME = 'Claude Code';
const CHECK_FAILURE = 'CHECK constraint failed';
const NOT_NULL_FAILURE = 'NOT NULL constraint failed';
const FOREIGN_KEY_FAILURE = 'FOREIGN KEY constraint failed';

function newSecret(): string {
  return crypto.randomUUID();
}

describe('findKeyProject', () => {
  test('a seeded key resolves to its project and its owner time zone', async () => {
    const projectId = await seedProject({ ownerId: await seedOwner(SAO_PAULO_TIME_ZONE) });
    const secret = newSecret();
    await seedKey({ projectId, secret });
    expect(await findKeyProject({ directory: env.DIRECTORY, digest: await digestCredential(secret) })).toEqual({
      projectId,
      timeZone: SAO_PAULO_TIME_ZONE,
      agentNudge: false,
      ownerId: expect.any(String),
      isSuspended: false,
    });
  });

  test('the flag is the one of the key owner', async () => {
    const ownerId = await seedOwner();
    const projectId = await seedProject({ ownerId });
    const otherProjectId = await seedProject({ ownerId: await seedOwner() });
    const secret = newSecret();
    const otherSecret = newSecret();
    await seedKey({ projectId, secret });
    await seedKey({ projectId: otherProjectId, secret: otherSecret });
    await enableAgentNudge({ directory: env.DIRECTORY, ownerId });
    expect(await findKeyProject({ directory: env.DIRECTORY, digest: await digestCredential(secret) })).toMatchObject({ agentNudge: true });
    expect(await findKeyProject({ directory: env.DIRECTORY, digest: await digestCredential(otherSecret) })).toMatchObject({
      agentNudge: false,
    });
  });

  test('an unknown secret resolves to nothing', async () => {
    expect(await findKeyProject({ directory: env.DIRECTORY, digest: await digestCredential(newSecret()) })).toBeNull();
  });

  test('a revoked key resolves to nothing', async () => {
    const projectId = await seedProject({ ownerId: await seedOwner() });
    const secret = newSecret();
    await seedKey({ projectId, secret, revokedAt: CLOCK_NOW });
    expect(await findKeyProject({ directory: env.DIRECTORY, digest: await digestCredential(secret) })).toBeNull();
  });
});

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

describe('findMcpSessionClient', () => {
  const SESSION_EXPIRES_AT = CLOCK_NOW + 1;

  async function storedSession(): Promise<{ digest: string; keyDigest: string }> {
    const keySecret = newSecret();
    await seedKey({ projectId: await seedProject({ ownerId: await seedOwner() }), secret: keySecret });
    const digest = await digestCredential(newSecret());
    const keyDigest = await digestCredential(keySecret);
    await insertMcpSession({
      directory: env.DIRECTORY,
      digest,
      keyDigest,
      clientName: CLIENT_NAME,
      now: CLOCK_NOW,
      expiresAt: SESSION_EXPIRES_AT,
      sessionsPerKeyMax: MCP_SESSIONS_PER_KEY_MAX,
    });
    return { digest, keyDigest };
  }

  test('a session one millisecond before it expires names its client', async () => {
    const { digest, keyDigest } = await storedSession();
    expect(await findMcpSessionClient({ directory: env.DIRECTORY, digest, keyDigest, now: SESSION_EXPIRES_AT - 1 })).toBe(CLIENT_NAME);
  });

  test('a session at its expiry names nothing', async () => {
    const { digest, keyDigest } = await storedSession();
    expect(await findMcpSessionClient({ directory: env.DIRECTORY, digest, keyDigest, now: SESSION_EXPIRES_AT })).toBeNull();
  });

  test('a session offered with another key names nothing', async () => {
    const { digest } = await storedSession();
    const { keyDigest: otherKeyDigest } = await storedSession();
    expect(await findMcpSessionClient({ directory: env.DIRECTORY, digest, keyDigest: otherKeyDigest, now: CLOCK_NOW })).toBeNull();
  });

  test('an unknown digest names nothing', async () => {
    const { keyDigest } = await storedSession();
    const unknownDigest = await digestCredential(newSecret());
    expect(await findMcpSessionClient({ directory: env.DIRECTORY, digest: unknownDigest, keyDigest, now: CLOCK_NOW })).toBeNull();
  });
});

describe('the directory digests', () => {
  const RAW_SECRET = 'secret';

  test('a raw secret is refused as a key digest', async () => {
    const projectId = await seedProject({ ownerId: await seedOwner() });
    const insertion = env.DIRECTORY.prepare('INSERT INTO project_keys (digest, project_id, created_at) VALUES (?, ?, ?)')
      .bind(RAW_SECRET, projectId, CLOCK_NOW)
      .run();
    await expect(insertion).rejects.toThrow();
  });

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

describe('the mcp sessions table', () => {
  test('is indexed by key digest and creation time (pin)', async () => {
    const { results } = await env.DIRECTORY.prepare("SELECT name FROM pragma_index_list('mcp_sessions') WHERE origin = 'c'").all<{
      name: string;
    }>();
    expect(results.map((row) => row.name)).toEqual(['mcp_sessions_key_digest']);
    const columns = await env.DIRECTORY.prepare("SELECT name FROM pragma_index_info('mcp_sessions_key_digest') ORDER BY seqno").all<{
      name: string;
    }>();
    expect(columns.results.map((row) => row.name)).toEqual(['key_digest', 'created_at']);
  });

  test('a key digest with no key row is refused', async () => {
    const insertion = env.DIRECTORY.prepare(
      'INSERT INTO mcp_sessions (digest, key_digest, client_name, created_at, expires_at) VALUES (?, ?, ?, ?, ?)',
    )
      .bind(await digestCredential(newSecret()), await digestCredential(newSecret()), CLIENT_NAME, CLOCK_NOW, CLOCK_NOW + 1)
      .run();
    await expect(insertion).rejects.toThrow(FOREIGN_KEY_FAILURE);
  });

  test('a digest of 63 characters is refused', async () => {
    const keySecret = newSecret();
    await seedKey({ projectId: await seedProject({ ownerId: await seedOwner() }), secret: keySecret });
    const shortDigest = (await digestCredential(newSecret())).slice(1);
    const insertion = env.DIRECTORY.prepare(
      'INSERT INTO mcp_sessions (digest, key_digest, client_name, created_at, expires_at) VALUES (?, ?, ?, ?, ?)',
    )
      .bind(shortDigest, await digestCredential(keySecret), CLIENT_NAME, CLOCK_NOW, CLOCK_NOW + 1)
      .run();
    await expect(insertion).rejects.toThrow(CHECK_FAILURE);
  });
});

describe('the owner api schema (pin)', () => {
  const UNIQUE_FAILURE = 'UNIQUE constraint failed';
  const IDENTITY_PROVIDER = 'fake';
  const EXPECTED_INDEXES = ['project_keys_project', 'projects_inbox', 'projects_workspace', 'sessions_owner', 'workspaces_owner'];

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

  function insertKey({ projectId, id, hint }: { projectId: string; id: string; hint: string }): Promise<D1Result> {
    return env.DIRECTORY.prepare('INSERT INTO project_keys (digest, id, hint, project_id, created_at) VALUES (?, ?, ?, ?, ?)')
      .bind(crypto.randomUUID().replaceAll('-', '').repeat(2), id, hint, projectId, CLOCK_NOW)
      .run();
  }

  function insertIdentity({ subject, ownerId }: { subject: string; ownerId: string }): Promise<D1Result> {
    return env.DIRECTORY.prepare('INSERT INTO owner_identities (provider, subject, owner_id, created_at) VALUES (?, ?, ?, ?)')
      .bind(IDENTITY_PROVIDER, subject, ownerId, CLOCK_NOW)
      .run();
  }

  test('lists the owner api indexes', async () => {
    const { results } = await env.DIRECTORY.prepare(
      "SELECT name FROM sqlite_master WHERE type = 'index' AND name IN ('project_keys_project', 'projects_inbox', 'projects_workspace', 'sessions_owner', 'workspaces_owner') ORDER BY name",
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

  test('a key hint of three or five characters is refused and four is stored', async () => {
    const projectId = await seedProject({ ownerId: await seedOwner() });
    await expect(insertKey({ projectId, id: crypto.randomUUID(), hint: 'abc' })).rejects.toThrow(CHECK_FAILURE);
    await expect(insertKey({ projectId, id: crypto.randomUUID(), hint: 'abcde' })).rejects.toThrow(CHECK_FAILURE);
    await insertKey({ projectId, id: crypto.randomUUID(), hint: 'abcd' });
  });

  test('a key id is unique', async () => {
    const projectId = await seedProject({ ownerId: await seedOwner() });
    const id = crypto.randomUUID();
    await insertKey({ projectId, id, hint: 'abcd' });
    await expect(insertKey({ projectId, id, hint: 'abcd' })).rejects.toThrow(UNIQUE_FAILURE);
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
