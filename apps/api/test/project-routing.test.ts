import { PROJECT_OPEN_TASKS_MAX } from '@todz/types';
import { env } from 'cloudflare:workers';
import { describe, expect, test } from 'vitest';
import { digestCredential } from '../src/credential-digest';
import {
  type SessionOwner,
  findOwnedProjectId,
  findOwnedWorkspaceId,
  openOAuthAccess,
  openOwnedProject,
  resolveSessionOwner,
} from '../src/project-routing';
import { setOwnerSuspension } from '../src/owner-usage-store';
import { countingEnv } from './counting-namespace';
import { GrantShape } from '../src/oauth/oauth-grant-scope';
import {
  revokeToken,
  seedLiveOwner,
  seedOwner,
  seedOwnerToken,
  seedProject,
  seedProjectToken,
  seedSession,
  seedWorkspace,
} from './directory-seed';
import { AGENT_ACTOR, CLOCK_NOW, TODAY, draftOf, openTasksFilter, unwrap } from './task-fixtures';

const EMPTY_SECRET = '';
const BLANK_SECRET = '   ';
const SAO_PAULO_TIME_ZONE = 'America/Sao_Paulo';

function newSecret(): string {
  return crypto.randomUUID();
}

describe('openOAuthAccess', () => {
  test('a project token opens its project, and a task added through it is read back through the owner', async () => {
    const ownerId = await seedOwner();
    const projectId = await seedProject({ ownerId });
    const secret = await seedProjectToken({ projectId });
    const access = await openOAuthAccess({ env, secret, now: CLOCK_NOW });
    if (access === null || access.scope !== GrantShape.Project) throw new Error('the token should open its project');
    unwrap(
      await access.grantProject.project.addTasks({
        openTasksMax: PROJECT_OPEN_TASKS_MAX,
        actor: AGENT_ACTOR,
        drafts: [draftOf('Through the token')],
      }),
    );
    const ownerStub = await openOwnedProject({ env, owner: await seedLiveOwner({ ownerId }), projectId });
    if (ownerStub === null) throw new Error('the owner should open the project');
    const listed = unwrap(await ownerStub.listTasks({ today: TODAY, filter: openTasksFilter() }));
    expect(listed.tasks.map((task) => task.title)).toEqual(['Through the token']);
  });

  test('an owner token opens the owner and no project', async () => {
    const ownerId = await seedOwner();
    const secret = await seedOwnerToken({ ownerId });
    expect(await openOAuthAccess({ env, secret, now: CLOCK_NOW })).toMatchObject({ scope: GrantShape.Owner, owner: { ownerId } });
  });

  test('a token names its owner time zone and agent nudge', async () => {
    const projectId = await seedProject({ ownerId: await seedOwner(SAO_PAULO_TIME_ZONE) });
    const secret = await seedProjectToken({ projectId });
    expect(await openOAuthAccess({ env, secret, now: CLOCK_NOW })).toMatchObject({
      grantProject: { timeZone: SAO_PAULO_TIME_ZONE, agentNudge: false },
    });
  });

  test('an unknown secret, a revoked token and an expired token open nothing', async () => {
    const projectId = await seedProject({ ownerId: await seedOwner() });
    const revokedSecret = await seedProjectToken({ projectId });
    await revokeToken(revokedSecret);
    const expiredSecret = await seedProjectToken({ projectId, expiresAt: CLOCK_NOW });
    expect(await openOAuthAccess({ env, secret: newSecret(), now: CLOCK_NOW })).toBeNull();
    expect(await openOAuthAccess({ env, secret: revokedSecret, now: CLOCK_NOW })).toBeNull();
    expect(await openOAuthAccess({ env, secret: expiredSecret, now: CLOCK_NOW })).toBeNull();
  });

  test('an empty secret opens nothing even when a token row holds its digest', async () => {
    const projectId = await seedProject({ ownerId: await seedOwner() });
    await seedProjectToken({ projectId, secret: EMPTY_SECRET });
    expect(await openOAuthAccess({ env, secret: EMPTY_SECRET, now: CLOCK_NOW })).toBeNull();
  });

  test('a refusal addresses no Durable Object', async () => {
    const { countedEnv, addressingCalls } = countingEnv();
    expect(await openOAuthAccess({ env: countedEnv, secret: newSecret(), now: CLOCK_NOW })).toBeNull();
    expect(await openOAuthAccess({ env: countedEnv, secret: EMPTY_SECRET, now: CLOCK_NOW })).toBeNull();
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

  test('a session owner knows in the same statement whether the account is suspended', async () => {
    const ownerId = await seedOwner();
    const secret = newSecret();
    await seedSession({ ownerId, secret, expiresAt: CLOCK_NOW + 1 });
    await setOwnerSuspension({ directory: env.DIRECTORY, ownerId, suspendedAt: CLOCK_NOW });
    expect(await resolveSessionOwner({ env, secret, now: CLOCK_NOW })).toMatchObject({ ownerId, isSuspended: true });
    expect(await resolveSessionOwner({ env, secret, now: CLOCK_NOW, projectId: crypto.randomUUID() })).toMatchObject({
      ownerId,
      isSuspended: true,
    });
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
    expect(stub).toBeNull();
  });

  test('a resolved session owner cannot be rewritten to open another owner project', async () => {
    const ownerId = await seedOwner();
    const ownProjectId = await seedProject({ ownerId });
    const otherProjectId = await seedProject({ ownerId: await seedOwner() });
    const owner = await seedLiveOwner({ ownerId });
    const rewrite = (): void => {
      (owner as { ownerId: string }).ownerId = crypto.randomUUID();
    };
    expect(rewrite).toThrow(TypeError);
    expect(owner.ownerId).toBe(ownerId);
    expect(await openOwnedProject({ env, owner, projectId: ownProjectId })).not.toBeNull();
    expect(await openOwnedProject({ env, owner, projectId: otherProjectId })).toBeNull();
  });

  test('a forged session owner opens nothing and addresses no Durable Object', async () => {
    const { countedEnv, addressingCalls } = countingEnv();
    const ownerId = await seedOwner();
    const projectId = await seedProject({ ownerId });
    const forgedOwner = { ownerId } as SessionOwner;
    expect(await openOwnedProject({ env: countedEnv, owner: forgedOwner, projectId })).toBeNull();
    expect(addressingCalls).toEqual([]);
  });
});

describe('findOwnedProjectId', () => {
  test('the owner of a project gets its id and addresses no Durable Object', async () => {
    const { countedEnv, addressingCalls } = countingEnv();
    const ownerId = await seedOwner();
    const projectId = await seedProject({ ownerId });
    const owner = await seedLiveOwner({ ownerId });
    expect(await findOwnedProjectId({ env: countedEnv, owner, projectId })).toBe(projectId);
    expect(addressingCalls).toEqual([]);
  });

  test('another owner and a project id that never existed get nothing', async () => {
    const projectId = await seedProject({ ownerId: await seedOwner() });
    const stranger = await seedLiveOwner({ ownerId: await seedOwner() });
    expect(await findOwnedProjectId({ env, owner: stranger, projectId })).toBeNull();
    expect(await findOwnedProjectId({ env, owner: stranger, projectId: crypto.randomUUID() })).toBeNull();
  });

  test('a forged session owner gets nothing even for its own project', async () => {
    const ownerId = await seedOwner();
    const projectId = await seedProject({ ownerId });
    const forgedOwner = { ownerId } as SessionOwner;
    expect(await findOwnedProjectId({ env, owner: forgedOwner, projectId })).toBeNull();
  });
});

describe('findOwnedWorkspaceId', () => {
  test('the owner of a workspace gets its id and addresses no Durable Object', async () => {
    const { countedEnv, addressingCalls } = countingEnv();
    const ownerId = await seedOwner();
    const workspaceId = await seedWorkspace({ ownerId });
    const owner = await seedLiveOwner({ ownerId });
    expect(await findOwnedWorkspaceId({ env: countedEnv, owner, workspaceId })).toBe(workspaceId);
    expect(addressingCalls).toEqual([]);
  });

  test('another owner and a workspace id that never existed get nothing', async () => {
    const workspaceId = await seedWorkspace({ ownerId: await seedOwner() });
    const stranger = await seedLiveOwner({ ownerId: await seedOwner() });
    expect(await findOwnedWorkspaceId({ env, owner: stranger, workspaceId })).toBeNull();
    expect(await findOwnedWorkspaceId({ env, owner: stranger, workspaceId: crypto.randomUUID() })).toBeNull();
  });

  test('a forged session owner gets nothing even for its own workspace', async () => {
    const ownerId = await seedOwner();
    const workspaceId = await seedWorkspace({ ownerId });
    const forgedOwner = { ownerId } as SessionOwner;
    expect(await findOwnedWorkspaceId({ env, owner: forgedOwner, workspaceId })).toBeNull();
  });

  test('a project id is not a workspace id', async () => {
    const ownerId = await seedOwner();
    const projectId = await seedProject({ ownerId });
    expect(await findOwnedWorkspaceId({ env, owner: await seedLiveOwner({ ownerId }), workspaceId: projectId })).toBeNull();
  });
});

describe('a secret that is not a usable string', () => {
  test('a whitespace-only secret opens nothing even when rows hold its digest', async () => {
    const projectId = await seedProject({ ownerId: await seedOwner() });
    await seedProjectToken({ projectId, secret: BLANK_SECRET });
    await seedSession({ ownerId: await seedOwner(), secret: BLANK_SECRET, expiresAt: CLOCK_NOW + 1 });
    const { countedEnv, addressingCalls } = countingEnv();
    expect(await openOAuthAccess({ env: countedEnv, secret: BLANK_SECRET, now: CLOCK_NOW })).toBeNull();
    expect(await resolveSessionOwner({ env: countedEnv, secret: BLANK_SECRET, now: CLOCK_NOW })).toBeNull();
    expect(addressingCalls).toEqual([]);
  });

  test('a secret that is not a string opens nothing even when rows hold the digest of nothing', async () => {
    const emptyDigest = await digestCredential(EMPTY_SECRET);
    await env.DIRECTORY.prepare('INSERT OR IGNORE INTO sessions (digest, owner_id, created_at, expires_at) VALUES (?, ?, ?, ?)')
      .bind(emptyDigest, await seedOwner(), CLOCK_NOW, CLOCK_NOW + 1)
      .run();
    const missingSecret = undefined as unknown as string;
    expect(await openOAuthAccess({ env, secret: missingSecret, now: CLOCK_NOW })).toBeNull();
    expect(await resolveSessionOwner({ env, secret: missingSecret, now: CLOCK_NOW })).toBeNull();
  });
});
