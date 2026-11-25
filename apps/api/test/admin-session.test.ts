import { MILLISECONDS_PER_HOUR, MILLISECONDS_PER_MINUTE } from '@todz/types';
import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, test } from 'vitest';
import { digestCredential } from '../src/credential-digest';
import type { Env } from '../src/env';
import { openAdminSession } from '../src/site/admin-store';
import {
  ADMIN_SESSION_LIFETIME_MS,
  ADMIN_SIGN_IN_LINK_LIFETIME_MS,
  AdminCookie,
  adminCookieHeaderOf,
  adminCookieValueOf,
  adminEmailOf,
  clearedAdminCookieHeaderOf,
  hasAdminSession,
  isSameOriginPost,
} from '../src/site/admin-session';
import { workerEnvWith } from './owner-client';
import { CLOCK_NOW } from './task-fixtures';

const SITE_ORIGIN = 'https://todz.app';
const API_ORIGIN = 'https://api.todz.app';
const ADMIN_ADDRESS = 'hello@todz.app';
const SECRET = 'a-session-secret';
const ATTRIBUTES = 'Path=/; Secure; HttpOnly; SameSite=Strict';
const CHALLENGE_MAX_AGE = 900;
const SESSION_MAX_AGE = 43_200;

function postWith(headers: Record<string, string>): Request {
  return new Request(`${SITE_ORIGIN}/admin/sign-out`, { method: 'POST', headers });
}

function siteEnv(settings: Partial<Env> = {}): Env {
  return workerEnvWith({ SITE_ORIGIN, ADMIN_EMAIL: ADMIN_ADDRESS, ...settings });
}

function cookieRequest(cookie: string): Request {
  return postWith({ Cookie: cookie });
}

beforeEach(async () => {
  await env.DIRECTORY.prepare('DELETE FROM admin_sessions').run();
});

describe('the admin lifetimes', () => {
  test('a link lasts fifteen minutes and a session twelve hours', () => {
    expect(ADMIN_SIGN_IN_LINK_LIFETIME_MS).toBe(15 * MILLISECONDS_PER_MINUTE);
    expect(ADMIN_SESSION_LIFETIME_MS).toBe(12 * MILLISECONDS_PER_HOUR);
  });
});

describe('the admin cookies', () => {
  test('the challenge cookie is a host cookie for fifteen minutes with every protective attribute', () => {
    expect(adminCookieHeaderOf({ cookie: AdminCookie.Challenge, value: SECRET })).toBe(
      `__Host-todz_admin_challenge=${SECRET}; ${ATTRIBUTES}; Max-Age=${CHALLENGE_MAX_AGE}`,
    );
  });

  test('the session cookie is a host cookie for twelve hours with every protective attribute', () => {
    expect(adminCookieHeaderOf({ cookie: AdminCookie.Session, value: SECRET })).toBe(
      `__Host-todz_admin=${SECRET}; ${ATTRIBUTES}; Max-Age=${SESSION_MAX_AGE}`,
    );
  });

  test.each([
    [AdminCookie.Challenge, '__Host-todz_admin_challenge'],
    [AdminCookie.Session, '__Host-todz_admin'],
  ])('clearing %s empties it and expires it at once with the same attributes', (cookie, name) => {
    expect(clearedAdminCookieHeaderOf({ cookie })).toBe(`${name}=; ${ATTRIBUTES}; Max-Age=0`);
  });
});

describe('reading an admin cookie', () => {
  test('it finds the cookie among others', () => {
    const request = cookieRequest(`theme=dark; ${AdminCookie.Session}=${SECRET}; other=1`);
    expect(adminCookieValueOf({ request, cookie: AdminCookie.Session })).toBe(SECRET);
  });

  test('the session cookie is not read from the challenge cookie, nor the reverse', () => {
    const request = cookieRequest(`${AdminCookie.Challenge}=challenge-value`);
    expect(adminCookieValueOf({ request, cookie: AdminCookie.Session })).toBeNull();
    expect(adminCookieValueOf({ request, cookie: AdminCookie.Challenge })).toBe('challenge-value');
  });

  test('a request without a cookie header has no cookie', () => {
    expect(adminCookieValueOf({ request: postWith({}), cookie: AdminCookie.Session })).toBeNull();
  });

  test('a cookie with another name that only ends like it is not read', () => {
    const request = cookieRequest(`x${AdminCookie.Session}=${SECRET}`);
    expect(adminCookieValueOf({ request, cookie: AdminCookie.Session })).toBeNull();
  });

  test('two cookies of one name fail closed', () => {
    const request = cookieRequest(`${AdminCookie.Session}=first; ${AdminCookie.Session}=second`);
    expect(adminCookieValueOf({ request, cookie: AdminCookie.Session })).toBeNull();
  });

  test('a value that holds an equals sign is kept whole', () => {
    const request = cookieRequest(`${AdminCookie.Session}=a=b`);
    expect(adminCookieValueOf({ request, cookie: AdminCookie.Session })).toBe('a=b');
  });

  test('an empty value is no cookie', () => {
    const request = cookieRequest(`${AdminCookie.Session}=`);
    expect(adminCookieValueOf({ request, cookie: AdminCookie.Session })).toBeNull();
  });
});

