import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, test } from 'vitest';
import type { Env } from '../../src/env';
import { Metric, UsageEvent } from '../../src/telemetry/metric';
import { USAGE_BODY_MAX_BYTES, USAGE_COUNT_MAX, USAGE_ROLLUPS_PER_DAY_MAX } from '../../src/telemetry/telemetry-constants';
import { utcDayOf } from '../../src/telemetry/telemetry-day';
import { USAGE_PATH, serveUsageRollup } from '../../src/telemetry/usage-rollup';
import { type RecordingLimiter, recordingLimiter } from '../email-sign-in-client';
import { workerEnvWith } from '../owner-client';

const API_ORIGIN = 'https://api.todz.app';
const INSTALL_IDENTIFIER = '5b0c9d0e-7f1a-4c53-9a39-0d4f8b2f3e11';
const CLIENT_ADDRESS = '203.0.113.9';
const SMALL_BODY_MAX_BYTES = 1024;
const NO_CONTENT_STATUS = 204;
const NOT_FOUND_STATUS = 404;
const METHOD_NOT_ALLOWED_STATUS = 405;
const TOO_LARGE_STATUS = 413;
const UNPROCESSABLE_STATUS = 422;
const TOO_MANY_STATUS = 429;
const UNAVAILABLE_STATUS = 503;

type StoredRow = { day: string; metric: string; dimension: string; count: number };
type Limiters = { client: RecordingLimiter; install: RecordingLimiter; global: RecordingLimiter };

const VALID_ROLLUP = {
  installId: INSTALL_IDENTIFIER,
  appVersion: '0.2.1',
  macosMajor: 15,
  counts: { [UsageEvent.PopoverOpened]: 3, [UsageEvent.DayClosed]: 1 },
};

function limiters({ refusing = [] }: { refusing?: (keyof Limiters)[] } = {}): Limiters {
  return {
    client: recordingLimiter({ isAllowed: !refusing.includes('client') }),
    install: recordingLimiter({ isAllowed: !refusing.includes('install') }),
    global: recordingLimiter({ isAllowed: !refusing.includes('global') }),
  };
}

function settingsOf({ recorded, isTelemetryOff = false }: { recorded: Limiters; isTelemetryOff?: boolean }): Partial<Env> {
  return {
    TELEMETRY: isTelemetryOff ? undefined : 'on',
    USAGE_LIMITER: recorded.client.limiter,
    USAGE_INSTALL_LIMITER: recorded.install.limiter,
    USAGE_GLOBAL_LIMITER: recorded.global.limiter,
  };
}

function rollupRequest({ body, method = 'POST' }: { body: string; method?: string }): Request {
  const hasBody = method === 'POST';
  return new Request(`${API_ORIGIN}${USAGE_PATH}`, {
    method,
    body: hasBody ? body : undefined,
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': String(new TextEncoder().encode(body).length),
      'CF-Connecting-IP': CLIENT_ADDRESS,
    },
  });
}

function sent({ rollup, settings }: { rollup: unknown; settings: Partial<Env> }): Promise<Response> {
  return serveUsageRollup({ request: rollupRequest({ body: JSON.stringify(rollup) }), env: workerEnvWith(settings) });
}

async function storedRows(): Promise<StoredRow[]> {
  const { results } = await env.DIRECTORY.prepare(
    'SELECT day, metric, dimension, count FROM metrics_daily ORDER BY metric, dimension',
  ).all<StoredRow>();
  return results;
}

beforeEach(async () => {
  await env.DIRECTORY.prepare('DELETE FROM metrics_daily').run();
});

describe('a valid rollup', () => {
  test('it is accepted and becomes one rollup, one version row and one row per event', async () => {
    const response = await sent({ rollup: VALID_ROLLUP, settings: settingsOf({ recorded: limiters() }) });
    expect(response.status).toBe(NO_CONTENT_STATUS);
    const day = utcDayOf(Date.now());
    expect(await storedRows()).toEqual([
      { day, metric: Metric.UsageEvents, dimension: UsageEvent.DayClosed, count: 1 },
      { day, metric: Metric.UsageEvents, dimension: UsageEvent.PopoverOpened, count: 3 },
      { day, metric: Metric.UsageRollups, dimension: '', count: 1 },
      { day, metric: Metric.UsageVersions, dimension: '0.2.1|15', count: 1 },
    ]);
  });

  test('an event with a zero count writes no row', async () => {
    await sent({ rollup: { ...VALID_ROLLUP, counts: { [UsageEvent.PopoverOpened]: 0 } }, settings: settingsOf({ recorded: limiters() }) });
    expect((await storedRows()).map(({ metric }) => metric)).toEqual([Metric.UsageRollups, Metric.UsageVersions]);
  });

  test('the install identifier and the client address are never stored', async () => {
    await sent({ rollup: VALID_ROLLUP, settings: settingsOf({ recorded: limiters() }) });
    const stored = JSON.stringify(await storedRows());
    expect(stored).not.toContain(INSTALL_IDENTIFIER);
    expect(stored).not.toContain(CLIENT_ADDRESS);
  });

  test('the identifier only keys the per-install limiter', async () => {
    const recorded = limiters();
    await sent({ rollup: VALID_ROLLUP, settings: settingsOf({ recorded }) });
    expect(recorded.install.keys).toEqual([INSTALL_IDENTIFIER]);
    expect(recorded.client.keys).toEqual([CLIENT_ADDRESS]);
  });

  test('the fullest possible rollup stays under one kilobyte', () => {
    const fullest = {
      installId: INSTALL_IDENTIFIER,
      appVersion: '999.999.999',
      macosMajor: 99,
      counts: Object.fromEntries(Object.values(UsageEvent).map((event) => [event, USAGE_COUNT_MAX])),
    };
    expect(new TextEncoder().encode(JSON.stringify(fullest)).length).toBeLessThan(SMALL_BODY_MAX_BYTES);
  });
});

