import { env } from 'cloudflare:workers';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { BudgetDimension, BudgetLevel, budgetStatusOf, estimatedUsageOf } from '../src/cloud-budget';
import { runCloudCapacity } from '../src/cloud-capacity-run';
import { CLOUD_COPY } from '../src/cloud-copy';
import { isReadThrottled } from '../src/cloud-read-throttle';
import { enqueueAddress } from '../src/cloud-queue-store';
import type { Env } from '../src/env';
import { fairUseLimitsOf } from '../src/fair-use-limits';
import { fairUseRefusalResponse } from '../src/owner-write-quota';
import { WriteRefusal } from '../src/owner-usage-store';
import { reserveWrites } from '../src/owner-write-quota';
import { seedEmailIdentity, seedOwner } from './directory-seed';
import { bindingFailingWith, freshAddress, recordingBinding, recordingLimiter } from './email-sign-in-client';
import { workerEnvWith } from './owner-client';

const FIRST_OF_MONTH_NIGHT = Date.parse('2026-11-01T03:00:00Z');
const NEXT_MONTH_START = Date.parse('2026-12-01T00:00:00Z');
const USAGE_DAY = '2026-11-01';
const OWNER_ADDRESS = 'owner@example.com';
const ANALYTICS_TOKEN = 'analytics-token-for-tests';
const WARNING_WRITES = 800_000;
const REFUSING_WRITES = 960_000;
const WARNING_EMAILS = 2_400;
const REFUSING_EMAILS = 2_850;
const TOO_MANY_REQUESTS_STATUS = 429;

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

async function seedMails(count: number): Promise<void> {
  const statement = env.DIRECTORY.prepare('INSERT INTO mail_meter (address, sent_at) VALUES (?, ?)');
  await env.DIRECTORY.batch(Array.from({ length: count }, () => statement.bind(freshAddress(), FIRST_OF_MONTH_NIGHT - 1)));
}

function refusalOf({ settings, ownerId }: { settings: Partial<Env>; ownerId: string }): Promise<WriteRefusal | null> {
  return reserveWrites({ env: cloudEnv(settings), ownerId, now: FIRST_OF_MONTH_NIGHT, writes: 1, bytes: 1 });
}

