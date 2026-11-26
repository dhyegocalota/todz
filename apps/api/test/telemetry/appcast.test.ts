import { createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, test } from 'vitest';
import type { Env } from '../../src/env';
import { APPCAST_PATH, serveAppcast } from '../../src/site/appcast';
import { recordingLimiter } from '../email-sign-in-client';
import { workerEnvWith } from '../owner-client';
import { FEED_BODY, assetsServing } from './fake-assets';

const SITE_ORIGIN = 'https://todz.app';
const SPARKLE_AGENT = 'Todz/0.2.1 Sparkle/2.6.4 macOS/15';
const FOUND_STATUS = 200;
const PUBLISHED_VERSION = '0.2.1';
const FORGED_VERSIONS = 60;
const FEED_CONTENT_TYPE = 'application/xml; charset=utf-8';
const FEED_CACHE_CONTROL = 'public, max-age=300';
const CLIENT_ADDRESS = '203.0.113.9';
const OTHER_ADDRESS = '198.51.100.7';

type StoredRow = { day: string; metric: string; dimension: string; count: number };

async function storedRows(): Promise<StoredRow[]> {
  const { results } = await env.DIRECTORY.prepare('SELECT day, metric, dimension, count FROM metrics_daily').all<StoredRow>();
  return results;
}

async function fetched({
  userAgent,
  method = 'GET',
  settings,
  address = CLIENT_ADDRESS,
  path = APPCAST_PATH,
}: {
  userAgent: string | null;
  method?: string;
  settings: Partial<Env>;
  address?: string;
  path?: string;
}): Promise<Response> {
  const headers: Record<string, string> = { 'CF-Connecting-IP': address };
  if (userAgent !== null) headers['User-Agent'] = userAgent;
  const executionContext = createExecutionContext();
  const response = await serveAppcast({
    request: new Request(`${SITE_ORIGIN}${path}`, { method, headers }),
    env: workerEnvWith(settings),
    executionContext,
  });
  await waitOnExecutionContext(executionContext);
  return response;
}

function enabledSettings(): Partial<Env> {
  return {
    TELEMETRY: 'on',
    ASSETS: assetsServing({ published: [PUBLISHED_VERSION] }),
    APPCAST_LIMITER: recordingLimiter({ isAllowed: true }).limiter,
    APPCAST_ADDRESS_LIMITER: recordingLimiter({ isAllowed: true }).limiter,
  };
}

function oncePerKeyLimiter(): RateLimit {
  const seen = new Set<string>();
  return {
    async limit({ key }) {
      const isFirst = !seen.has(key);
      seen.add(key);
      return { success: isFirst };
    },
  };
}

function forgedAgent(index: number): string {
  return `Todz/9.9.${index} Sparkle/2.6.4 macOS/15`;
}

beforeEach(async () => {
  await env.DIRECTORY.prepare('DELETE FROM metrics_daily').run();
});

