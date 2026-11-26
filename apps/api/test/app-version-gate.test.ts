import { APP_VERSION_HEADER, MINIMUM_APP_VERSION } from '@todz/types';
import { createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { exports } from 'cloudflare:workers';
import { describe, expect, test } from 'vitest';
import type { Env } from '../src/env';
import { HttpStatus } from '../src/http-status';
import { serveOwner } from '../src/owner-endpoint';
import { OWNER_ROUTES, OwnerRoute } from '../src/owner-routes';
import { TURNSTILE_DUMMY_TOKEN } from '../src/turnstile';
import { LINK_CHALLENGE, emailEnv, guardedSettings, recordingLimiter } from './email-sign-in-client';
import { createOwnedProject, signInOwner, workerEnvWith } from './owner-client';
import { CLOCK_NOW } from './task-fixtures';

const WORKER_ORIGIN = 'http://localhost:8787';
const PUBLIC_API_ORIGIN = 'https://api.todz.app';
const OLD_VERSION = '0.1.0';
const PATH_PARAMETER_PATTERN = /:\w+(\([^)]*\))?/g;
const PATH_PARAMETER_VALUE = '1';
const PUBLIC_ROUTES: string[] = [OwnerRoute.SignIn, OwnerRoute.ReadSignInMethod, OwnerRoute.RequestSignInLink];
const SESSION_ROUTE_CALLS = Object.entries(OWNER_ROUTES)
  .filter(([route]) => !PUBLIC_ROUTES.includes(route))
  .map(([route, { method, pattern }]) => ({ route, method, path: pattern.pathname.replace(PATH_PARAMETER_PATTERN, PATH_PARAMETER_VALUE) }));
const UPGRADE_HEADER = 'Upgrade';
const WEBSOCKET_UPGRADE = 'websocket';
const APP_TOO_OLD_BODY = '{"error":"app_too_old","minimum_app_version":"0.2.0"}';
const CACHE_CONTROL_HEADER = 'Cache-Control';
const NO_STORE = 'no-store';
const TOO_OLD_VERSIONS = ['0.1.9', 'v0.2.0'];
const ACCEPTED_VERSIONS = ['0.2.0', '0.2', '1.0.0'];
const REFUSED_SIGN_IN_COUNT = 10;
const UNKNOWN_TOKEN = 'todz_unknown_credential';
const PRE_ADR_0058_BODY = { email: 'maria@example.com', link_challenge: LINK_CHALLENGE, turnstile_token: TURNSTILE_DUMMY_TOKEN };

type AppCall = {
  origin?: string;
  method?: string;
  path: string;
  appVersion?: string;
  token?: string;
  body?: unknown;
  headers?: Record<string, string>;
};

