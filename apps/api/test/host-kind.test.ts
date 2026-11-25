import { env as workerEnv } from 'cloudflare:workers';
import { describe, expect, test } from 'vitest';
import type { Env } from '../src/env';
import { HostKind, hostKindOf } from '../src/host-kind';

const API_ORIGIN = 'https://api.todz.app';
const SITE_ORIGIN = 'https://todz.app';
const LOCAL_API_ORIGIN = 'http://localhost:8787';
const LOCAL_SITE_ORIGIN = 'http://localhost:8788';
const NOT_A_URL = 'not a url';

type Origins = { PUBLIC_ORIGIN?: string; SITE_ORIGIN?: string };

const PRODUCTION: Origins = { PUBLIC_ORIGIN: API_ORIGIN, SITE_ORIGIN };
const DEVELOPMENT: Origins = { PUBLIC_ORIGIN: LOCAL_API_ORIGIN, SITE_ORIGIN: LOCAL_SITE_ORIGIN };

function kindOf({ url, origins }: { url: string; origins: Origins }): HostKind | null {
  const env: Env = { DIRECTORY: workerEnv.DIRECTORY, PROJECT_STORE: workerEnv.PROJECT_STORE, ...origins };
  return hostKindOf({ request: new Request(url), env });
}

describe('hostKindOf in production', () => {
  test.each([
    ['the API host', 'https://api.todz.app/x', HostKind.Api],
    ['the site host', 'https://todz.app/', HostKind.Site],
    ['the www host', 'https://www.todz.app/', HostKind.WwwRedirect],
    ['an upper-case site host', 'https://TODZ.APP/', HostKind.Site],
    ['the site host with its default port', 'https://todz.app:443/', HostKind.Site],
    ['the site host with a trailing dot', 'https://todz.app./', null],
    ['the API host on another port', 'https://api.todz.app:8443/', null],
    ['a sibling subdomain', 'https://evil.todz.app/', null],
    ['a workers.dev address', 'https://todz-api.example.workers.dev/', null],
    ['an IP address', 'https://203.0.113.7/', null],
  ])('%s answers %s', (_name, url, expected) => {
    expect(kindOf({ url, origins: PRODUCTION })).toBe(expected);
  });
});

describe('hostKindOf in development', () => {
  test.each([
    ['the API port', 'http://localhost:8787/', HostKind.Api],
    ['the site port', 'http://localhost:8788/', HostKind.Site],
    ['another port', 'http://localhost:8789/', null],
  ])('%s answers %s', (_name, url, expected) => {
    expect(kindOf({ url, origins: DEVELOPMENT })).toBe(expected);
  });
});

describe('hostKindOf with missing or invalid origins', () => {
  test.each([
    ['no SITE_ORIGIN', { PUBLIC_ORIGIN: API_ORIGIN }],
    ['an invalid SITE_ORIGIN', { PUBLIC_ORIGIN: API_ORIGIN, SITE_ORIGIN: NOT_A_URL }],
  ])('%s leaves the site and www hosts unknown and the API host known', (_name, origins) => {
    expect(kindOf({ url: 'https://todz.app/', origins })).toBeNull();
    expect(kindOf({ url: 'https://www.todz.app/', origins })).toBeNull();
    expect(kindOf({ url: 'https://api.todz.app/', origins })).toBe(HostKind.Api);
  });

  test.each([
    ['no PUBLIC_ORIGIN', { SITE_ORIGIN }],
    ['an invalid PUBLIC_ORIGIN', { PUBLIC_ORIGIN: NOT_A_URL, SITE_ORIGIN }],
  ])('%s leaves the API host unknown and the site host known', (_name, origins) => {
    expect(kindOf({ url: 'https://api.todz.app/', origins })).toBeNull();
    expect(kindOf({ url: 'https://todz.app/', origins })).toBe(HostKind.Site);
  });

  test('the API wins when both origins share a host', () => {
    expect(kindOf({ url: 'https://todz.app/', origins: { PUBLIC_ORIGIN: SITE_ORIGIN, SITE_ORIGIN } })).toBe(HostKind.Api);
  });
});
