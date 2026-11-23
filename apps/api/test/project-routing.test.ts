import { env } from 'cloudflare:workers';
import { describe, expect, test } from 'vitest';
import { openKeyProject, openOwnedProject, resolveSessionOwner } from '../src/project-routing';
import { countingEnv } from './counting-namespace';
import { seedKey, seedLiveOwner, seedOwner, seedProject, seedSession } from './directory-seed';
import { AGENT_ACTOR, CLOCK_NOW, TODAY, draftOf, openTasksFilter, unwrap } from './task-fixtures';

const EMPTY_SECRET = '';

function newSecret(): string {
  return crypto.randomUUID();
}

describe('openKeyProject', () => {
  test('a seeded key opens its project, and a task added through it is read back through the owner', async () => {
    const ownerId = await seedOwner();
    const projectId = await seedProject({ ownerId });
    const secret = newSecret();
    await seedKey({ projectId, secret });
    const keyStub = await openKeyProject({ env, secret });
    if (keyStub === null) throw new Error('the key should open its project');
    unwrap(await keyStub.addTasks({ actor: AGENT_ACTOR, drafts: [draftOf('Through the key')] }));
    const ownerStub = await openOwnedProject({ env, owner: await seedLiveOwner({ ownerId }), projectId });
    if (ownerStub === null) throw new Error('the owner should open the project');
    const listed = unwrap(await ownerStub.listTasks({ today: TODAY, filter: openTasksFilter() }));
    expect(listed.tasks.map((task) => task.title)).toEqual(['Through the key']);
  });

  test('an unknown secret and a revoked key open nothing', async () => {
    const projectId = await seedProject({ ownerId: await seedOwner() });
    const revokedSecret = newSecret();
    await seedKey({ projectId, secret: revokedSecret, revokedAt: CLOCK_NOW });
    expect(await openKeyProject({ env, secret: newSecret() })).toBeNull();
    expect(await openKeyProject({ env, secret: revokedSecret })).toBeNull();
  });

  test('an empty secret opens nothing even when a key row holds its digest', async () => {
    const projectId = await seedProject({ ownerId: await seedOwner() });
    await seedKey({ projectId, secret: EMPTY_SECRET });
    expect(await openKeyProject({ env, secret: EMPTY_SECRET })).toBeNull();
  });

  test('a refusal addresses no Durable Object', async () => {
    const { countedEnv, addressingCalls } = countingEnv();
    expect(await openKeyProject({ env: countedEnv, secret: newSecret() })).toBeNull();
    expect(await openKeyProject({ env: countedEnv, secret: EMPTY_SECRET })).toBeNull();
    expect(addressingCalls).toEqual([]);
  });
});

describe('resolveSessionOwner', () => {
  test('a live session resolves to a session owner naming the owner', async () => {
    const ownerId = await seedOwner();
    const secret = newSecret();
    await seedSession({ ownerId, secret, expiresAt: CLOCK_NOW + 1 });
    expect(await resolveSessionOwner({ env, secret, now: CLOCK_NOW })).toMatchObject({ ownerId });
  });

  test('an expired session resolves to nothing', async () => {
    const secret = newSecret();
    await seedSession({ ownerId: await seedOwner(), secret, expiresAt: CLOCK_NOW });
    expect(await resolveSessionOwner({ env, secret, now: CLOCK_NOW })).toBeNull();
  });

  test('an empty secret resolves to nothing even when a live session holds its digest', async () => {
    await seedSession({ ownerId: await seedOwner(), secret: EMPTY_SECRET, expiresAt: CLOCK_NOW + 1 });
    expect(await resolveSessionOwner({ env, secret: EMPTY_SECRET, now: CLOCK_NOW })).toBeNull();
  });
});

describe('openOwnedProject', () => {
  test('the owner of a project opens it', async () => {
    const ownerId = await seedOwner();
    const projectId = await seedProject({ ownerId });
    const stub = await openOwnedProject({ env, owner: await seedLiveOwner({ ownerId }), projectId });
    expect(stub).not.toBeNull();
  });

  test('another owner and a project id that never existed open nothing and address no Durable Object', async () => {
    const { countedEnv, addressingCalls } = countingEnv();
    const projectId = await seedProject({ ownerId: await seedOwner() });
    const stranger = await seedLiveOwner({ ownerId: await seedOwner() });
    expect(await openOwnedProject({ env: countedEnv, owner: stranger, projectId })).toBeNull();
    expect(await openOwnedProject({ env: countedEnv, owner: stranger, projectId: crypto.randomUUID() })).toBeNull();
    expect(addressingCalls).toEqual([]);
  });

  test('a plain object is not accepted as a session owner', async () => {
    const ownerId = await seedOwner();
    const projectId = await seedProject({ ownerId });
    // @ts-expect-error a session owner is built only by resolveSessionOwner
    const stub = await openOwnedProject({ env, owner: { ownerId }, projectId });
    expect(stub).not.toBeNull();
  });
});
