import { CLOUD_LEVEL_CACHE_MS } from '@todz/types';
import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, test } from 'vitest';
import { BudgetLevel } from '../src/cloud-budget';
import { forgetCloudLevel } from '../src/cloud-level';
import type { Env } from '../src/env';
import { serveMcp } from '../src/mcp-endpoint';
import { forgetStampedOwners } from '../src/owner-last-seen';
import { isHeavyWriterRefusedOnCloud } from '../src/owner-write-quota';
import { utcDayOf } from '../src/telemetry/telemetry-day';
import { seedEmailIdentity, seedOwner, seedOwnerToken, seedProject, seedProjectToken, seedSession } from './directory-seed';
import { recordingLimiter } from './email-sign-in-client';
import { recordingEnv, serveOwnerCall, workerEnvWith } from './owner-client';
import { CLOCK_NOW } from './task-fixtures';

const MONTH = '2026-11';
const USAGE_DAY = '2026-11-01';
const NOW = Date.parse('2026-11-01T03:00:00Z');
const SESSION_LIFETIME_MS = 24 * 60 * 60 * 1000;
const OK_STATUS = 200;
const TOO_MANY_STATUS = 429;
const HEAVY_WRITES = 100;
const ADMIN_ADDRESS = 'admin@example.com';

async function setLevel(level: BudgetLevel): Promise<void> {
  forgetCloudLevel();
  await env.DIRECTORY.prepare(
    `INSERT INTO cloud_budget (month, level, heavy_writes, source) VALUES (?1, ?2, 0, 'estimate')
     ON CONFLICT (month) DO UPDATE SET level = excluded.level`,
  )
    .bind(MONTH, level)
    .run();
}

async function seedHeavyOwner(): Promise<string> {
  const ownerId = await seedOwner();
  await env.DIRECTORY.prepare('INSERT INTO owner_usage (owner_id, day, writes, bytes) VALUES (?, ?, ?, 0)')
    .bind(ownerId, USAGE_DAY, HEAVY_WRITES)
    .run();
  return ownerId;
}

async function seedSessionOf(ownerId: string): Promise<string> {
  const secret = crypto.randomUUID();
  await seedSession({ ownerId, secret, expiresAt: NOW + SESSION_LIFETIME_MS });
  return secret;
}

async function projectTokenOf(ownerId: string): Promise<string> {
  return seedProjectToken({ projectId: await seedProject({ ownerId }) });
}

function cloudEnvWith({ isAllowed, settings = {} }: { isAllowed: boolean; settings?: Partial<Env> }): Env {
  return workerEnvWith({ CLOUD_ACCOUNTS_MAX: '13', CLOUD_READ_LIMITER: recordingLimiter({ isAllowed }).limiter, ...settings });
}

function ownerRead({ secret, workerEnv }: { secret: string; workerEnv: Env }): Promise<Response> {
  return serveOwnerCall({ call: { method: 'GET', path: '/owner/workspaces', token: secret }, now: NOW, workerEnv });
}

function mcpPost({ token, workerEnv }: { token: string; workerEnv: Env }): Promise<Response> {
  const request = new Request('http://localhost:8787/mcp', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: '{}',
  });
  return serveMcp({ request, env: workerEnv, now: NOW });
}

async function lastSeenDayOf(ownerId: string): Promise<string | null> {
  const row = await env.DIRECTORY.prepare('SELECT last_seen_day FROM owners WHERE id = ?')
    .bind(ownerId)
    .first<{ last_seen_day: string | null }>();
  if (row === null) throw new Error('the owner exists');
  return row.last_seen_day;
}

beforeEach(async () => {
  forgetCloudLevel();
  forgetStampedOwners();
  await env.DIRECTORY.prepare('DELETE FROM cloud_budget').run();
});

describe('the read throttle through the owner API', () => {
  test('every owner is throttled with 429 rate_limited and Retry-After at 95%, also one with no writes, but the admin owner reads', async () => {
    await setLevel(BudgetLevel.Refusing);
    const adminOwnerId = await seedOwner();
    await seedEmailIdentity({ ownerId: adminOwnerId, email: ADMIN_ADDRESS });
    const [heavy, idle, admin] = [
      await seedSessionOf(await seedHeavyOwner()),
      await seedSessionOf(await seedOwner()),
      await seedSessionOf(adminOwnerId),
    ];
    const workerEnv = cloudEnvWith({ isAllowed: false, settings: { ADMIN_EMAIL: ADMIN_ADDRESS } });
    const throttled = await ownerRead({ secret: heavy, workerEnv });
    expect(throttled.status).toBe(TOO_MANY_STATUS);
    expect(await throttled.json()).toEqual({ error: 'rate_limited' });
    expect(throttled.headers.get('Retry-After')).toBe('60');
    expect((await ownerRead({ secret: idle, workerEnv })).status).toBe(TOO_MANY_STATUS);
    expect((await ownerRead({ secret: admin, workerEnv })).status).toBe(OK_STATUS);
  });

  test('a heavy account within the allowed rate reads, and a normal month throttles nobody', async () => {
    const heavy = await seedSessionOf(await seedHeavyOwner());
    await setLevel(BudgetLevel.Refusing);
    expect((await ownerRead({ secret: heavy, workerEnv: cloudEnvWith({ isAllowed: true }) })).status).toBe(OK_STATUS);
    await setLevel(BudgetLevel.Normal);
    expect((await ownerRead({ secret: heavy, workerEnv: cloudEnvWith({ isAllowed: false }) })).status).toBe(OK_STATUS);
  });
});

