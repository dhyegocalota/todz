import { MILLISECONDS_PER_DAY } from '@todz/types';
import { createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, test } from 'vitest';
import { digestCredential } from '../src/credential-digest';
import type { Env } from '../src/env';
import worker from '../src/index';
import { serveAdminLinkPage } from '../src/site/admin-link-page';
import { serveAdminPanel, serveAdminSignInPage } from '../src/site/admin-page';
import { ADMIN_RESPONSE_HEADERS, AdminPath } from '../src/site/admin-paths';
import { ADMIN_SESSION_LIFETIME_MS, AdminCookie } from '../src/site/admin-session';
import { openAdminSession } from '../src/site/admin-store';
import { AdminNotice, ConfirmationState } from '../src/site/admin-waitlist';
import { joinWaitlist } from '../src/site/waitlist-store';
import { TURNSTILE_DUMMY_TOKEN } from '../src/turnstile';
import { adminSessionRows } from './admin-client';
import { CLIENT_ADDRESS, CLIENT_ADDRESS_HEADER, TURNSTILE_TEST_SECRET, consoleOutput, mailSent } from './email-sign-in-client';
import { workerEnvWith } from './owner-client';

const API_ORIGIN = 'https://api.todz.app';
const SITE_ORIGIN = 'https://todz.app';
const WWW_ORIGIN = 'https://www.todz.app';
const ADMIN_ADDRESS = 'hello@todz.app';
const SESSION_SECRET = 'an-admin-session-secret';
const OK_STATUS = 200;
const CREATED_STATUS = 201;
const MOVED_PERMANENTLY_STATUS = 301;
const SEE_OTHER_STATUS = 303;
const FORBIDDEN_STATUS = 403;
const NOT_FOUND_STATUS = 404;
const UNAVAILABLE_STATUS = 503;
const SCRIPT_PAYLOAD = '<script>alert(1)</script>';
const FORM_BODY = `email=${SCRIPT_PAYLOAD}`;
const FORM_CONTENT_TYPE = 'application/x-www-form-urlencoded';
const TURNSTILE_TEST_SITE_KEY = '1x00000000000000000000AA';
const PRODUCTION_SETTINGS = { PUBLIC_ORIGIN: API_ORIGIN, SITE_ORIGIN, SIGN_IN_PROVIDER: 'fake' };

type EdgeRequest = Request<unknown, IncomingRequestCfProperties>;

async function serveWith({ request, settings }: { request: Request; settings: Partial<Env> }): Promise<Response> {
  const executionContext = createExecutionContext();
  const response = await worker.fetch(request as EdgeRequest, workerEnvWith({ ...PRODUCTION_SETTINGS, ...settings }), executionContext);
  await waitOnExecutionContext(executionContext);
  return response;
}

function serve(request: Request): Promise<Response> {
  return serveWith({ request, settings: {} });
}

function requestOf({ url, method = 'GET' }: { url: string; method?: string }): Request {
  return new Request(url, { method, redirect: 'manual' });
}

