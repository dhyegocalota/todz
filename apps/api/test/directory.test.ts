import { env } from 'cloudflare:workers';
import { describe, expect, test } from 'vitest';
import { digestCredential } from '../src/credential-digest';
import { findKeyProject, findOwnedProject, findSessionOwner } from '../src/directory';
import { seedKey, seedOwner, seedProject, seedSession } from './directory-seed';
import { CLOCK_NOW } from './task-fixtures';

function newSecret(): string {
  return crypto.randomUUID();
}

describe('findKeyProject', () => {
  test('a seeded key resolves to its project', async () => {
    const projectId = await seedProject({ ownerId: await seedOwner() });
    const secret = newSecret();
    await seedKey({ projectId, secret });
    expect(await findKeyProject({ directory: env.DIRECTORY, digest: await digestCredential(secret) })).toBe(projectId);
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