function analyticsAnswer({
  durableObjectRequests,
  workerRequests = 0,
  rowsWritten = 0,
}: {
  durableObjectRequests: number;
  workerRequests?: number;
  rowsWritten?: number;
}): Response {
  return Response.json({
    data: {
      viewer: {
        accounts: [
          {
            durableObjectsInvocationsAdaptiveGroups: [{ sum: { requests: durableObjectRequests } }],
            workersInvocationsAdaptive: [{ sum: { requests: workerRequests } }],
            d1AnalyticsAdaptiveGroups: [{ sum: { rowsWritten } }],
          },
        ],
      },
    },
    errors: null,
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

beforeEach(async () => {
  await env.DIRECTORY.batch([
    env.DIRECTORY.prepare('DELETE FROM owner_usage'),
    env.DIRECTORY.prepare('DELETE FROM cloud_budget'),
    env.DIRECTORY.prepare('DELETE FROM cloud_queue'),
    env.DIRECTORY.prepare('DELETE FROM mail_meter'),
    env.DIRECTORY.prepare('DELETE FROM owner_identities WHERE subject = ?').bind(OWNER_ADDRESS),
  ]);
});

describe('the budget thresholds', () => {
  test('a quiet month is normal', () => {
    expect(budgetStatusOf(estimatedUsageOf({ monthWrites: 0, readRequests: 0, emails: 0 })).level).toBe(BudgetLevel.Normal);
  });

  test('80% of Durable Object requests warns and names the dimension', () => {
    expect(budgetStatusOf(estimatedUsageOf({ monthWrites: WARNING_WRITES, readRequests: 0, emails: 0 }))).toEqual({
      level: BudgetLevel.Warning,
      dimension: BudgetDimension.DurableObjectRequests,
    });
  });

  test('95% of Durable Object requests refuses', () => {
    expect(budgetStatusOf(estimatedUsageOf({ monthWrites: REFUSING_WRITES, readRequests: 0, emails: 0 })).level).toBe(BudgetLevel.Refusing);
  });

  test('reads count toward the request dimensions of the estimate', () => {
    expect(budgetStatusOf(estimatedUsageOf({ monthWrites: 0, readRequests: WARNING_WRITES, emails: 0 })).level).toBe(BudgetLevel.Warning);
  });

  test('emails are metered against the 3,000 included', () => {
    expect(budgetStatusOf(estimatedUsageOf({ monthWrites: 0, readRequests: 0, emails: WARNING_EMAILS }))).toEqual({
      level: BudgetLevel.Warning,
      dimension: BudgetDimension.Emails,
    });
    expect(budgetStatusOf(estimatedUsageOf({ monthWrites: 0, readRequests: 0, emails: REFUSING_EMAILS })).level).toBe(BudgetLevel.Refusing);
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

  test('a warning mail that fails is not stamped, so the next night sends it', async () => {
    await seedWrites({ ownerId: await seedOwner(), writes: WARNING_WRITES });
    const failing = { scheduledTime: FIRST_OF_MONTH_NIGHT, env: cloudEnv({ EMAIL: bindingFailingWith(new Error('mail down')) }) };
    await expect(runCloudCapacity(failing)).rejects.toThrow('the cloud capacity run failed 1 of 2 parts');
    const { binding, sent } = recordingBinding();
    await runCloudCapacity({ scheduledTime: FIRST_OF_MONTH_NIGHT, env: cloudEnv({ EMAIL: binding }) });
    expect(sent.map((message) => message.subject)).toEqual([CLOUD_COPY.warning.subject]);
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

  test('every metered mail counts toward the emails dimension', async () => {
    const { binding, sent } = recordingBinding();
    await seedMails(WARNING_EMAILS);
    await runCloudCapacity({ scheduledTime: FIRST_OF_MONTH_NIGHT, env: cloudEnv({ EMAIL: binding }) });
    expect(sent.map((message) => message.text)).toEqual([CLOUD_COPY.warning.textOf(BudgetDimension.Emails)]);
  });

  test('the guard prunes the meter of mail older than the month before', async () => {
    const { binding } = recordingBinding();
    const statement = env.DIRECTORY.prepare('INSERT INTO mail_meter (address, sent_at) VALUES (?, ?)');
    await env.DIRECTORY.batch([
      statement.bind(freshAddress(), FIRST_OF_MONTH_NIGHT - 40 * 86_400_000),
      statement.bind(freshAddress(), FIRST_OF_MONTH_NIGHT),
    ]);
    await runCloudCapacity({ scheduledTime: FIRST_OF_MONTH_NIGHT, env: cloudEnv({ EMAIL: binding }) });
    const row = await env.DIRECTORY.prepare('SELECT COUNT(*) AS mails FROM mail_meter').first<{ mails: number }>();
    expect(row?.mails).toBe(1);
  });
});

describe('the measured month from Cloudflare analytics', () => {
  test('with the token the totals come from the analytics and name the dimension they reach', async () => {
    const { binding, sent } = recordingBinding();
    const analytics = vi.spyOn(globalThis, 'fetch').mockResolvedValue(analyticsAnswer({ durableObjectRequests: WARNING_WRITES }));
    await runCloudCapacity({
      scheduledTime: FIRST_OF_MONTH_NIGHT,
      env: cloudEnv({ EMAIL: binding, CLOUDFLARE_ANALYTICS_TOKEN: ANALYTICS_TOKEN }),
    });
    expect(sent.map((message) => message.text)).toEqual([CLOUD_COPY.warning.textOf(BudgetDimension.DurableObjectRequests)]);
    const [url, init] = analytics.mock.calls[0] ?? [];
    expect(url).toBe('https://api.cloudflare.com/client/v4/graphql');
    expect(new Headers(init?.headers).get('Authorization')).toBe(`Bearer ${ANALYTICS_TOKEN}`);
    expect(String(init?.body)).toContain('durableObjectsInvocationsAdaptiveGroups');
  });

  test('the measured totals refuse heavy writers at 95% where the estimate saw nothing', async () => {
    const { binding } = recordingBinding();
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(analyticsAnswer({ durableObjectRequests: REFUSING_WRITES }));
    const heavyOwnerId = await seedOwner();
    await seedWrites({ ownerId: heavyOwnerId, writes: 10 });
    await runCloudCapacity({
      scheduledTime: FIRST_OF_MONTH_NIGHT,
      env: cloudEnv({ EMAIL: binding, CLOUDFLARE_ANALYTICS_TOKEN: ANALYTICS_TOKEN }),
    });
    expect(await refusalOfHeavy({ ownerId: heavyOwnerId })).toBe(WriteRefusal.CloudAtCapacity);
  });

  test('without the token the estimate from D1 stands and Cloudflare is not asked', async () => {
    const { binding } = recordingBinding();
    const analytics = vi.spyOn(globalThis, 'fetch');
    await seedWrites({ ownerId: await seedOwner(), writes: WARNING_WRITES });
    await runCloudCapacity({ scheduledTime: FIRST_OF_MONTH_NIGHT, env: cloudEnv({ EMAIL: binding }) });
    expect(analytics).not.toHaveBeenCalled();
  });

  test('the nightly run logs once that it is estimate only when the cap is on and the token is missing', async () => {
    const { binding } = recordingBinding();
    const log = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    await runCloudCapacity({ scheduledTime: FIRST_OF_MONTH_NIGHT, env: cloudEnv({ EMAIL: binding }) });
    expect(log.mock.calls.filter(([line]) => line === 'budget guard: estimate only')).toHaveLength(1);
  });

  test('with the token the run does not log estimate only', async () => {
    const { binding } = recordingBinding();
    const log = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(analyticsAnswer({ durableObjectRequests: 0 }));
    await runCloudCapacity({
      scheduledTime: FIRST_OF_MONTH_NIGHT,
      env: cloudEnv({ EMAIL: binding, CLOUDFLARE_ANALYTICS_TOKEN: ANALYTICS_TOKEN }),
    });
    expect(log).not.toHaveBeenCalledWith('budget guard: estimate only');
  });

  test('with the cap off no token is needed and nothing is logged', async () => {
    const log = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    await runCloudCapacity({ scheduledTime: FIRST_OF_MONTH_NIGHT, env: workerEnvWith({}) });
    expect(log).not.toHaveBeenCalled();
  });

  test('an analytics answer that is not ok fails the run instead of guessing', async () => {
    const { binding } = recordingBinding();
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 403 }));
    await expect(
      runCloudCapacity({
        scheduledTime: FIRST_OF_MONTH_NIGHT,
        env: cloudEnv({ EMAIL: binding, CLOUDFLARE_ANALYTICS_TOKEN: ANALYTICS_TOKEN }),
      }),
    ).rejects.toThrow('the cloud capacity run failed 1 of 2 parts');
  });

  test('a token that reaches no account fails the run', async () => {
    const { binding } = recordingBinding();
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ data: { viewer: { accounts: [] } }, errors: null }));
    await expect(
      runCloudCapacity({
        scheduledTime: FIRST_OF_MONTH_NIGHT,
        env: cloudEnv({ EMAIL: binding, CLOUDFLARE_ANALYTICS_TOKEN: ANALYTICS_TOKEN }),
      }),
    ).rejects.toThrow('the cloud capacity run failed 1 of 2 parts');
  });
});

async function refusalOfHeavy({ ownerId }: { ownerId: string }): Promise<WriteRefusal | null> {
  return refusalOf({ settings: {}, ownerId });
}

describe('the 95% refusals', () => {
  async function refusingMonth(): Promise<{ heavyOwnerId: string; lightOwnerId: string }> {
    const { binding } = recordingBinding();
    const [heavyOwnerId, lightOwnerId] = [await seedOwner(), await seedOwner()];
    await seedWrites({ ownerId: heavyOwnerId, writes: REFUSING_WRITES });
    await runCloudCapacity({ scheduledTime: FIRST_OF_MONTH_NIGHT, env: cloudEnv({ EMAIL: binding }) });
    return { heavyOwnerId, lightOwnerId };
  }

  test('an account above the average is refused writes and one below keeps writing', async () => {
    const { heavyOwnerId, lightOwnerId } = await refusingMonth();
    expect(await refusalOf({ settings: {}, ownerId: heavyOwnerId })).toBe(WriteRefusal.CloudAtCapacity);
    expect(await refusalOf({ settings: {}, ownerId: lightOwnerId })).toBeNull();
  });

  test('a self-hosted server is never refused', async () => {
    const { heavyOwnerId } = await refusingMonth();
    const selfHosted = reserveWrites({ env: workerEnvWith({}), ownerId: heavyOwnerId, now: FIRST_OF_MONTH_NIGHT, writes: 1, bytes: 1 });
    expect(await selfHosted).not.toBe(WriteRefusal.CloudAtCapacity);
  });

  test('the owner of the admin address is exempt from the refusal', async () => {
    const { heavyOwnerId } = await refusingMonth();
    await seedEmailIdentity({ ownerId: heavyOwnerId, email: OWNER_ADDRESS });
    expect(await refusalOf({ settings: {}, ownerId: heavyOwnerId })).not.toBe(WriteRefusal.CloudAtCapacity);
  });

  test('the refusal is a 429 with the capacity message, the code and the seconds to the first of next month', async () => {
    const response = fairUseRefusalResponse({
      refusal: WriteRefusal.CloudAtCapacity,
      limits: fairUseLimitsOf(workerEnvWith({})),
      now: FIRST_OF_MONTH_NIGHT,
    });
    expect(response.status).toBe(TOO_MANY_REQUESTS_STATUS);
    expect(await response.json()).toEqual({
      error: 'limit_reached',
      limit: 'cloud_capacity',
      message:
        'todz cloud is at capacity this month. Your changes are kept and sync next month, or run your own server: https://docs.todz.app/self-host',
    });
    expect(response.headers.get('Retry-After')).toBe(String((NEXT_MONTH_START - FIRST_OF_MONTH_NIGHT) / 1000));
    expect(CLOUD_COPY.atCapacity).toContain('todz cloud is at capacity this month');
    expect(CLOUD_COPY.atCapacity).toContain('run your own server');
  });

  test('the seconds to the first of next month roll over the year', async () => {
    const response = fairUseRefusalResponse({
      refusal: WriteRefusal.CloudAtCapacity,
      limits: fairUseLimitsOf(workerEnvWith({})),
      now: Date.parse('2026-12-15T12:00:00Z'),
    });
    expect(response.headers.get('Retry-After')).toBe(
      String((Date.parse('2027-01-01T00:00:00Z') - Date.parse('2026-12-15T12:00:00Z')) / 1000),
    );
  });

  test('a heavy account is read-throttled and a light one is not', async () => {
    const { heavyOwnerId, lightOwnerId } = await refusingMonth();
    const deniedReads = recordingLimiter({ isAllowed: false });
    const readEnv = cloudEnv({ CLOUD_READ_LIMITER: deniedReads.limiter });
    const request = new Request('https://todz.app/owner/workspaces');
    expect(await isReadThrottled({ request, env: readEnv, ownerId: heavyOwnerId, now: FIRST_OF_MONTH_NIGHT })).toBe(true);
    expect(await isReadThrottled({ request, env: readEnv, ownerId: lightOwnerId, now: FIRST_OF_MONTH_NIGHT })).toBe(false);
    expect(deniedReads.keys).toEqual([heavyOwnerId]);
  });

  test('a heavy account reads within the allowed rate, and the admin owner is never throttled', async () => {
    const { heavyOwnerId } = await refusingMonth();
    const request = new Request('https://todz.app/owner/workspaces');
    const allowedReads = cloudEnv({ CLOUD_READ_LIMITER: recordingLimiter({ isAllowed: true }).limiter });
    expect(await isReadThrottled({ request, env: allowedReads, ownerId: heavyOwnerId, now: FIRST_OF_MONTH_NIGHT })).toBe(false);
    await seedEmailIdentity({ ownerId: heavyOwnerId, email: OWNER_ADDRESS });
    const deniedReads = cloudEnv({ CLOUD_READ_LIMITER: recordingLimiter({ isAllowed: false }).limiter });
    expect(await isReadThrottled({ request, env: deniedReads, ownerId: heavyOwnerId, now: FIRST_OF_MONTH_NIGHT })).toBe(false);
  });

  test('reads are never throttled without the cap', async () => {
    const { heavyOwnerId } = await refusingMonth();
    const request = new Request('https://todz.app/owner/workspaces');
    const selfHosted = workerEnvWith({ CLOUD_READ_LIMITER: recordingLimiter({ isAllowed: false }).limiter });
    expect(await isReadThrottled({ request, env: selfHosted, ownerId: heavyOwnerId, now: FIRST_OF_MONTH_NIGHT })).toBe(false);
  });
});

describe('the daily queue digest', () => {
  test('the owner gets one email with the count and the newest when the queue grew, and none when it did not', async () => {
    const { binding, sent } = recordingBinding();
    const [older, newer] = [freshAddress(), freshAddress()];
    await enqueueAddress({ directory: env.DIRECTORY, email: older, now: FIRST_OF_MONTH_NIGHT - 2 });
    await enqueueAddress({ directory: env.DIRECTORY, email: newer, now: FIRST_OF_MONTH_NIGHT - 1 });
    const run = { scheduledTime: FIRST_OF_MONTH_NIGHT, env: cloudEnv({ EMAIL: binding }) };
    await runCloudCapacity(run);
    await runCloudCapacity(run);
    expect(sent.map((message) => ({ to: message.to, subject: message.subject, text: message.text }))).toEqual([
      { to: OWNER_ADDRESS, subject: CLOUD_COPY.digest.subject, text: CLOUD_COPY.digest.textOf({ waiting: 2, newest: newer }) },
    ]);
  });

  test('a digest mail that fails leaves the rows fresh, so the next night sends it', async () => {
    const [first, second] = [freshAddress(), freshAddress()];
    await enqueueAddress({ directory: env.DIRECTORY, email: first, now: FIRST_OF_MONTH_NIGHT - 2 });
    await enqueueAddress({ directory: env.DIRECTORY, email: second, now: FIRST_OF_MONTH_NIGHT - 1 });
    const failing = { scheduledTime: FIRST_OF_MONTH_NIGHT, env: cloudEnv({ EMAIL: bindingFailingWith(new Error('mail down')) }) };
    await expect(runCloudCapacity(failing)).rejects.toThrow('the cloud capacity run failed 1 of 2 parts');
    const { binding, sent } = recordingBinding();
    await runCloudCapacity({ scheduledTime: FIRST_OF_MONTH_NIGHT, env: cloudEnv({ EMAIL: binding }) });
    expect(sent.map((message) => message.text)).toEqual([CLOUD_COPY.digest.textOf({ waiting: 2, newest: second })]);
  });

  test('a join after the run time is neither counted nor stamped, so the next digest reports it', async () => {
    const { binding, sent } = recordingBinding();
    const [before, after] = [freshAddress(), freshAddress()];
    await enqueueAddress({ directory: env.DIRECTORY, email: before, now: FIRST_OF_MONTH_NIGHT - 1 });
    await enqueueAddress({ directory: env.DIRECTORY, email: after, now: FIRST_OF_MONTH_NIGHT + 1 });
    await runCloudCapacity({ scheduledTime: FIRST_OF_MONTH_NIGHT, env: cloudEnv({ EMAIL: binding }) });
    await runCloudCapacity({ scheduledTime: FIRST_OF_MONTH_NIGHT + 86_400_000, env: cloudEnv({ EMAIL: binding }) });
    expect(sent.map((message) => message.text)).toEqual([
      CLOUD_COPY.digest.textOf({ waiting: 1, newest: before }),
      CLOUD_COPY.digest.textOf({ waiting: 2, newest: after }),
    ]);
  });
});