function appRequest({ origin = WORKER_ORIGIN, method = 'GET', path, appVersion, token, body, headers }: AppCall): Request {
  const versionHeader: Record<string, string> = appVersion === undefined ? {} : { [APP_VERSION_HEADER]: appVersion };
  const authorization: Record<string, string> = token === undefined ? {} : { Authorization: `Bearer ${token}` };
  const contentType: Record<string, string> = body === undefined ? {} : { 'Content-Type': 'application/json' };
  return new Request(`${origin}${path}`, {
    method,
    headers: { ...versionHeader, ...authorization, ...contentType, ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function appFetch(call: AppCall): Promise<Response> {
  return exports.default.fetch(appRequest(call));
}

async function serveWithEmailSignIn({ workerEnv = emailEnv(), ...call }: AppCall & { workerEnv?: Env }): Promise<Response> {
  const executionContext = createExecutionContext();
  const response = await serveOwner({ request: appRequest(call), env: workerEnv, now: CLOCK_NOW, executionContext });
  await waitOnExecutionContext(executionContext);
  return response;
}

async function expectAppTooOld(response: Response): Promise<void> {
  expect(response.status).toBe(HttpStatus.UpgradeRequired);
  expect(response.headers.has(UPGRADE_HEADER)).toBe(false);
  expect(response.headers.get(CACHE_CONTROL_HEADER)).toBe(NO_STORE);
  expect(await response.text()).toBe(APP_TOO_OLD_BODY);
}

describe('the app version gate on /owner/*', () => {
  test('a request with no version header is refused as too old', async () => {
    await expectAppTooOld(await appFetch({ path: '/owner/sign-in-method' }));
  });

  test.each(TOO_OLD_VERSIONS)('a request with version %s is refused as too old', async (appVersion) => {
    await expectAppTooOld(await appFetch({ path: '/owner/sign-in-method', appVersion }));
  });

  test('a sign-in link request of the body before ADR 0058 gets the refusal, not a 400', async () => {
    await expectAppTooOld(await serveWithEmailSignIn({ method: 'POST', path: '/owner/sign-in-links', body: PRE_ADR_0058_BODY }));
  });

  test('a signed-in read with an old version is refused and the session stays usable', async () => {
    const owner = await signInOwner();
    await expectAppTooOld(await appFetch({ path: '/owner', token: owner.token, appVersion: OLD_VERSION }));
    const accepted = await appFetch({ path: '/owner', token: owner.token, appVersion: MINIMUM_APP_VERSION });
    expect(accepted.status).toBe(HttpStatus.Ok);
  });

  test.each(SESSION_ROUTE_CALLS)('$route with no credential and no version header answers 401, not 426', async ({ method, path }) => {
    const response = await appFetch({ method, path });
    expect(response.status).toBe(HttpStatus.Unauthorized);
  });

  test('a session route with an unknown credential and an old version answers 401, not 426', async () => {
    const response = await appFetch({ path: '/owner/workspaces', token: UNKNOWN_TOKEN, appVersion: OLD_VERSION });
    expect(response.status).toBe(HttpStatus.Unauthorized);
  });

  test('a refused signed-in request spends no owner limiter budget', async () => {
    const owner = await signInOwner();
    const limiter = recordingLimiter({ isAllowed: true });
    const executionContext = createExecutionContext();
    const response = await serveOwner({
      request: appRequest({ origin: PUBLIC_API_ORIGIN, path: '/owner', token: owner.token, appVersion: OLD_VERSION }),
      env: workerEnvWith({ PUBLIC_ORIGIN: PUBLIC_API_ORIGIN, OWNER_LIMITER: limiter.limiter }),
      now: CLOCK_NOW,
      executionContext,
    });
    await waitOnExecutionContext(executionContext);
    await expectAppTooOld(response);
    expect(limiter.keys).toEqual([]);
  });

  test('a signed-in request with an accepted version spends owner limiter budget on the same setup', async () => {
    const owner = await signInOwner();
    const limiter = recordingLimiter({ isAllowed: true });
    const executionContext = createExecutionContext();
    await serveOwner({
      request: appRequest({ origin: PUBLIC_API_ORIGIN, path: '/owner', token: owner.token, appVersion: MINIMUM_APP_VERSION }),
      env: workerEnvWith({ PUBLIC_ORIGIN: PUBLIC_API_ORIGIN, OWNER_LIMITER: limiter.limiter }),
      now: CLOCK_NOW,
      executionContext,
    });
    await waitOnExecutionContext(executionContext);
    expect(limiter.keys).toEqual([owner.ownerId]);
  });

  test('a revoked session with an old version answers 401, not 426', async () => {
    const owner = await signInOwner();
    const signedOut = await appFetch({
      method: 'DELETE',
      path: '/owner/sessions/current',
      token: owner.token,
      appVersion: MINIMUM_APP_VERSION,
    });
    expect(signedOut.status).toBeLessThan(HttpStatus.BadRequest);
    const response = await appFetch({ path: '/owner', token: owner.token, appVersion: OLD_VERSION });
    expect(response.status).toBe(HttpStatus.Unauthorized);
  });

  test('the change socket with no version header is refused with the todz body, not the store upgrade refusal', async () => {
    const project = await createOwnedProject();
    const response = await appFetch({
      path: `/owner/projects/${project.projectId}/socket`,
      token: project.token,
      headers: { [UPGRADE_HEADER]: WEBSOCKET_UPGRADE },
    });
    await expectAppTooOld(response);
  });

  test.each(ACCEPTED_VERSIONS)('version %s reaches the route, which answers as before', async (appVersion) => {
    const response = await appFetch({ path: '/owner/sign-in-method', appVersion });
    expect(response.status).toBe(HttpStatus.Ok);
  });

  test('an unknown owner path answers 404 with no body, version or not', async () => {
    const response = await appFetch({ path: '/owner/nope' });
    expect(response.status).toBe(HttpStatus.NotFound);
    expect(await response.text()).toBe('');
  });

  test('a refused request spends no sign-in limiter budget', async () => {
    const client = recordingLimiter({ isAllowed: true });
    const address = recordingLimiter({ isAllowed: true });
    const global = recordingLimiter({ isAllowed: true });
    const workerEnv = emailEnv({
      ...guardedSettings(),
      SIGN_IN_LIMITER: client.limiter,
      SIGN_IN_ADDRESS_LIMITER: address.limiter,
      SIGN_IN_GLOBAL_LIMITER: global.limiter,
    });
    const responses = await Promise.all(
      Array.from({ length: REFUSED_SIGN_IN_COUNT }, () =>
        serveWithEmailSignIn({ method: 'POST', path: '/owner/sign-in-links', body: PRE_ADR_0058_BODY, workerEnv }),
      ),
    );
    expect(responses.map((response) => response.status)).toEqual(Array(REFUSED_SIGN_IN_COUNT).fill(HttpStatus.UpgradeRequired));
    expect([client.keys, address.keys, global.keys]).toEqual([[], [], []]);
  });
});

describe('the other endpoints never check the app version', () => {
  test('POST /mcp with no version header is not refused as too old', async () => {
    const response = await appFetch({ method: 'POST', path: '/mcp' });
    expect(response.status).not.toBe(HttpStatus.UpgradeRequired);
  });

  test('GET /health with no version header answers 200', async () => {
    const response = await appFetch({ path: '/health' });
    expect(response.status).toBe(HttpStatus.Ok);
  });
});
