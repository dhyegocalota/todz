import { createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { env } from 'cloudflare:workers';
import { describe, expect, test } from 'vitest';
import { digestCredential } from '../src/credential-digest';
import type { Env } from '../src/env';
import { HttpHeader, NO_STORE } from '../src/http-header';
import { HttpStatus } from '../src/http-status';
import worker from '../src/index';
import { withSecurityHeaders } from '../src/security-headers';
import { AdminPath } from '../src/site/admin-paths';
import { ADMIN_SESSION_LIFETIME_MS, AdminCookie } from '../src/site/admin-session';
import { openAdminSession } from '../src/site/admin-store';
import { TURNSTILE_TEST_SECRET } from './email-sign-in-client';
import { createOwnedProject, projectCall, workerEnvWith } from './owner-client';

const CONTENT_SECURITY_POLICY = 'Content-Security-Policy';
const STRICT_TRANSPORT_SECURITY = 'Strict-Transport-Security';
const CONTENT_TYPE_OPTIONS = 'X-Content-Type-Options';
const REFERRER_POLICY = 'Referrer-Policy';
const DEFAULT_POLICY = "default-src 'none'; frame-ancestors 'none'";
const DEFAULT_TRANSPORT_SECURITY = 'max-age=31536000';
const SCRIPT_DIRECTIVE = 'script-src';
const UPGRADE_HEADER = 'Upgrade';
const NOSNIFF = 'nosniff';
const NO_REFERRER = 'no-referrer';
const WEBSOCKET_UPGRADE = 'websocket';
const ADMIN_ADDRESS = 'hello@todz.app';
const SESSION_SECRET = 'a-security-headers-session-secret';
const TURNSTILE_TEST_SITE_KEY = '1x00000000000000000000AA';
const FORM_CONTENT_TYPE = 'application/x-www-form-urlencoded';
const WWW_PREFIX = 'www.';
const UNKNOWN_ORIGIN = 'https://unknown.example';
const ADMIN_SETTINGS: Partial<Env> = {
  ADMIN_EMAIL: ADMIN_ADDRESS,
  TURNSTILE_SITE_KEY: TURNSTILE_TEST_SITE_KEY,
  TURNSTILE_SECRET_KEY: TURNSTILE_TEST_SECRET,
};

type EdgeRequest = Request<unknown, IncomingRequestCfProperties>;

function configured(origin: string | undefined): string {
  if (origin === undefined) throw new Error('the test environment configures both origins');
  return origin;
}

const API_ORIGIN = configured(env.PUBLIC_ORIGIN);
const SITE_ORIGIN = configured(env.SITE_ORIGIN);

async function answerOf({ request, settings = {} }: { request: Request; settings?: Partial<Env> }): Promise<Response> {
  const executionContext = createExecutionContext();
  const workerEnv = workerEnvWith({ PUBLIC_ORIGIN: API_ORIGIN, SITE_ORIGIN, SIGN_IN_PROVIDER: 'fake', ...settings });
  const response = await worker.fetch(request as EdgeRequest, workerEnv, executionContext);
  await waitOnExecutionContext(executionContext);
  return response;
}

function expectSecurityHeaders({ response, policy }: { response: Response; policy: string | null }): void {
  expect(response.headers.get(STRICT_TRANSPORT_SECURITY)).toBe(DEFAULT_TRANSPORT_SECURITY);
  expect(response.headers.get(CONTENT_TYPE_OPTIONS)).toBe(NOSNIFF);
  expect(response.headers.get(REFERRER_POLICY)).toBe(NO_REFERRER);
  if (policy === null) {
    expect(response.headers.get(CONTENT_SECURITY_POLICY)).not.toBe(DEFAULT_POLICY);
    expect(response.headers.get(CONTENT_SECURITY_POLICY)).toContain(SCRIPT_DIRECTIVE);
    return;
  }
  expect(response.headers.get(CONTENT_SECURITY_POLICY)).toBe(policy);
}

function joinRequest(method: string): Request {
  const body = new URLSearchParams({ email: 'maria@example.com' }).toString();
  if (method === 'GET') return new Request(`${SITE_ORIGIN}/join`, { redirect: 'manual' });
  return new Request(`${SITE_ORIGIN}/join`, {
    method,
    headers: { 'Content-Type': FORM_CONTENT_TYPE, 'Content-Length': String(body.length) },
    body,
    redirect: 'manual',
  });
}

function wwwOrigin(): string {
  const { protocol, host } = new URL(SITE_ORIGIN);
  return `${protocol}//${WWW_PREFIX}${host}`;
}

describe('the answers of the worker on every host kind', () => {
  test.each([
    ['an unknown path on the api host', () => new Request(`${API_ORIGIN}/unknown`), HttpStatus.NotFound, DEFAULT_POLICY],
    ['POST /mcp without a bearer', () => new Request(`${API_ORIGIN}/mcp`, { method: 'POST' }), HttpStatus.Unauthorized, DEFAULT_POLICY],
    ['GET /sign-in', () => new Request(`${API_ORIGIN}/sign-in`), HttpStatus.Ok, null],
    ['GET /sign-in/challenge', () => new Request(`${API_ORIGIN}/sign-in/challenge`), HttpStatus.Ok, null],
    ['GET /health on the api host', () => new Request(`${API_ORIGIN}/health`), HttpStatus.Ok, DEFAULT_POLICY],
    ['an unknown path on the site host', () => new Request(`${SITE_ORIGIN}/unknown`), HttpStatus.NotFound, DEFAULT_POLICY],
    ['GET /join', () => joinRequest('GET'), HttpStatus.SeeOther, DEFAULT_POLICY],
    ['POST /join', () => joinRequest('POST'), HttpStatus.Unavailable, null],
    ['the www host', () => new Request(`${wwwOrigin()}/`, { redirect: 'manual' }), HttpStatus.MovedPermanently, DEFAULT_POLICY],
    ['GET /self-host', () => new Request(`${SITE_ORIGIN}/self-host`, { redirect: 'manual' }), HttpStatus.MovedPermanently, DEFAULT_POLICY],
    [
      'GET /self-host on the www host',
      () => new Request(`${wwwOrigin()}/self-host`, { redirect: 'manual' }),
      HttpStatus.MovedPermanently,
      DEFAULT_POLICY,
    ],
    ['an unknown host', () => new Request(`${UNKNOWN_ORIGIN}/`), HttpStatus.NotFound, DEFAULT_POLICY],
  ])('%s answers its status with the four headers', async (_name, requestOf, status, policy) => {
    const response = await answerOf({ request: requestOf(), settings: ADMIN_SETTINGS });
    expect(response.status).toBe(status);
    expectSecurityHeaders({ response, policy });
  });

  test('the admin export answers its CSV with the four headers', async () => {
    await openAdminSession({
      database: env.DIRECTORY,
      digest: await digestCredential(SESSION_SECRET),
      email: ADMIN_ADDRESS,
      now: Date.now(),
      expiresAt: Date.now() + ADMIN_SESSION_LIFETIME_MS,
    });
    const request = new Request(`${SITE_ORIGIN}${AdminPath.Export}`, { headers: { Cookie: `${AdminCookie.Session}=${SESSION_SECRET}` } });
    const response = await answerOf({ request, settings: ADMIN_SETTINGS });
    expect(response.status).toBe(HttpStatus.Ok);
    expect(response.headers.get(HttpHeader.CacheControl)).toBe(NO_STORE);
    expectSecurityHeaders({ response, policy: DEFAULT_POLICY });
  });

  test('a crash answers an empty 500 with the four headers', async () => {
    const failingDirectory = new Proxy(env.DIRECTORY, {
      get(target, property) {
        if (property === 'prepare') throw new Error('the directory is down');
        return Reflect.get(target, property);
      },
    });
    const request = new Request(`${API_ORIGIN}/mcp`, { method: 'POST', headers: { Authorization: 'Bearer todz_any-key' } });
    const response = await answerOf({ request, settings: { DIRECTORY: failingDirectory } });
    expect(response.status).toBe(HttpStatus.InternalServerError);
    expect(await response.text()).toBe('');
    expectSecurityHeaders({ response, policy: DEFAULT_POLICY });
  });

  test('the change feed without an upgrade answers 426 with the four headers', async () => {
    const project = await createOwnedProject();
    const response = await projectCall({ project, method: 'GET', path: '/socket' });
    expect(response.status).toBe(HttpStatus.UpgradeRequired);
    expect(response.headers.get(UPGRADE_HEADER)).toBe(WEBSOCKET_UPGRADE);
    expectSecurityHeaders({ response, policy: DEFAULT_POLICY });
  });

  test('the change feed with an upgrade answers 101 with its live socket', async () => {
    const project = await createOwnedProject();
    const response = await projectCall({ project, method: 'GET', path: '/socket', headers: { Upgrade: WEBSOCKET_UPGRADE } });
    expect(response.status).toBe(HttpStatus.SwitchingProtocols);
    expect(response.webSocket).not.toBeNull();
    response.webSocket?.accept();
  });
});

describe('withSecurityHeaders', () => {
  test('keeps the policies a route already set', () => {
    const routeHeaders = { [REFERRER_POLICY]: 'same-origin', [CONTENT_SECURITY_POLICY]: "default-src 'self'" };
    const response = withSecurityHeaders(new Response('page', { headers: routeHeaders }));
    expect(response.headers.get(REFERRER_POLICY)).toBe('same-origin');
    expect(response.headers.get(CONTENT_SECURITY_POLICY)).toBe("default-src 'self'");
    expect(response.headers.get(CONTENT_TYPE_OPTIONS)).toBe(NOSNIFF);
    expect(response.headers.get(STRICT_TRANSPORT_SECURITY)).toBe(DEFAULT_TRANSPORT_SECURITY);
  });

  test('gives an empty 204 all four headers', () => {
    const response = withSecurityHeaders(new Response(null, { status: HttpStatus.NoContent }));
    expect(response.status).toBe(HttpStatus.NoContent);
    expectSecurityHeaders({ response, policy: DEFAULT_POLICY });
  });

  test('gives a redirect, whose headers are immutable, all four headers without throwing', () => {
    const response = withSecurityHeaders(Response.redirect(`${SITE_ORIGIN}/`, HttpStatus.MovedPermanently));
    expect(response.status).toBe(HttpStatus.MovedPermanently);
    expect(response.headers.get('Location')).toBe(`${SITE_ORIGIN}/`);
    expectSecurityHeaders({ response, policy: DEFAULT_POLICY });
  });

  test('returns an upgrade with a socket as the same object', () => {
    const { 0: client } = new WebSocketPair();
    const upgrade = new Response(null, { status: HttpStatus.SwitchingProtocols, webSocket: client });
    expect(withSecurityHeaders(upgrade)).toBe(upgrade);
  });
});