describe('the read throttle through MCP', () => {
  test('a heavy and an idle account are both throttled, for a project grant and an owner grant', async () => {
    await setLevel(BudgetLevel.Refusing);
    const heavyOwnerId = await seedHeavyOwner();
    const lightOwnerId = await seedOwner();
    const workerEnv = cloudEnvWith({ isAllowed: false });
    const heavyProjectToken = await projectTokenOf(heavyOwnerId);
    const heavyOwnerToken = await seedOwnerToken({ ownerId: heavyOwnerId });
    const lightProjectToken = await projectTokenOf(lightOwnerId);
    const statuses = await Promise.all(
      [heavyProjectToken, heavyOwnerToken, lightProjectToken].map(async (token) => (await mcpPost({ token, workerEnv })).status),
    );
    expect(statuses).toEqual([TOO_MANY_STATUS, TOO_MANY_STATUS, TOO_MANY_STATUS]);
  });
});

describe('a signed-in request counts as activity', () => {
  test('an owner API request stamps the day once', async () => {
    const ownerId = await seedOwner();
    const secret = await seedSessionOf(ownerId);
    await ownerRead({ secret, workerEnv: workerEnvWith({ CLOUD_ACCOUNTS_MAX: '13' }) });
    expect(await lastSeenDayOf(ownerId)).toBe(utcDayOf(NOW));
  });

  test('a project grant request and an owner grant request stamp the day too, and a self-hosted server stamps nothing', async () => {
    const [projectOwnerId, ownerGrantOwnerId, selfHostedOwnerId] = [await seedOwner(), await seedOwner(), await seedOwner()];
    const workerEnv = workerEnvWith({ CLOUD_ACCOUNTS_MAX: '13' });
    await mcpPost({ token: await projectTokenOf(projectOwnerId), workerEnv });
    await mcpPost({ token: await seedOwnerToken({ ownerId: ownerGrantOwnerId }), workerEnv });
    await mcpPost({ token: await projectTokenOf(selfHostedOwnerId), workerEnv: workerEnvWith({}) });
    expect([await lastSeenDayOf(projectOwnerId), await lastSeenDayOf(ownerGrantOwnerId), await lastSeenDayOf(selfHostedOwnerId)]).toEqual([
      utcDayOf(NOW),
      utcDayOf(NOW),
      null,
    ]);
  });
});

describe('a normal month adds no per-owner statement to a request', () => {
  test('the level is read once and the heavy-writer sum never runs below 95%', async () => {
    await setLevel(BudgetLevel.Normal);
    const ownerId = await seedHeavyOwner();
    const { workerEnv, statements } = recordingEnv({ CLOUD_ACCOUNTS_MAX: '13' });
    const answers = await Promise.all([1, 2, 3].map(() => isHeavyWriterRefusedOnCloud({ env: workerEnv, ownerId, now: NOW })));
    expect(answers).toEqual([false, false, false]);
    expect(statements.filter((statement) => statement.includes('cloud_budget'))).toHaveLength(1);
    expect(statements.filter((statement) => statement.includes('owner_usage'))).toHaveLength(0);
  });

  test('at 95% the sum runs, and the level is read again once the cache expires', async () => {
    await setLevel(BudgetLevel.Refusing);
    const ownerId = await seedHeavyOwner();
    const { workerEnv, statements } = recordingEnv({ CLOUD_ACCOUNTS_MAX: '13' });
    expect(await isHeavyWriterRefusedOnCloud({ env: workerEnv, ownerId, now: NOW })).toBe(true);
    expect(statements.filter((statement) => statement.includes('owner_usage'))).toHaveLength(1);
    await isHeavyWriterRefusedOnCloud({ env: workerEnv, ownerId, now: NOW + CLOUD_LEVEL_CACHE_MS });
    expect(statements.filter((statement) => statement.includes('FROM cloud_budget WHERE month'))).toHaveLength(2);
  });

  test('without the cap nothing is read at all', async () => {
    const { workerEnv, statements } = recordingEnv();
    expect(await isHeavyWriterRefusedOnCloud({ env: workerEnv, ownerId: await seedOwner(), now: NOW })).toBe(false);
    expect(statements).toEqual([]);
  });
});
