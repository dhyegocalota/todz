import { API_VERSION_HEADER, APP_VERSION_HEADER, MINIMUM_APP_VERSION } from '@todz/types';
import { exports } from 'cloudflare:workers';
import { describe, expect, test } from 'vitest';
import { HttpMethod } from '../src/http-method';
import { HttpStatus } from '../src/http-status';
import { withServerVersion } from '../src/server-version';
import { ownerCall, signInOwner } from './owner-client';

const API_ORIGIN = 'http://localhost:8787';
const SITE_ORIGIN = 'http://localhost:8788';
const TEST_SERVER_VERSION = '2026.11.25+0000000';
const ACCESS_CONTROL_PREFIX = 'access-control-';
const OPTIONS_METHOD = 'OPTIONS';

function fetchOf({ origin, path, method = HttpMethod.Get }: { origin: string; path: string; method?: string }): Promise<Response> {
  return exports.default.fetch(`${origin}${path}`, { method });
}

describe('Todz-Api-Version on the answers of the worker', () => {
  test('a signed-in owner read carries it', async () => {
    const owner = await signInOwner();
    const response = await ownerCall({ method: HttpMethod.Get, path: '/owner', token: owner.token });
    expect(response.status).toBe(HttpStatus.Ok);
    expect(response.headers.get(API_VERSION_HEADER)).toBe(TEST_SERVER_VERSION);
  });

  test('an owner refusal as too old carries it', async () => {
    const response = await exports.default.fetch(`${API_ORIGIN}/owner/sign-in-method`);
    expect(response.status).toBe(HttpStatus.UpgradeRequired);
    expect(response.headers.get(API_VERSION_HEADER)).toBe(TEST_SERVER_VERSION);
  });

  test('an owner answer to the minimum version carries it', async () => {
    const response = await exports.default.fetch(`${API_ORIGIN}/owner/sign-in-method`, {
      headers: { [APP_VERSION_HEADER]: MINIMUM_APP_VERSION },
    });
    expect(response.status).toBe(HttpStatus.Ok);
    expect(response.headers.get(API_VERSION_HEADER)).toBe(TEST_SERVER_VERSION);
  });

  test.each([
    { name: 'a POST /mcp answer', origin: API_ORIGIN, path: '/mcp', method: HttpMethod.Post },
    { name: 'GET /health', origin: API_ORIGIN, path: '/health', method: HttpMethod.Get },
    { name: 'HEAD /health', origin: API_ORIGIN, path: '/health', method: HttpMethod.Head },
    { name: 'an api-host 404', origin: API_ORIGIN, path: '/nope', method: HttpMethod.Get },
    { name: 'a site-host page', origin: SITE_ORIGIN, path: '/', method: HttpMethod.Get },
    { name: 'a site-host 404', origin: SITE_ORIGIN, path: '/nope', method: HttpMethod.Get },
  ])('$name carries it', async ({ origin, path, method }) => {
    const response = await fetchOf({ origin, path, method });
    expect(response.headers.get(API_VERSION_HEADER)).toBe(TEST_SERVER_VERSION);
  });

  test('the www redirect, whose headers are immutable, carries it', async () => {
    const response = await exports.default.fetch('http://www.localhost:8788/', { redirect: 'manual' });
    expect(response.status).toBe(HttpStatus.MovedPermanently);
    expect(response.headers.get(API_VERSION_HEADER)).toBe(TEST_SERVER_VERSION);
  });

  test('OPTIONS /owner answers 404 with it and no access-control header', async () => {
    const response = await fetchOf({ origin: API_ORIGIN, path: '/owner', method: OPTIONS_METHOD });
    expect(response.status).toBe(HttpStatus.NotFound);
    expect(response.headers.get(API_VERSION_HEADER)).toBe(TEST_SERVER_VERSION);
    expect([...response.headers.keys()].filter((name) => name.startsWith(ACCESS_CONTROL_PREFIX))).toEqual([]);
  });
});

describe('withServerVersion', () => {
  test('sets the header of a stamped build and keeps the body and status', async () => {
    const response = withServerVersion({ response: new Response('page', { status: HttpStatus.Created }), version: TEST_SERVER_VERSION });
    expect(response.headers.get(API_VERSION_HEADER)).toBe(TEST_SERVER_VERSION);
    expect(response.status).toBe(HttpStatus.Created);
    expect(await response.text()).toBe('page');
  });

  test('adds nothing for an unstamped build', () => {
    const response = withServerVersion({ response: new Response('page'), version: null });
    expect(response.headers.has(API_VERSION_HEADER)).toBe(false);
  });

  test('sets the header on a redirect, whose headers are immutable, without throwing', () => {
    const response = withServerVersion({
      response: Response.redirect(`${SITE_ORIGIN}/`, HttpStatus.MovedPermanently),
      version: TEST_SERVER_VERSION,
    });
    expect(response.status).toBe(HttpStatus.MovedPermanently);
    expect(response.headers.get(API_VERSION_HEADER)).toBe(TEST_SERVER_VERSION);
  });

  test('returns an upgrade with a socket as the same object, with no header', () => {
    const { 0: client } = new WebSocketPair();
    const upgrade = new Response(null, { status: HttpStatus.SwitchingProtocols, webSocket: client });
    expect(withServerVersion({ response: upgrade, version: TEST_SERVER_VERSION })).toBe(upgrade);
    expect(upgrade.headers.has(API_VERSION_HEADER)).toBe(false);
  });
});