describe('the appcast request counter', () => {
  test('a Sparkle request is counted per app version and macOS major version, and the asset is still served', async () => {
    const response = await fetched({ userAgent: SPARKLE_AGENT, settings: enabledSettings() });
    expect(response.status).toBe(FOUND_STATUS);
    const rows = await storedRows();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ metric: 'appcast_requests', dimension: '0.2.1|15', count: 1 });
  });

  test('two checks from two addresses of the same version are one row of two', async () => {
    const settings = { ...enabledSettings(), APPCAST_ADDRESS_LIMITER: oncePerKeyLimiter() };
    await fetched({ userAgent: SPARKLE_AGENT, settings });
    await fetched({ userAgent: SPARKLE_AGENT, settings, address: OTHER_ADDRESS });
    expect((await storedRows()).map(({ count }) => count)).toEqual([2]);
  });

  test('a second check from the same address within the window is served and not counted', async () => {
    const settings = { ...enabledSettings(), APPCAST_ADDRESS_LIMITER: oncePerKeyLimiter() };
    const first = await fetched({ userAgent: SPARKLE_AGENT, settings });
    const second = await fetched({ userAgent: SPARKLE_AGENT, settings });
    expect([first.status, second.status]).toEqual([FOUND_STATUS, FOUND_STATUS]);
    expect((await storedRows()).map(({ count }) => count)).toEqual([1]);
  });

  test('the address limiter is keyed by the rate key of the client address', async () => {
    const recorded = recordingLimiter({ isAllowed: true });
    await fetched({ userAgent: SPARKLE_AGENT, settings: { ...enabledSettings(), APPCAST_ADDRESS_LIMITER: recorded.limiter } });
    expect(recorded.keys).toEqual([CLIENT_ADDRESS]);
  });

  test('a missing address limiter serves the appcast and counts nothing', async () => {
    const settings = { ...enabledSettings(), APPCAST_ADDRESS_LIMITER: undefined };
    const response = await fetched({ userAgent: SPARKLE_AGENT, settings });
    expect(response.status).toBe(FOUND_STATUS);
    expect(await storedRows()).toEqual([]);
  });

  test('after sixty forged versions a published version still gets its own row, and the forged ones count into other without a slot', async () => {
    const settings = enabledSettings();
    await Array.from({ length: FORGED_VERSIONS }, (_, index) => forgedAgent(index)).reduce(
      (previous, userAgent) => previous.then(() => fetched({ userAgent, settings }).then(() => undefined)),
      Promise.resolve(),
    );
    await fetched({ userAgent: SPARKLE_AGENT, settings });
    const rows = await storedRows();
    expect(rows.find(({ dimension }) => dimension === '0.2.1|15')?.count).toBe(1);
    expect(rows.find(({ dimension }) => dimension === 'other')?.count).toBe(FORGED_VERSIONS);
    expect(rows).toHaveLength(2);
  });

  test('a macOS major version outside the fixed list counts into other', async () => {
    await fetched({ userAgent: 'Todz/0.2.1 Sparkle/2.6.4 macOS/99', settings: enabledSettings() });
    expect((await storedRows()).map(({ dimension }) => dimension)).toEqual(['other']);
  });

  test('the user agent string and the client address are never stored', async () => {
    await fetched({ userAgent: SPARKLE_AGENT, settings: enabledSettings() });
    const stored = JSON.stringify(await storedRows());
    expect(stored).not.toContain('Sparkle');
    expect(stored).not.toContain(CLIENT_ADDRESS);
  });

  test.each([null, 'Mozilla/5.0 (Macintosh) Safari/605', 'curl/8.4.0'])(
    'the user agent %j is served and not counted',
    async (userAgent) => {
      await fetched({ userAgent, settings: enabledSettings() });
      expect(await storedRows()).toEqual([]);
    },
  );

  test('a HEAD request is not counted', async () => {
    await fetched({ userAgent: SPARKLE_AGENT, method: 'HEAD', settings: enabledSettings() });
    expect(await storedRows()).toEqual([]);
  });

  test('a refused or missing global limiter serves the appcast and counts nothing', async () => {
    const refusing = { ...enabledSettings(), APPCAST_LIMITER: recordingLimiter({ isAllowed: false }).limiter };
    const missing = { ...enabledSettings(), APPCAST_LIMITER: undefined };
    await fetched({ userAgent: SPARKLE_AGENT, settings: refusing });
    await fetched({ userAgent: SPARKLE_AGENT, settings: missing });
    expect(await storedRows()).toEqual([]);
  });

  test('a self-hosted server with the variable unset counts nothing', async () => {
    await fetched({ userAgent: SPARKLE_AGENT, settings: { ...enabledSettings(), TELEMETRY: undefined } });
    expect(await storedRows()).toEqual([]);
  });
});

describe('the feed response', () => {
  test('it carries its content type and a five minute cache even when the assets binding sends no headers', async () => {
    const response = await fetched({ userAgent: SPARKLE_AGENT, settings: enabledSettings() });
    expect(response.headers.get('Content-Type')).toBe(FEED_CONTENT_TYPE);
    expect(response.headers.get('Cache-Control')).toBe(FEED_CACHE_CONTROL);
    expect(await response.text()).toBe(FEED_BODY);
  });

  test('a feed the assets do not have is passed through without the feed headers', async () => {
    const settings = { ...enabledSettings(), ASSETS: { fetch: async () => new Response(null, { status: 404 }) } as unknown as Fetcher };
    const response = await fetched({ userAgent: SPARKLE_AGENT, settings });
    expect(response.status).toBe(404);
    expect(response.headers.get('Cache-Control')).toBeNull();
  });
});