describe('the same-origin rule of the admin posts', () => {
  test.each([
    ['Sec-Fetch-Site: same-origin', { 'Sec-Fetch-Site': 'same-origin' }],
    ['Sec-Fetch-Site: same-origin with a foreign Origin', { 'Sec-Fetch-Site': 'same-origin', Origin: 'https://evil.example' }],
    ['no Sec-Fetch-Site and Origin equal to the site', { Origin: SITE_ORIGIN }],
  ])('%s is accepted', (_name, headers) => {
    expect(isSameOriginPost({ request: postWith(headers), env: siteEnv() })).toBe(true);
  });

  test.each([
    ['Sec-Fetch-Site: cross-site', { 'Sec-Fetch-Site': 'cross-site' }],
    ['Sec-Fetch-Site: cross-site with the site Origin', { 'Sec-Fetch-Site': 'cross-site', Origin: SITE_ORIGIN }],
    ['Sec-Fetch-Site: same-site with the API Origin', { 'Sec-Fetch-Site': 'same-site', Origin: API_ORIGIN }],
    ['Sec-Fetch-Site: none', { 'Sec-Fetch-Site': 'none' }],
    ['no Sec-Fetch-Site and a foreign Origin', { Origin: 'https://evil.example' }],
    ['no Sec-Fetch-Site and the API Origin', { Origin: API_ORIGIN }],
    ['neither header', {}],
  ])('%s is refused', (_name, headers) => {
    expect(isSameOriginPost({ request: postWith(headers), env: siteEnv() })).toBe(false);
  });

  test('without a SITE_ORIGIN nothing is same-origin', () => {
    const request = postWith({ Origin: SITE_ORIGIN });
    expect(isSameOriginPost({ request, env: siteEnv({ SITE_ORIGIN: undefined }) })).toBe(false);
  });
});

describe('the admin address', () => {
  test('it is the configured address, normalised', () => {
    expect(adminEmailOf(siteEnv({ ADMIN_EMAIL: ' Hello@Todz.app ' }))).toBe(ADMIN_ADDRESS);
  });

  test.each([undefined, '', 'not-an-address'])('%s is no address', (configured) => {
    expect(adminEmailOf(siteEnv({ ADMIN_EMAIL: configured }))).toBeNull();
  });
});

describe('whether a request carries an admin session', () => {
  async function openSession({ email = ADMIN_ADDRESS, expiresAt = CLOCK_NOW + ADMIN_SESSION_LIFETIME_MS } = {}): Promise<void> {
    await openAdminSession({ database: env.DIRECTORY, digest: await digestCredential(SECRET), email, now: CLOCK_NOW, expiresAt });
  }

  function sessionRequest(cookie = `${AdminCookie.Session}=${SECRET}`): Request {
    return cookieRequest(cookie);
  }

  test('a live session of the admin is a session', async () => {
    await openSession();
    expect(await hasAdminSession({ request: sessionRequest(), env: siteEnv(), now: CLOCK_NOW })).toBe(true);
  });

  test('an expired session is none', async () => {
    await openSession();
    expect(await hasAdminSession({ request: sessionRequest(), env: siteEnv(), now: CLOCK_NOW + ADMIN_SESSION_LIFETIME_MS })).toBe(false);
  });

  test('a cookie with an unknown secret is none', async () => {
    await openSession();
    const request = sessionRequest(`${AdminCookie.Session}=another-secret`);
    expect(await hasAdminSession({ request, env: siteEnv(), now: CLOCK_NOW })).toBe(false);
  });

  test('a request without the cookie is none', async () => {
    await openSession();
    expect(await hasAdminSession({ request: postWith({}), env: siteEnv(), now: CLOCK_NOW })).toBe(false);
  });

  test('the challenge cookie is not a session', async () => {
    await openSession();
    const request = sessionRequest(`${AdminCookie.Challenge}=${SECRET}`);
    expect(await hasAdminSession({ request, env: siteEnv(), now: CLOCK_NOW })).toBe(false);
  });

  test('two session cookies are none, even when one is live', async () => {
    await openSession();
    const request = sessionRequest(`${AdminCookie.Session}=${SECRET}; ${AdminCookie.Session}=${SECRET}`);
    expect(await hasAdminSession({ request, env: siteEnv(), now: CLOCK_NOW })).toBe(false);
  });

  test('a session is none once ADMIN_EMAIL is unset or invalid', async () => {
    await openSession();
    expect(await hasAdminSession({ request: sessionRequest(), env: siteEnv({ ADMIN_EMAIL: undefined }), now: CLOCK_NOW })).toBe(false);
    expect(await hasAdminSession({ request: sessionRequest(), env: siteEnv({ ADMIN_EMAIL: 'not-an-address' }), now: CLOCK_NOW })).toBe(
      false,
    );
  });

  test('a session is none once ADMIN_EMAIL names another address', async () => {
    await openSession();
    const request = sessionRequest();
    expect(await hasAdminSession({ request, env: siteEnv({ ADMIN_EMAIL: 'other@todz.app' }), now: CLOCK_NOW })).toBe(false);
  });
});
