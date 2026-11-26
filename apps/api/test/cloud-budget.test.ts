import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, test } from 'vitest';
import { BudgetDimension, BudgetLevel, budgetStatusOf } from '../src/cloud-budget';
import { runCloudCapacity } from '../src/cloud-capacity-run';
import { CLOUD_COPY } from '../src/cloud-copy';
import { enqueueAddress } from '../src/cloud-queue-store';
import type { Env } from '../src/env';
import { WriteRefusal } from '../src/owner-usage-store';
import { reserveWrites } from '../src/owner-write-quota';
import { seedOwner } from './directory-seed';
import { freshAddress, recordingBinding } from './email-sign-in-client';
import { workerEnvWith } from './owner-client';

const FIRST_OF_MONTH_NIGHT = Date.parse('2026-11-01T03:00:00Z');
const USAGE_DAY = '2026-11-01';
const OWNER_ADDRESS = 'owner@example.com';
const WARNING_WRITES = 800_000;
const REFUSING_WRITES = 960_000;
const WARNING_EMAILS = 2_400;
const REFUSING_EMAILS = 2_850;

function cloudEnv(settings: Partial<Env>): Env {
  return workerEnvWith({
    CLOUD_ACCOUNTS_MAX: '13',
    ADMIN_EMAIL: OWNER_ADDRESS,
    EMAIL_SENDER: 'cloudflare',
    PUBLIC_ORIGIN: 'https://todz.app',
    ...settings,
  });
}

async function seedWrites({ ownerId, writes }: { ownerId: string; writes: number }): Promise<void> {
  await env.DIRECTORY.prepare('INSERT INTO owner_usage (owner_id, day, writes, bytes) VALUES (?, ?, ?, 0)')
    .bind(ownerId, USAGE_DAY, writes)
    .run();
}

function refusalOf({ settings, ownerId }: { settings: Partial<Env>; ownerId: string }): Promise<WriteRefusal | null> {
  return reserveWrites({ env: cloudEnv(settings), ownerId, now: FIRST_OF_MONTH_NIGHT, writes: 1, bytes: 1 });
}

beforeEach(async () => {
  await env.DIRECTORY.batch([
    env.DIRECTORY.prepare('DELETE FROM owner_usage'),
    env.DIRECTORY.prepare('DELETE FROM cloud_budget'),
    env.DIRECTORY.prepare('DELETE FROM cloud_queue'),
  ]);
});

describe('the budget thresholds', () => {
  test('a quiet month is normal', () => {
    expect(budgetStatusOf({ monthWrites: 0, readRequests: 0, emails: 0 }).level).toBe(BudgetLevel.Normal);
  });

  test('80% of Durable Object requests warns and names the dimension', () => {
    expect(budgetStatusOf({ monthWrites: WARNING_WRITES, readRequests: 0, emails: 0 })).toEqual({
      level: BudgetLevel.Warning,
      dimension: BudgetDimension.DurableObjectRequests,
    });
  });

  test('95% of Durable Object requests refuses', () => {
    expect(budgetStatusOf({ monthWrites: REFUSING_WRITES, readRequests: 0, emails: 0 }).level).toBe(BudgetLevel.Refusing);
  });

  test('reads count toward the request dimensions', () => {
    expect(budgetStatusOf({ monthWrites: 0, readRequests: WARNING_WRITES, emails: 0 }).level).toBe(BudgetLevel.Warning);
  });

  test('emails are metered against the 3,000 included', () => {
    expect(budgetStatusOf({ monthWrites: 0, readRequests: 0, emails: WARNING_EMAILS })).toEqual({
      level: BudgetLevel.Warning,
      dimension: BudgetDimension.Emails,
    });
    expect(budgetStatusOf({ monthWrites: 0, readRequests: 0, emails: REFUSING_EMAILS }).level).toBe(BudgetLevel.Refusing);
  });
});