describe('the size limit', () => {
  test('a body over two kilobytes is refused with 413 before it is parsed', async () => {
    const recorded = limiters();
    const response = await serveUsageRollup({
      request: rollupRequest({ body: 'x'.repeat(USAGE_BODY_MAX_BYTES + 1) }),
      env: workerEnvWith(settingsOf({ recorded })),
    });
    expect(response.status).toBe(TOO_LARGE_STATUS);
    expect(await storedRows()).toEqual([]);
  });

  test('a valid rollup padded past two kilobytes is refused with 413', async () => {
    const padded = { ...VALID_ROLLUP, padding: 'x'.repeat(USAGE_BODY_MAX_BYTES) };
    const response = await sent({ rollup: padded, settings: settingsOf({ recorded: limiters() }) });
    expect(response.status).toBe(TOO_LARGE_STATUS);
  });
});

describe('the shape', () => {
  test.each([
    ['an event outside the allow-list', { ...VALID_ROLLUP, counts: { screen_time: 1 } }],
    ['a negative count', { ...VALID_ROLLUP, counts: { [UsageEvent.PopoverOpened]: -1 } }],
    ['a fractional count', { ...VALID_ROLLUP, counts: { [UsageEvent.PopoverOpened]: 1.5 } }],
    ['a count over the cap', { ...VALID_ROLLUP, counts: { [UsageEvent.PopoverOpened]: USAGE_COUNT_MAX + 1 } }],
    ['a string count', { ...VALID_ROLLUP, counts: { [UsageEvent.PopoverOpened]: '3' } }],
    ['an extra field', { ...VALID_ROLLUP, email: 'maria@example.com' }],
    ['a timestamp', { ...VALID_ROLLUP, at: 1_700_000_000_000 }],
    ['an identifier that is not a UUID', { ...VALID_ROLLUP, installId: 'maria' }],
    ['an app version that is not a version', { ...VALID_ROLLUP, appVersion: 'Todz 0.2.1' }],
    ['a macOS major version that is text', { ...VALID_ROLLUP, macosMajor: 'Sequoia' }],
  ])('%s is refused with 422 and stores nothing', async (_name, rollup) => {
    const response = await sent({ rollup, settings: settingsOf({ recorded: limiters() }) });
    expect(response.status).toBe(UNPROCESSABLE_STATUS);
    expect(await storedRows()).toEqual([]);
  });

  test('a body that is not JSON is refused with 422', async () => {
    const response = await serveUsageRollup({
      request: rollupRequest({ body: 'not json' }),
      env: workerEnvWith(settingsOf({ recorded: limiters() })),
    });
    expect(response.status).toBe(UNPROCESSABLE_STATUS);
  });

  test('a method other than POST is refused', async () => {
    const response = await serveUsageRollup({
      request: rollupRequest({ body: '', method: 'GET' }),
      env: workerEnvWith(settingsOf({ recorded: limiters() })),
    });
    expect(response.status).toBe(METHOD_NOT_ALLOWED_STATUS);
  });
});

describe('the self-host default', () => {
  test('a server with the variable unset has no such route and stores nothing', async () => {
    const response = await sent({ rollup: VALID_ROLLUP, settings: settingsOf({ recorded: limiters(), isTelemetryOff: true }) });
    expect(response.status).toBe(NOT_FOUND_STATUS);
    expect(await storedRows()).toEqual([]);
  });
});

describe('the rate limit and the caps', () => {
  test.each<keyof Limiters>(['client', 'install', 'global'])(
    'a refusal from the %s limiter is a 429 with Retry-After and stores nothing',
    async (refusing) => {
      const response = await sent({ rollup: VALID_ROLLUP, settings: settingsOf({ recorded: limiters({ refusing: [refusing] }) }) });
      expect(response.status).toBe(TOO_MANY_STATUS);
      expect(response.headers.get('Retry-After')).not.toBeNull();
      expect(await storedRows()).toEqual([]);
    },
  );

  test('a missing limiter refuses with 503 instead of accepting unguarded writes', async () => {
    const response = await sent({ rollup: VALID_ROLLUP, settings: { TELEMETRY: 'on' } });
    expect(response.status).toBe(UNAVAILABLE_STATUS);
    expect(await storedRows()).toEqual([]);
  });

  test('past the daily cap of rollups a valid one is refused with 429 and its events are not counted', async () => {
    const day = utcDayOf(Date.now());
    await env.DIRECTORY.prepare("INSERT INTO metrics_daily (day, metric, dimension, count) VALUES (?, 'usage_rollups', '', ?)")
      .bind(day, USAGE_ROLLUPS_PER_DAY_MAX)
      .run();
    const response = await sent({ rollup: VALID_ROLLUP, settings: settingsOf({ recorded: limiters() }) });
    expect(response.status).toBe(TOO_MANY_STATUS);
    expect(await storedRows()).toEqual([{ day, metric: Metric.UsageRollups, dimension: '', count: USAGE_ROLLUPS_PER_DAY_MAX }]);
  });
});
