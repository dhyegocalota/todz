import { createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { describe, expect, test } from 'vitest';
import type { Env } from '../src/env';
import worker from '../src/index';
import { workerEnvWith } from './owner-client';

const SITE_ORIGIN = 'https://todz.app';
const API_ORIGIN = 'https://api.todz.app';
const SETTINGS: Partial<Env> = { PUBLIC_ORIGIN: API_ORIGIN, SITE_ORIGIN, SIGN_IN_PROVIDER: 'fake' };
const STOP_PATH = `/day-email/stop?token=${'a'.repeat(64)}`;
const NO_TRANSFORM = 'no-transform';
const HTML_CONTENT_TYPE = 'text/html';

const HTML_PAGES = [
  { name: 'the admin sign-in card', origin: SITE_ORIGIN, path: '/admin' },
  { name: 'the admin link page', origin: SITE_ORIGIN, path: '/admin/sign-in' },
  { name: 'the cloud queue page', origin: SITE_ORIGIN, path: '/cloud-queue' },
  { name: 'the OAuth link page', origin: API_ORIGIN, path: '/oauth/sign-in' },
  { name: 'the app sign-in page', origin: API_ORIGIN, path: '/sign-in' },
  { name: 'the sign-in challenge page', origin: API_ORIGIN, path: '/sign-in/challenge' },
  { name: 'the day-email stop page', origin: API_ORIGIN, path: STOP_PATH },
];

type EdgeRequest = Request<unknown, IncomingRequestCfProperties>;

async function fetched({ origin, path }: { origin: string; path: string }): Promise<Response> {
  const request = new Request(`${origin}${path}`, { headers: { 'User-Agent': 'Mozilla/5.0 Safari/605.1.15' } });
  const executionContext = createExecutionContext();
  const response = await worker.fetch(request as EdgeRequest, workerEnvWith(SETTINGS), executionContext);
  await waitOnExecutionContext(executionContext);
  return response;
}

describe('an HTML page response', () => {
  test.each(HTML_PAGES)('$name is not cached and carries no-transform, so no analytics beacon is injected', async ({ origin, path }) => {
    const response = await fetched({ origin, path });
    expect(response.headers.get('Content-Type')).toContain(HTML_CONTENT_TYPE);
    const cacheControl = response.headers.get('Cache-Control');
    expect(cacheControl).toContain(NO_TRANSFORM);
    expect(cacheControl).toMatch(/no-store|no-cache/);
  });
});
