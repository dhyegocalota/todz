import { CLOUD_LEVEL_CACHE_MS, PROJECT_LIVE_KEYS_MAX } from '@todz/types';
import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, test } from 'vitest';
import { BudgetLevel } from '../src/cloud-budget';
import { forgetCloudLevel } from '../src/cloud-level';
import type { Env } from '../src/env';
import { serveMcp } from '../src/mcp-endpoint';
import { forgetStampedOwners } from '../src/owner-last-seen';
import { isHeavyWriterRefusedOnCloud } from '../src/owner-write-quota';
import { issueProjectKey } from '../src/project-keys';
import { utcDayOf } from '../src/telemetry/telemetry-day';
import { issuedKeyOf, seedOwner, seedOwnerKey, seedProject, seedSession } from './directory-seed';
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

async function keyOf(ownerId: string): Promise<string> {
  const projectId = await seedProject({ ownerId });
  const { secret } = await issuedKeyOf(
    issueProjectKey({ liveKeysMax: PROJECT_LIVE_KEYS_MAX, directory: env.DIRECTORY, projectId, now: CLOCK_NOW }),
  );
  return secret;
}

function cloudEnvWith({ isAllowed, settings = {} }: { isAllowed: boolean; settings?: Partial<Env> }): Env {
  return workerEnvWith({ CLOUD_ACCOUNTS_MAX: '13', CLOUD_READ_LIMITER: recordingLimiter({ isAllowed }).limiter, ...settings });
}

function ownerRead({ secret, workerEnv }: { secret: string; workerEnv: Env }): Promise<Response> {
  return serveOwnerCall({ call: { method: 'GET', path: '/owner/workspaces', token: secret }, now: NOW, workerEnv });
}

function mcpPost({ key, workerEnv }: { key: string; workerEnv: Env }): Promise<Response> {
  const request = new Request('http://localhost:8787/mcp', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
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
  test('a heavy account is throttled with 429 rate_limited and Retry-After, a light one reads', async () => {
    await setLevel(BudgetLevel.Refusing);
    const [heavy, light] = [await seedSessionOf(await seedHeavyOwner()), await seedSessionOf(await seedOwner())];
    const workerEnv = cloudEnvWith({ isAllowed: false });
    const throttled = await ownerRead({ secret: heavy, workerEnv });
    expect(throttled.status).toBe(TOO_MANY_STATUS);
    expect(await throttled.json()).toEqual({ error: 'rate_limited' });
    expect(throttled.headers.get('Retry-After')).toBe('60');
    expect((await ownerRead({ secret: light, workerEnv })).status).toBe(OK_STATUS);
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
  test('a heavy account key is throttled and a light one is not, for a project key and an owner key', async () => {
    await setLevel(BudgetLevel.Refusing);
    const heavyOwnerId = await seedHeavyOwner();
    const lightOwnerId = await seedOwner();
    const workerEnv = cloudEnvWith({ isAllowed: false });
    const heavyProjectKey = await keyOf(heavyOwnerId);
    const heavyOwnerKey = await seedOwnerKey({ ownerId: heavyOwnerId });
    const lightProjectKey = await keyOf(lightOwnerId);
    const statuses = await Promise.all(
      [heavyProjectKey, heavyOwnerKey, lightProjectKey].map(async (key) => (await mcpPost({ key, workerEnv })).status),
    );
    expect(statuses.slice(0, 2)).toEqual([TOO_MANY_STATUS, TOO_MANY_STATUS]);
    expect(statuses[2]).not.toBe(TOO_MANY_STATUS);
  });
});

describe('a signed-in request counts as activity', () => {
  test('an owner API request stamps the day once', async () => {
    const ownerId = await seedOwner();
    const secret = await seedSessionOf(ownerId);
    await ownerRead({ secret, workerEnv: workerEnvWith({ CLOUD_ACCOUNTS_MAX: '13' }) });
    expect(await lastSeenDayOf(ownerId)).toBe(utcDayOf(NOW));
  });

  test('a project key request and an owner key request stamp the day too, and a self-hosted server stamps nothing', async () => {
    const [keyOwnerId, ownerKeyOwnerId, selfHostedOwnerId] = [await seedOwner(), await seedOwner(), await seedOwner()];
    const workerEnv = workerEnvWith({ CLOUD_ACCOUNTS_MAX: '13' });
    await mcpPost({ key: await keyOf(keyOwnerId), workerEnv });
    await mcpPost({ key: await seedOwnerKey({ ownerId: ownerKeyOwnerId }), workerEnv });
    await mcpPost({ key: await keyOf(selfHostedOwnerId), workerEnv: workerEnvWith({}) });
    expect([await lastSeenDayOf(keyOwnerId), await lastSeenDayOf(ownerKeyOwnerId), await lastSeenDayOf(selfHostedOwnerId)]).toEqual([
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