describe('the site host', () => {
  test.each([
    ['GET', '/'],
    ['HEAD', '/'],
    ['GET', '/self-host'],
    ['HEAD', '/self-host'],
  ])('%s %s answers 200', async (method, path) => {
    const response = await serve(requestOf({ url: `${SITE_ORIGIN}${path}`, method }));
    expect(response.status).toBe(OK_STATUS);
  });

  test.each([
    ['GET', '/owner/sign-in-method'],
    ['GET', '/mcp'],
    ['GET', '/sign-in'],
    ['GET', '/sign-in/challenge'],
    ['GET', '/self-host/'],
    ['POST', '/'],
    ['POST', '/self-host'],
    ['GET', '/unknown'],
    ['GET', '//owner/sign-in-method'],
    ['GET', '/%2Fowner/sign-in-method'],
    ['GET', '/owner%2Fsign-in-method'],
    ['GET', '/self-host/../owner/sign-in-method'],
    ['GET', '/landing/%2E%2E/mcp'],
    ['PUT', '/'],
    ['DELETE', '/self-host'],
    ['OPTIONS', '/'],
    ['PUT', '/admin'],
    ['POST', '/admin'],
    ['OPTIONS', '/admin'],
    ['DELETE', '/admin/sessions'],
    ['GET', '/admin/sessions'],
    ['GET', '/admin/sign-in-links'],
    ['GET', '/admin/sign-out'],
    ['POST', '/admin/export.csv'],
    ['POST', '/admin/sign-in'],
    ['GET', '/admin/unknown'],
    ['GET', '/admin/'],
    ['GET', '/admin/sessions/'],
    ['GET', '/ADMIN'],
    ['GET', '/admin%2Fexport.csv'],
    ['GET', '//admin'],
  ])('%s %s answers 404', async (method, path) => {
    const response = await serve(requestOf({ url: `${SITE_ORIGIN}${path}`, method }));
    expect(response.status).toBe(NOT_FOUND_STATUS);
    expect(await response.text()).toBe('');
  });

  test('GET /join answers 303 to the landing', async () => {
    const response = await serve(requestOf({ url: `${SITE_ORIGIN}/join` }));
    expect(response.status).toBe(SEE_OTHER_STATUS);
    expect(response.headers.get('Location')).toBe('/');
  });

  test.each([
    ['no Turnstile keys', {}],
    [
      'the Turnstile keys but no waitlist limiter',
      { TURNSTILE_SITE_KEY: TURNSTILE_TEST_SITE_KEY, TURNSTILE_SECRET_KEY: TURNSTILE_TEST_SECRET },
    ],
  ])('POST /join with %s answers 503, never echoes the body and never reads it', async (_name, settings) => {
    const request = new Request(`${SITE_ORIGIN}/join`, {
      method: 'POST',
      headers: { 'Content-Type': FORM_CONTENT_TYPE, 'Content-Length': String(FORM_BODY.length), [CLIENT_ADDRESS_HEADER]: CLIENT_ADDRESS },
      body: FORM_BODY,
    });
    const response = await serveWith({ request, settings });
    expect(response.status).toBe(UNAVAILABLE_STATUS);
    expect(await response.text()).not.toContain(SCRIPT_PAYLOAD);
    expect(request.bodyUsed).toBe(false);
  });
});

describe('the API host', () => {
  test.each(['/', '/self-host'])('GET %s answers 404', async (path) => {
    const response = await serve(requestOf({ url: `${API_ORIGIN}${path}` }));
    expect(response.status).toBe(NOT_FOUND_STATUS);
  });

  test.each([
    ['GET', '/admin'],
    ['HEAD', '/admin'],
    ['GET', '/admin/sign-in'],
    ['GET', '/admin/export.csv'],
    ['POST', '/admin/sign-in-links'],
    ['POST', '/admin/sessions'],
    ['POST', '/admin/sign-out'],
  ])('%s %s answers 404, never serving the admin', async (method, path) => {
    const settings = { ADMIN_EMAIL: 'hello@todz.app' };
    const response = await serveWith({ request: requestOf({ url: `${API_ORIGIN}${path}`, method }), settings });
    expect(response.status).toBe(NOT_FOUND_STATUS);
    expect(await response.text()).toBe('');
  });

  test('GET /owner/sign-in-method answers as it did before the site', async () => {
    const response = await serve(requestOf({ url: `${API_ORIGIN}/owner/sign-in-method` }));
    expect(response.status).toBe(UNAVAILABLE_STATUS);
  });
});

describe('the www host', () => {
  test('answers 301 to the site host with the path and the query', async () => {
    const response = await serve(requestOf({ url: `${WWW_ORIGIN}/self-host?ref=x` }));
    expect(response.status).toBe(MOVED_PERMANENTLY_STATUS);
    expect(response.headers.get('Location')).toBe(`${SITE_ORIGIN}/self-host?ref=x`);
  });
});

