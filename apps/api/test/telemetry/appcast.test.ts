import { createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, test } from 'vitest';
import type { Env } from '../../src/env';
import { APPCAST_PATH, serveAppcast } from '../../src/site/appcast';
import { recordingLimiter } from '../email-sign-in-client';
import { workerEnvWith } from '../owner-client';

const SITE_ORIGIN = 'https://todz.app';
const SPARKLE_AGENT = 'Todz/0.2.1 Sparkle/2.6.4 macOS/15';
const NO_ASSET_STATUS = 404;
const CLIENT_ADDRESS = '203.0.113.9';

type StoredRow = { day: string; metric: string; dimension: string; count: number };

async function storedRows(): Promise<StoredRow[]> {
  const { results } = await env.DIRECTORY.prepare('SELECT day, metric, dimension, count FROM metrics_daily').all<StoredRow>();
  return results;
}

async function fetched({
  userAgent,
  method = 'GET',
  settings,
}: {
  userAgent: string | null;
  method?: string;
  settings: Partial<Env>;
}): Promise<Response> {
  const headers: Record<string, string> = { 'CF-Connecting-IP': CLIENT_ADDRESS };
  if (userAgent !== null) headers['User-Agent'] = userAgent;
  const executionContext = createExecutionContext();
  const response = await serveAppcast({
    request: new Request(`${SITE_ORIGIN}${APPCAST_PATH}`, { method, headers }),
    env: workerEnvWith(settings),
    executionContext,
  });
  await waitOnExecutionContext(executionContext);
  return response;
}

function enabledSettings(): Partial<Env> {
  return { TELEMETRY: 'on', APPCAST_LIMITER: recordingLimiter({ isAllowed: true }).limiter };
}

beforeEach(async () => {
  await env.DIRECTORY.prepare('DELETE FROM metrics_daily').run();
});

describe('the appcast request counter', () => {
  test('a Sparkle request is counted per app version and macOS major version, and the asset is still served', async () => {
    const response = await fetched({ userAgent: SPARKLE_AGENT, settings: enabledSettings() });
    expect(response.status).toBe(NO_ASSET_STATUS);
    const rows = await storedRows();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ metric: 'appcast_requests', dimension: '0.2.1|15', count: 1 });
  });

  test('two requests from the same version are one row of two', async () => {
    await fetched({ userAgent: SPARKLE_AGENT, settings: enabledSettings() });
    await fetched({ userAgent: SPARKLE_AGENT, settings: enabledSettings() });
    expect((await storedRows()).map(({ count }) => count)).toEqual([2]);
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

  test('a refused or missing limiter serves the appcast and counts nothing', async () => {
    const refusing = { TELEMETRY: 'on', APPCAST_LIMITER: recordingLimiter({ isAllowed: false }).limiter };
    await fetched({ userAgent: SPARKLE_AGENT, settings: refusing });
    await fetched({ userAgent: SPARKLE_AGENT, settings: { TELEMETRY: 'on' } });
    expect(await storedRows()).toEqual([]);
  });

  test('a self-hosted server with the variable unset counts nothing', async () => {
    await fetched({ userAgent: SPARKLE_AGENT, settings: { APPCAST_LIMITER: recordingLimiter({ isAllowed: true }).limiter } });
    expect(await storedRows()).toEqual([]);
  });
});