describe('the nightly budget guard', () => {
  test('at 80% the owner is emailed once for the month', async () => {
    const { binding, sent } = recordingBinding();
    await seedWrites({ ownerId: await seedOwner(), writes: WARNING_WRITES });
    const run = { scheduledTime: FIRST_OF_MONTH_NIGHT, env: cloudEnv({ EMAIL: binding }) };
    await runCloudCapacity(run);
    await runCloudCapacity(run);
    expect(sent.map((message) => ({ to: message.to, subject: message.subject }))).toEqual([
      { to: OWNER_ADDRESS, subject: CLOUD_COPY.warning.subject },
    ]);
  });

  test('under 80% nobody is emailed', async () => {
    const { binding, sent } = recordingBinding();
    await runCloudCapacity({ scheduledTime: FIRST_OF_MONTH_NIGHT, env: cloudEnv({ EMAIL: binding }) });
    expect(sent).toEqual([]);
  });

  test('without the cap the guard does nothing', async () => {
    const { binding, sent } = recordingBinding();
    await seedWrites({ ownerId: await seedOwner(), writes: REFUSING_WRITES });
    await runCloudCapacity({
      scheduledTime: FIRST_OF_MONTH_NIGHT,
      env: workerEnvWith({ ADMIN_EMAIL: OWNER_ADDRESS, EMAIL_SENDER: 'cloudflare', PUBLIC_ORIGIN: 'https://todz.app', EMAIL: binding }),
    });
    expect(sent).toEqual([]);
  });

  test('at 95% an account above the average is refused writes and one below keeps writing', async () => {
    const { binding } = recordingBinding();
    const [heavyOwnerId, lightOwnerId] = [await seedOwner(), await seedOwner()];
    await seedWrites({ ownerId: heavyOwnerId, writes: REFUSING_WRITES });
    await runCloudCapacity({ scheduledTime: FIRST_OF_MONTH_NIGHT, env: cloudEnv({ EMAIL: binding }) });
    expect(await refusalOf({ settings: {}, ownerId: heavyOwnerId })).toBe(WriteRefusal.CloudAtCapacity);
    expect(await refusalOf({ settings: {}, ownerId: lightOwnerId })).toBeNull();
  });

  test('at 95% the refusal reads as the capacity copy and a self-hosted server is never refused', async () => {
    const { binding } = recordingBinding();
    const heavyOwnerId = await seedOwner();
    await seedWrites({ ownerId: heavyOwnerId, writes: REFUSING_WRITES });
    await runCloudCapacity({ scheduledTime: FIRST_OF_MONTH_NIGHT, env: cloudEnv({ EMAIL: binding }) });
    const selfHosted = reserveWrites({ env: workerEnvWith({}), ownerId: heavyOwnerId, now: FIRST_OF_MONTH_NIGHT, writes: 1, bytes: 1 });
    expect(await selfHosted).not.toBe(WriteRefusal.CloudAtCapacity);
    expect(CLOUD_COPY.atCapacity).toContain('at capacity this month');
    expect(CLOUD_COPY.atCapacity).toContain('Reading still works');
  });
});

describe('the daily queue digest', () => {
  test('the owner gets one email with the count and the newest when the queue grew, and none when it did not', async () => {
    const { binding, sent } = recordingBinding();
    const [older, newer] = [freshAddress(), freshAddress()];
    await enqueueAddress({ directory: env.DIRECTORY, email: older, now: FIRST_OF_MONTH_NIGHT });
    await enqueueAddress({ directory: env.DIRECTORY, email: newer, now: FIRST_OF_MONTH_NIGHT + 1 });
    const run = { scheduledTime: FIRST_OF_MONTH_NIGHT, env: cloudEnv({ EMAIL: binding }) };
    await runCloudCapacity(run);
    await runCloudCapacity(run);
    expect(sent.map((message) => ({ to: message.to, subject: message.subject, text: message.text }))).toEqual([
      { to: OWNER_ADDRESS, subject: CLOUD_COPY.digest.subject, text: CLOUD_COPY.digest.textOf({ waiting: 2, newest: newer }) },
    ]);
  });
});
