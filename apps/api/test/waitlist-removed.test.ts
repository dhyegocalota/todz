import { createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { env } from 'cloudflare:workers';
import { beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { digestCredential } from '../src/credential-digest';
import type { Env } from '../src/env';
import worker from '../src/index';
import { AdminPath } from '../src/site/admin-paths';
import { ADMIN_SESSION_LIFETIME_MS, AdminCookie } from '../src/site/admin-session';
import { openAdminSession } from '../src/site/admin-store';
import { applyMigrationNamed, applyMigrationsThrough } from './migration-directory';
import { workerEnvWith } from './owner-client';
import { CLOCK_NOW } from './task-fixtures';

const SITE_ORIGIN = 'https://todz.app';
const ADMIN_ADDRESS = 'hello@todz.app';
const SESSION_SECRET = 'an-admin-session-secret';
const SIGNED_IN_COOKIE = `${AdminCookie.Session}=${SESSION_SECRET}`;
const NOT_FOUND_STATUS = 404;
const SEE_OTHER_STATUS = 303;
const OK_STATUS = 200;
const LAST_NUMBER_BEFORE = '0011';
const MIGRATION_NAME = '0013_drop_waitlist.sql';
const WAITLIST_PATTERN = /waitlist|wait list|failed confirmations/i;
const FORM_CONTENT_TYPE = 'application/x-www-form-urlencoded';
const ADMIN_SETTINGS: Partial<Env> = {
  SITE_ORIGIN,
  PUBLIC_ORIGIN: 'https://api.todz.app',
  SIGN_IN_PROVIDER: 'fake',
  ADMIN_EMAIL: ADMIN_ADDRESS,
};

type EdgeRequest = Request<unknown, IncomingRequestCfProperties>;

async function serve(request: Request): Promise<Response> {
  const executionContext = createExecutionContext();
  const response = await worker.fetch(request as EdgeRequest, workerEnvWith(ADMIN_SETTINGS), executionContext);
  await waitOnExecutionContext(executionContext);
  return response;
}

function signedInRequest({ path, method = 'GET' }: { path: string; method?: string }): Request {
  return new Request(`${SITE_ORIGIN}${path}`, { method, headers: { Cookie: SIGNED_IN_COOKIE }, redirect: 'manual' });
}

async function tableNames(): Promise<string[]> {
  const { results } = await env.MIGRATION_DIRECTORY.prepare("SELECT name FROM sqlite_master WHERE type IN ('table', 'index')").all<{
    name: string;
  }>();
  return results.map(({ name }) => name);
}

describe('the join route', () => {
  test.each([['GET'], ['POST']])('%s /join answers 404 with no body', async (method) => {
    const body = method === 'POST' ? new URLSearchParams({ email: 'maria@example.com' }) : undefined;
    const response = await serve(
      new Request(`${SITE_ORIGIN}/join`, { method, headers: { 'Content-Type': FORM_CONTENT_TYPE }, body, redirect: 'manual' }),
    );
    expect(response.status).toBe(NOT_FOUND_STATUS);
    expect(await response.text()).toBe('');
  });
});

describe('the admin once the waitlist is gone', () => {
  beforeEach(async () => {
    await env.DIRECTORY.prepare('DELETE FROM admin_sessions').run();
    await openAdminSession({
      database: env.DIRECTORY,
      digest: await digestCredential(SESSION_SECRET),
      email: ADMIN_ADDRESS,
      now: Date.now(),
      expiresAt: Date.now() + ADMIN_SESSION_LIFETIME_MS,
    });
  });

  test('GET /admin sends a signed-in owner to the metrics', async () => {
    const response = await serve(signedInRequest({ path: AdminPath.Panel }));
    expect(response.status).toBe(SEE_OTHER_STATUS);
    expect(response.headers.get('Location')).toBe(AdminPath.Metrics);
  });

  test('GET /admin/export.csv answers 404 even with a session', async () => {
    const response = await serve(signedInRequest({ path: '/admin/export.csv' }));
    expect(response.status).toBe(NOT_FOUND_STATUS);
  });

  test('the metrics page keeps working and names no waitlist', async () => {
    const response = await serve(signedInRequest({ path: AdminPath.Metrics }));
    expect(response.status).toBe(OK_STATUS);
    const page = await response.text();
    expect(page).toContain('Metrics');
    expect(page).not.toMatch(WAITLIST_PATTERN);
  });

  test('the metrics export keeps working', async () => {
    const response = await serve(signedInRequest({ path: AdminPath.MetricsExport }));
    expect(response.status).toBe(OK_STATUS);
  });
});

describe('the migration that drops the waitlist', () => {
  beforeAll(async () => {
    await applyMigrationsThrough(LAST_NUMBER_BEFORE);
    await env.MIGRATION_DIRECTORY.prepare('INSERT INTO waitlist (address, joined_at) VALUES (?, ?)')
      .bind('maria@example.com', CLOCK_NOW)
      .run();
    await applyMigrationNamed(MIGRATION_NAME);
  });

  test('leaves no waitlist table and no waitlist index', async () => {
    expect((await tableNames()).filter((name) => name.includes('waitlist'))).toEqual([]);
  });

  test('keeps the admin and the metrics tables', async () => {
    expect(await tableNames()).toEqual(expect.arrayContaining(['admin_sessions', 'admin_sign_in_links', 'metrics_daily', 'owners']));
  });
});
