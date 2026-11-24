import { env } from 'cloudflare:workers';
import { describe, expect, test } from 'vitest';
import { digestCredential } from '../src/credential-digest';
import { findKeyProject, findMcpSessionClient, findOwnedProject, findSessionOwner, insertMcpSession } from '../src/directory';
import { seedKey, seedOwner, seedProject, seedSession } from './directory-seed';
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
    expect(await findSessionOwner({ directory: env.DIRECTORY, digest: await digestCredential(secret), now: CLOCK_NOW })).toBe(ownerId);
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
