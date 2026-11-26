import { MILLISECONDS_PER_DAY } from '@todz/types';
import { createExecutionContext } from 'cloudflare:test';
import { env } from 'cloudflare:workers';
import { describe, expect, test } from 'vitest';
import { digestCredential } from '../src/credential-digest';
import type { Env } from '../src/env';
import { utcDayOf } from '../src/telemetry/telemetry-day';
import { SuspensionChoice, serveAdminSuspension } from '../src/site/admin-suspension';
import { serveAdminUsage } from '../src/site/admin-usage';
import { AdminCookie } from '../src/site/admin-session';
import { seedOwner } from './directory-seed';

const ADMIN_EMAIL = 'owner@todz.test';
const OK_STATUS = 200;
const SEE_OTHER_STATUS = 303;
const FORBIDDEN_STATUS = 403;
const SITE_ORIGIN = 'http://localhost:8788';
const SESSION_LIFETIME_MS = 60 * 60 * 1000;

function adminEnv(): Env {
  return { ...env, ADMIN_EMAIL, SITE_ORIGIN };
}

async function sessionCookie(email: string): Promise<string> {
  const secret = crypto.randomUUID();
  const now = Date.now();
  await env.DIRECTORY.prepare('INSERT INTO admin_sessions (digest, email, created_at, expires_at) VALUES (?, ?, ?, ?)')
    .bind(await digestCredential(secret), email, now, now + SESSION_LIFETIME_MS)
    .run();
  return `${AdminCookie.Session}=${secret}`;
}

async function writeUsage({ ownerId, day, writes, bytes }: { ownerId: string; day: string; writes: number; bytes: number }): Promise<void> {
  await env.DIRECTORY.prepare('INSERT INTO owner_usage (owner_id, day, writes, bytes) VALUES (?, ?, ?, ?)')
    .bind(ownerId, day, writes, bytes)
    .run();
}

function usageRequest(cookie: string | null): Request {
  const headers: Record<string, string> = cookie === null ? {} : { Cookie: cookie };
  return new Request(`${SITE_ORIGIN}/admin/usage`, { headers });
}

function suspensionRequest({ cookie, origin, body }: { cookie: string | null; origin: string; body: URLSearchParams }): Request {
  const headers: Record<string, string> = { 'Sec-Fetch-Site': origin, 'Content-Type': 'application/x-www-form-urlencoded' };
  if (cookie !== null) headers.Cookie = cookie;
  return new Request(`${SITE_ORIGIN}/admin/suspensions`, { method: 'POST', headers, body });
}

async function suspendedAt(ownerId: string): Promise<number | null> {
  const row = await env.DIRECTORY.prepare('SELECT suspended_at FROM owners WHERE id = ?')
    .bind(ownerId)
    .first<{ suspended_at: number | null }>();
  if (row === null) throw new Error('the owner row exists');
  return row.suspended_at;
}

describe('the admin usage view', () => {
  test('without an admin session it shows no account', async () => {
    const ownerId = await seedOwner();
    await writeUsage({ ownerId, day: utcDayOf(Date.now()), writes: 3, bytes: 10 });
    const response = await serveAdminUsage({ request: usageRequest(null), env: adminEnv(), executionContext: createExecutionContext() });
    expect(response.status).toBe(OK_STATUS);
    expect(await response.text()).not.toContain(ownerId);
  });

  test('a session of another email shows no account', async () => {
    const ownerId = await seedOwner();
    await writeUsage({ ownerId, day: utcDayOf(Date.now()), writes: 3, bytes: 10 });
    const cookie = await sessionCookie('someone@todz.test');
    const response = await serveAdminUsage({ request: usageRequest(cookie), env: adminEnv(), executionContext: createExecutionContext() });
    expect(await response.text()).not.toContain(ownerId);
  });

  test('the admin sees the owners with writes in the last seven days, and not older ones', async () => {
    const busy = await seedOwner();
    const stale = await seedOwner();
    const today = Date.now();
    await writeUsage({ ownerId: busy, day: utcDayOf(today), writes: 7, bytes: 100 });
    await writeUsage({ ownerId: stale, day: utcDayOf(today - 30 * MILLISECONDS_PER_DAY), writes: 9, bytes: 900 });
    const cookie = await sessionCookie(ADMIN_EMAIL);
    const response = await serveAdminUsage({ request: usageRequest(cookie), env: adminEnv(), executionContext: createExecutionContext() });
    const html = await response.text();
    expect(html).toContain(busy);
    expect(html).not.toContain(stale);
  });
});

describe('the admin suspension switch', () => {
  test('a foreign origin changes nothing', async () => {
    const ownerId = await seedOwner();
    const cookie = await sessionCookie(ADMIN_EMAIL);
    const body = new URLSearchParams({ owner: ownerId, choice: SuspensionChoice.Suspend });
    const response = await serveAdminSuspension({
      request: suspensionRequest({ cookie, origin: 'cross-site', body }),
      env: adminEnv(),
      executionContext: createExecutionContext(),
    });
    expect(response.status).toBe(FORBIDDEN_STATUS);
    expect(await suspendedAt(ownerId)).toBeNull();
  });

  test('without the admin session it changes nothing', async () => {
    const ownerId = await seedOwner();
    const body = new URLSearchParams({ owner: ownerId, choice: SuspensionChoice.Suspend });
    const response = await serveAdminSuspension({
      request: suspensionRequest({ cookie: null, origin: 'same-origin', body }),
      env: adminEnv(),
      executionContext: createExecutionContext(),
    });
    expect(response.status).toBe(SEE_OTHER_STATUS);
    expect(await suspendedAt(ownerId)).toBeNull();
  });

  test('the admin suspends and restores an owner, and is sent back to the usage page', async () => {
    const ownerId = await seedOwner();
    const cookie = await sessionCookie(ADMIN_EMAIL);
    const suspend = await serveAdminSuspension({
      request: suspensionRequest({
        cookie,
        origin: 'same-origin',
        body: new URLSearchParams({ owner: ownerId, choice: SuspensionChoice.Suspend }),
      }),
      env: adminEnv(),
      executionContext: createExecutionContext(),
    });
    expect(suspend.status).toBe(SEE_OTHER_STATUS);
    expect(suspend.headers.get('Location')).toBe('/admin/usage');
    expect(await suspendedAt(ownerId)).not.toBeNull();
    await serveAdminSuspension({
      request: suspensionRequest({
        cookie,
        origin: 'same-origin',
        body: new URLSearchParams({ owner: ownerId, choice: SuspensionChoice.Restore }),
      }),
      env: adminEnv(),
      executionContext: createExecutionContext(),
    });
    expect(await suspendedAt(ownerId)).toBeNull();
  });
});