describe('the www host and the admin', () => {
  test.each(['/admin', '/admin/sign-in', '/admin/export.csv'])('GET %s answers 301 to the site host', async (path) => {
    const response = await serve(requestOf({ url: `${WWW_ORIGIN}${path}` }));
    expect(response.status).toBe(MOVED_PERMANENTLY_STATUS);
    expect(response.headers.get('Location')).toBe(`${SITE_ORIGIN}${path}`);
  });
});

describe('an unknown host', () => {
  test.each(['https://todz-api.example.workers.dev/', 'https://203.0.113.7/self-host', 'https://evil.todz.app/'])(
    '%s answers 404',
    async (url) => {
      const response = await serve(requestOf({ url }));
      expect(response.status).toBe(NOT_FOUND_STATUS);
    },
  );
});

describe('the admin routes on the site host', () => {
  const SIGNED_IN_COOKIE = `${AdminCookie.Session}=${SESSION_SECRET}`;
  const ADMIN_SETTINGS: Partial<Env> = {
    ADMIN_EMAIL: ADMIN_ADDRESS,
    TURNSTILE_SITE_KEY: TURNSTILE_TEST_SITE_KEY,
    TURNSTILE_SECRET_KEY: TURNSTILE_TEST_SECRET,
  };

  function adminRequest({
    path,
    method = 'GET',
    headers = {},
    origin = SITE_ORIGIN,
  }: {
    path: string;
    method?: string;
    headers?: Record<string, string>;
    origin?: string;
  }): Request {
    return new Request(`${origin}${path}`, { method, headers, redirect: 'manual' });
  }

  async function signIn({ expiresAt = Date.now() + ADMIN_SESSION_LIFETIME_MS }: { expiresAt?: number } = {}): Promise<void> {
    await openAdminSession({
      database: env.DIRECTORY,
      digest: await digestCredential(SESSION_SECRET),
      email: ADMIN_ADDRESS,
      now: Date.now(),
      expiresAt,
    });
  }

  function cookiePairOf({ response, name }: { response: Response; name: AdminCookie }): string {
    const cookie = response.headers.getSetCookie().find((candidate) => candidate.startsWith(`${name}=`));
    if (cookie === undefined) throw new Error(`the answer sets no ${name} cookie`);
    return cookie.slice(0, cookie.indexOf(';'));
  }

  function expectAdminHeaders(response: Response): void {
    Object.entries(ADMIN_RESPONSE_HEADERS).forEach(([name, value]) => expect(response.headers.get(name)).toBe(value));
  }

  async function cardOf({ notice, siteKey = TURNSTILE_TEST_SITE_KEY }: { notice: AdminNotice; siteKey?: string | null }): Promise<string> {
    return (await serveAdminSignInPage({ notice, siteKey })).text();
  }

  beforeEach(async () => {
    await env.DIRECTORY.batch([
      env.DIRECTORY.prepare('DELETE FROM waitlist'),
      env.DIRECTORY.prepare('DELETE FROM admin_sessions'),
      env.DIRECTORY.prepare('DELETE FROM admin_sign_in_links'),
    ]);
  });

  describe('GET /admin', () => {
    test('without a session answers the sign-in card with the widget, 200 and the admin headers', async () => {
      const response = await serveWith({ request: adminRequest({ path: AdminPath.Panel }), settings: ADMIN_SETTINGS });
      expect(response.status).toBe(OK_STATUS);
      expect(await response.text()).toBe(await cardOf({ notice: AdminNotice.None }));
      expectAdminHeaders(response);
    });

    test('without the Turnstile keys answers the sign-in card without the widget', async () => {
      const response = await serveWith({ request: adminRequest({ path: AdminPath.Panel }), settings: { ADMIN_EMAIL: ADMIN_ADDRESS } });
      expect(response.status).toBe(OK_STATUS);
      expect(await response.text()).toBe(await cardOf({ notice: AdminNotice.None, siteKey: null }));
    });

    test('with a session answers the panel of the waitlist summary', async () => {
      await signIn();
      const joinedAt = Date.now() - 2 * MILLISECONDS_PER_DAY;
      await joinWaitlist({ database: env.DIRECTORY, address: 'maria@example.com', now: joinedAt });
      const summary = {
        total: 1,
        joinedLastDay: 0,
        failedConfirmations: 0,
        rows: [{ address: 'maria@example.com', joinedAt, confirmation: ConfirmationState.Sent }],
      };
      const response = await serveWith({
        request: adminRequest({ path: AdminPath.Panel, headers: { Cookie: SIGNED_IN_COOKIE } }),
        settings: ADMIN_SETTINGS,
      });
      expect(response.status).toBe(OK_STATUS);
      expect(await response.text()).toBe(await (await serveAdminPanel({ summary })).text());
      expectAdminHeaders(response);
    });

    test.each([
      ['an unknown secret', () => `${AdminCookie.Session}=another-secret`],
      ['two session cookies', () => `${SIGNED_IN_COOKIE}; ${SIGNED_IN_COOKIE}`],
      ['the challenge cookie in place of the session cookie', () => `${AdminCookie.Challenge}=${SESSION_SECRET}`],
    ])('with %s answers the sign-in card', async (_name, cookieOf) => {
      await signIn();
      const request = adminRequest({ path: AdminPath.Panel, headers: { Cookie: cookieOf() } });
      const response = await serveWith({ request, settings: ADMIN_SETTINGS });
      expect(response.status).toBe(OK_STATUS);
      expect(await response.text()).toBe(await cardOf({ notice: AdminNotice.None }));
    });

    test('with an expired session answers the sign-in card', async () => {
      await signIn({ expiresAt: Date.now() - 1 });
      const request = adminRequest({ path: AdminPath.Panel, headers: { Cookie: SIGNED_IN_COOKIE } });
      const response = await serveWith({ request, settings: ADMIN_SETTINGS });
      expect(await response.text()).toBe(await cardOf({ notice: AdminNotice.None }));
    });

    test('with a session after ADMIN_EMAIL changed answers the sign-in card', async () => {
      await signIn();
      const request = adminRequest({ path: AdminPath.Panel, headers: { Cookie: SIGNED_IN_COOKIE } });
      const response = await serveWith({ request, settings: { ...ADMIN_SETTINGS, ADMIN_EMAIL: 'other@todz.app' } });
      expect(response.status).toBe(OK_STATUS);
      expect(await response.text()).toBe(await cardOf({ notice: AdminNotice.None }));
    });

    test.each([undefined, 'not-an-address'])(
      'with ADMIN_EMAIL %s answers the closed card, 503, even with a session',
      async (adminEmail) => {
        await signIn();
        const request = adminRequest({ path: AdminPath.Panel, headers: { Cookie: SIGNED_IN_COOKIE } });
        const response = await serveWith({ request, settings: { ...ADMIN_SETTINGS, ADMIN_EMAIL: adminEmail } });
        expect(response.status).toBe(UNAVAILABLE_STATUS);
        expect(await response.text()).toBe(await cardOf({ notice: AdminNotice.Closed }));
        expectAdminHeaders(response);
      },
    );

    test('with a directory that throws answers the closed card, 503', async () => {
      const failingDirectory = new Proxy(env.DIRECTORY, {
        get(target, property) {
          if (property === 'prepare') {
            return () => {
              throw new Error('the directory is down');
            };
          }
          return Reflect.get(target, property);
        },
      });
      const request = adminRequest({ path: AdminPath.Panel, headers: { Cookie: SIGNED_IN_COOKIE } });
      const response = await serveWith({ request, settings: { ...ADMIN_SETTINGS, DIRECTORY: failingDirectory } });
      expect(response.status).toBe(UNAVAILABLE_STATUS);
      expect(await response.text()).toBe(await cardOf({ notice: AdminNotice.Closed }));
    });

    test('HEAD answers the status and the headers of GET', async () => {
      const get = await serveWith({ request: adminRequest({ path: AdminPath.Panel }), settings: ADMIN_SETTINGS });
      const head = await serveWith({ request: adminRequest({ path: AdminPath.Panel, method: 'HEAD' }), settings: ADMIN_SETTINGS });
      expect(head.status).toBe(get.status);
      expectAdminHeaders(head);
    });
  });

  describe('GET /admin/sign-in', () => {
    test('answers the link page with the admin headers, and HEAD answers its status', async () => {
      const get = await serveWith({ request: adminRequest({ path: AdminPath.LinkPage }), settings: ADMIN_SETTINGS });
      expect(get.status).toBe(OK_STATUS);
      expect(await get.text()).toBe(await (await serveAdminLinkPage()).text());
      expectAdminHeaders(get);
      const head = await serveWith({ request: adminRequest({ path: AdminPath.LinkPage, method: 'HEAD' }), settings: ADMIN_SETTINGS });
      expect(head.status).toBe(OK_STATUS);
      expectAdminHeaders(head);
    });

    test('answers the link page without a session or any admin setting', async () => {
      const response = await serveWith({ request: adminRequest({ path: AdminPath.LinkPage }), settings: {} });
      expect(response.status).toBe(OK_STATUS);
    });
  });

  describe('POST /admin/sign-out', () => {
    const SAME_ORIGIN = { 'Sec-Fetch-Site': 'same-origin' };
    const CLEARED_SESSION_COOKIE = '__Host-todz_admin=; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=0';

    function signOutRequest(headers: Record<string, string>): Request {
      return adminRequest({ path: AdminPath.SignOut, method: 'POST', headers });
    }

    test('with a session deletes its row, clears the cookie and answers 303 to the panel', async () => {
      await signIn();
      const response = await serveWith({ request: signOutRequest({ ...SAME_ORIGIN, Cookie: SIGNED_IN_COOKIE }), settings: ADMIN_SETTINGS });
      expect(response.status).toBe(SEE_OTHER_STATUS);
      expect(response.headers.get('Location')).toBe(AdminPath.Panel);
      expect(response.headers.getSetCookie()).toEqual([CLEARED_SESSION_COOKIE]);
      expectAdminHeaders(response);
      expect(await adminSessionRows()).toEqual([]);
    });

    test('then the same cookie is no session', async () => {
      await signIn();
      await serveWith({ request: signOutRequest({ ...SAME_ORIGIN, Cookie: SIGNED_IN_COOKIE }), settings: ADMIN_SETTINGS });
      const request = adminRequest({ path: AdminPath.Panel, headers: { Cookie: SIGNED_IN_COOKIE } });
      expect(await (await serveWith({ request, settings: ADMIN_SETTINGS })).text()).toBe(await cardOf({ notice: AdminNotice.None }));
    });

    test('without a session answers 303 and clears the cookie', async () => {
      const response = await serveWith({ request: signOutRequest(SAME_ORIGIN), settings: ADMIN_SETTINGS });
      expect(response.status).toBe(SEE_OTHER_STATUS);
      expect(response.headers.getSetCookie()).toEqual([CLEARED_SESSION_COOKIE]);
    });

    test('with ADMIN_EMAIL unset still deletes the row and clears the cookie', async () => {
      await signIn();
      const response = await serveWith({
        request: signOutRequest({ ...SAME_ORIGIN, Cookie: SIGNED_IN_COOKIE }),
        settings: { ...ADMIN_SETTINGS, ADMIN_EMAIL: undefined },
      });
      expect(response.status).toBe(SEE_OTHER_STATUS);
      expect(response.headers.getSetCookie()).toEqual([CLEARED_SESSION_COOKIE]);
      expect(await adminSessionRows()).toEqual([]);
    });

    test('a directory that throws answers the closed card and still clears the cookie', async () => {
      const failingDirectory = new Proxy(env.DIRECTORY, {
        get(target, property) {
          if (property === 'prepare') {
            return () => {
              throw new Error('the directory is down');
            };
          }
          return Reflect.get(target, property);
        },
      });
      const response = await serveWith({
        request: signOutRequest({ ...SAME_ORIGIN, Cookie: SIGNED_IN_COOKIE }),
        settings: { ...ADMIN_SETTINGS, DIRECTORY: failingDirectory },
      });
      expect(response.status).toBe(UNAVAILABLE_STATUS);
      expect(await response.text()).toBe(await cardOf({ notice: AdminNotice.Closed }));
      expect(response.headers.getSetCookie()).toEqual([CLEARED_SESSION_COOKIE]);
    });

    test.each([
      ['Sec-Fetch-Site: cross-site', { 'Sec-Fetch-Site': 'cross-site' }],
      ['Sec-Fetch-Site: same-site with the API Origin', { 'Sec-Fetch-Site': 'same-site', Origin: API_ORIGIN }],
      ['no Sec-Fetch-Site and a foreign Origin', { Origin: 'https://evil.example' }],
      ['neither header', {}],
    ])('a cross-origin post (%s) answers the forbidden card, 403, and keeps the session', async (_name, headers) => {
      await signIn();
      const response = await serveWith({ request: signOutRequest({ ...headers, Cookie: SIGNED_IN_COOKIE }), settings: ADMIN_SETTINGS });
      expect(response.status).toBe(FORBIDDEN_STATUS);
      expect(await response.text()).toBe(await cardOf({ notice: AdminNotice.Forbidden }));
      expect(response.headers.getSetCookie()).toEqual([]);
      expect(await adminSessionRows()).toHaveLength(1);
    });

    test('no Sec-Fetch-Site and the site Origin signs out', async () => {
      await signIn();
      const response = await serveWith({
        request: signOutRequest({ Origin: SITE_ORIGIN, Cookie: SIGNED_IN_COOKIE }),
        settings: ADMIN_SETTINGS,
      });
      expect(response.status).toBe(SEE_OTHER_STATUS);
      expect(await adminSessionRows()).toEqual([]);
    });
  });

  describe('GET /admin/export.csv', () => {
    test('with a session answers the CSV through the route', async () => {
      await signIn();
      await joinWaitlist({ database: env.DIRECTORY, address: 'maria@example.com', now: Date.now() });
      const request = adminRequest({ path: AdminPath.Export, headers: { Cookie: SIGNED_IN_COOKIE } });
      const response = await serveWith({ request, settings: ADMIN_SETTINGS });
      expect(response.status).toBe(OK_STATUS);
      expect(response.headers.get('Content-Type')).toBe('text/csv; charset=utf-8');
      expect(await response.text()).toContain('"maria@example.com"');
      expectAdminHeaders(response);
    });

    test('without a session answers 303 to the panel', async () => {
      const response = await serveWith({ request: adminRequest({ path: AdminPath.Export }), settings: ADMIN_SETTINGS });
      expect(response.status).toBe(SEE_OTHER_STATUS);
      expect(response.headers.get('Location')).toBe(AdminPath.Panel);
    });
  });

  describe('the posts that open the admin', () => {
    test('POST /admin/sign-in-links without limiters on a public host answers the closed card, 503, and never reads the body', async () => {
      const request = new Request(`${SITE_ORIGIN}${AdminPath.SignInLinks}`, {
        method: 'POST',
        headers: { 'Content-Type': FORM_CONTENT_TYPE, 'Content-Length': String(FORM_BODY.length), [CLIENT_ADDRESS_HEADER]: CLIENT_ADDRESS },
        body: FORM_BODY,
      });
      const response = await serveWith({ request, settings: ADMIN_SETTINGS });
      expect(response.status).toBe(UNAVAILABLE_STATUS);
      expect(await response.text()).not.toContain(SCRIPT_PAYLOAD);
      expect(request.bodyUsed).toBe(false);
    });

    test('POST /admin/sessions without limiters on a public host answers 503', async () => {
      const request = new Request(`${SITE_ORIGIN}${AdminPath.Sessions}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', [CLIENT_ADDRESS_HEADER]: CLIENT_ADDRESS, 'Sec-Fetch-Site': 'same-origin' },
        body: '{}',
      });
      const response = await serveWith({ request, settings: ADMIN_SETTINGS });
      expect(response.status).toBe(UNAVAILABLE_STATUS);
      expect(await response.json()).toEqual({});
    });
  });

  describe('the whole walk on a local site host', () => {
    const LOCAL_SITE_ORIGIN = 'http://localhost:8788';
    const LOCAL_SETTINGS: Partial<Env> = {
      ...ADMIN_SETTINGS,
      SITE_ORIGIN: LOCAL_SITE_ORIGIN,
      PUBLIC_ORIGIN: 'http://localhost:8787',
      EMAIL_SENDER: 'console',
    };
    const LINK_PATTERN = /http:\/\/localhost:8788\/admin\/sign-in#token=([A-Za-z0-9_-]{43})/;

    function postOf({
      path,
      body,
      contentType,
      headers = {},
    }: {
      path: string;
      body: string;
      contentType: string;
      headers?: Record<string, string>;
    }): Request {
      return new Request(`${LOCAL_SITE_ORIGIN}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': contentType, 'Content-Length': String(body.length), 'Sec-Fetch-Site': 'same-origin', ...headers },
        body,
      });
    }

    test('asking for a link, spending it from the same browser and reading the panel and the CSV, then signing out', async () => {
      const output = consoleOutput();
      const asked = await serveWith({
        request: postOf({
          path: AdminPath.SignInLinks,
          body: new URLSearchParams({ email: ADMIN_ADDRESS, 'cf-turnstile-response': TURNSTILE_DUMMY_TOKEN }).toString(),
          contentType: FORM_CONTENT_TYPE,
        }),
        settings: LOCAL_SETTINGS,
      });
      expect(asked.status).toBe(OK_STATUS);
      const challenge = cookiePairOf({ response: asked, name: AdminCookie.Challenge });
      const token = LINK_PATTERN.exec(mailSent(output).text)?.[1];
      if (token === undefined) throw new Error('the logged mail should carry the sign-in link');
      const opened = await serveWith({
        request: postOf({
          path: AdminPath.Sessions,
          body: JSON.stringify({ token }),
          contentType: 'application/json',
          headers: { Cookie: challenge },
        }),
        settings: LOCAL_SETTINGS,
      });
      expect(opened.status).toBe(CREATED_STATUS);
      const sessionCookie = cookiePairOf({ response: opened, name: AdminCookie.Session });
      const panel = await serveWith({
        request: new Request(`${LOCAL_SITE_ORIGIN}${AdminPath.Panel}`, { headers: { Cookie: sessionCookie } }),
        settings: LOCAL_SETTINGS,
      });
      expect(await panel.text()).toBe(
        await (await serveAdminPanel({ summary: { total: 0, joinedLastDay: 0, failedConfirmations: 0, rows: [] } })).text(),
      );
      const csv = await serveWith({
        request: new Request(`${LOCAL_SITE_ORIGIN}${AdminPath.Export}`, { headers: { Cookie: sessionCookie } }),
        settings: LOCAL_SETTINGS,
      });
      expect(csv.status).toBe(OK_STATUS);
      const signedOut = await serveWith({
        request: new Request(`${LOCAL_SITE_ORIGIN}${AdminPath.SignOut}`, {
          method: 'POST',
          headers: { Cookie: sessionCookie, 'Sec-Fetch-Site': 'same-origin' },
          redirect: 'manual',
        }),
        settings: LOCAL_SETTINGS,
      });
      expect(signedOut.status).toBe(SEE_OTHER_STATUS);
      expect(await adminSessionRows()).toEqual([]);
    });
  });
});
