import { describe, expect, test } from 'vitest';
import { digestCredential } from '../src/credential-digest';
import type { Env } from '../src/env';
import {
  AdminLimit,
  type AdminRefusal,
  adminAddressRefusal,
  adminClientRefusal,
  adminGlobalRefusal,
  isAdminUnguarded,
} from '../src/site/admin-limiter';
import { AdminPath } from '../src/site/admin-paths';
import { AdminNotice } from '../src/site/admin-waitlist';
import { AdminLimiterBinding, type AdminLimiters, recordedAdminLimiters } from './admin-client';
import { CLIENT_ADDRESS_HEADER } from './email-sign-in-client';
import { workerEnvWith } from './owner-client';
import { throwingLimiter } from './waitlist-client';

const PUBLIC_SITE_ORIGIN = 'https://todz.app';
const LOCAL_SITE_ORIGIN = 'http://localhost:8788';
const LOCAL_API_ORIGIN = 'http://localhost:8787';
const CLIENT_ADDRESS = '203.0.113.7';
const FIRST_PREFIX_ADDRESS = '2001:db8:1:2:3:4:5:6';
const SECOND_PREFIX_ADDRESS = '2001:db8:1:2:ffff:eeee:dddd:cccc';
const ADDRESS = 'hello@todz.app';

type Refusal = (input: { request: Request; env: Env }) => Promise<AdminRefusal | null>;

const REFUSAL_OF_BINDING: Record<AdminLimiterBinding, Refusal> = {
  [AdminLimiterBinding.Client]: ({ request, env }) => adminClientRefusal({ request, env, path: AdminPath.SignInLinks }),
  [AdminLimiterBinding.Address]: ({ request, env }) => adminAddressRefusal({ request, env, address: ADDRESS }),
  [AdminLimiterBinding.Global]: adminGlobalRefusal,
};

function siteEnv({ limiters = {}, siteOrigin = PUBLIC_SITE_ORIGIN }: { limiters?: AdminLimiters; siteOrigin?: string } = {}): Env {
  return workerEnvWith({ SITE_ORIGIN: siteOrigin, PUBLIC_ORIGIN: LOCAL_API_ORIGIN, ...limiters });
}

function adminRequest({
  origin = PUBLIC_SITE_ORIGIN,
  path = AdminPath.SignInLinks,
  clientAddress = CLIENT_ADDRESS,
}: { origin?: string; path?: AdminPath; clientAddress?: string | null } = {}): Request {
  const headers = clientAddress === null ? undefined : { [CLIENT_ADDRESS_HEADER]: clientAddress };
  return new Request(`${origin}${path}`, { method: 'POST', headers });
}

describe('the admin limits on a public site host', () => {
  test.each(Object.values(AdminLimiterBinding))('a request over %s answers try again', async (binding) => {
    const { limiters } = recordedAdminLimiters({ refusing: [binding] });
    expect(await REFUSAL_OF_BINDING[binding]({ request: adminRequest(), env: siteEnv({ limiters }) })).toBe(AdminNotice.TryAgain);
  });

  test.each(Object.values(AdminLimiterBinding))('a request within %s passes', async (binding) => {
    const { limiters } = recordedAdminLimiters();
    expect(await REFUSAL_OF_BINDING[binding]({ request: adminRequest(), env: siteEnv({ limiters }) })).toBeNull();
  });

  test.each(Object.values(AdminLimiterBinding))('a request whose %s throws answers closed', async (binding) => {
    const { limiters } = recordedAdminLimiters();
    const env = siteEnv({ limiters: { ...limiters, [binding]: throwingLimiter() } });
    expect(await REFUSAL_OF_BINDING[binding]({ request: adminRequest(), env })).toBe(AdminNotice.Closed);
  });

  test.each(Object.values(AdminLimiterBinding))('a request without %s answers closed', async (binding) => {
    const { limiters } = recordedAdminLimiters();
    const env = siteEnv({ limiters: { ...limiters, [binding]: undefined } });
    expect(await REFUSAL_OF_BINDING[binding]({ request: adminRequest(), env })).toBe(AdminNotice.Closed);
  });

  test('a client limit without the client address answers closed and consults no limiter', async () => {
    const { limiters, keys } = recordedAdminLimiters();
    const request = adminRequest({ clientAddress: null });
    expect(await adminClientRefusal({ request, env: siteEnv({ limiters }), path: AdminPath.SignInLinks })).toBe(AdminNotice.Closed);
    expect(Object.values(keys).flat()).toEqual([]);
  });

  test('the client is keyed by the path it posts to and its address, the address by its digest and the cap by the link path', async () => {
    const { limiters, keys } = recordedAdminLimiters();
    const request = adminRequest();
    const env = siteEnv({ limiters });
    await adminClientRefusal({ request, env, path: AdminPath.SignInLinks });
    await adminClientRefusal({ request, env, path: AdminPath.Sessions });
    await adminAddressRefusal({ request, env, address: ADDRESS });
    await adminGlobalRefusal({ request, env });
    expect(keys).toEqual({
      [AdminLimiterBinding.Client]: [`${AdminPath.SignInLinks}:${CLIENT_ADDRESS}`, `${AdminPath.Sessions}:${CLIENT_ADDRESS}`],
      [AdminLimiterBinding.Address]: [`${AdminPath.SignInLinks}:${await digestCredential(ADDRESS)}`],
      [AdminLimiterBinding.Global]: [AdminPath.SignInLinks],
    });
    expect(keys[AdminLimiterBinding.Address].join()).not.toContain(ADDRESS);
  });

  test('two addresses in one IPv6 /64 share a client bucket', async () => {
    const { limiters, keys } = recordedAdminLimiters();
    const env = siteEnv({ limiters });
    await adminClientRefusal({ request: adminRequest({ clientAddress: FIRST_PREFIX_ADDRESS }), env, path: AdminPath.SignInLinks });
    await adminClientRefusal({ request: adminRequest({ clientAddress: SECOND_PREFIX_ADDRESS }), env, path: AdminPath.SignInLinks });
    const [first, second] = keys[AdminLimiterBinding.Client];
    expect(first).toBe(second);
  });
});

describe('whether the admin is guarded', () => {
  const EVERY_LIMIT = Object.values(AdminLimit);

  test('a public site host with every binding and the client address is guarded', () => {
    const { limiters } = recordedAdminLimiters();
    expect(isAdminUnguarded({ request: adminRequest(), env: siteEnv({ limiters }), limits: EVERY_LIMIT })).toBe(false);
  });

  test('a public site host without the client address is unguarded', () => {
    const { limiters } = recordedAdminLimiters();
    const request = adminRequest({ clientAddress: null });
    expect(isAdminUnguarded({ request, env: siteEnv({ limiters }), limits: EVERY_LIMIT })).toBe(true);
  });

  test.each([
    [AdminLimit.Client, AdminLimiterBinding.Client],
    [AdminLimit.Address, AdminLimiterBinding.Address],
    [AdminLimit.Global, AdminLimiterBinding.Global],
  ])('a public site host that needs %s is unguarded without its binding', (limit, binding) => {
    const { limiters } = recordedAdminLimiters();
    const env = siteEnv({ limiters: { ...limiters, [binding]: undefined } });
    expect(isAdminUnguarded({ request: adminRequest(), env, limits: [limit] })).toBe(true);
  });

  test('a binding that is not needed does not leave the admin unguarded', () => {
    const { limiters } = recordedAdminLimiters();
    const env = siteEnv({ limiters: { ...limiters, [AdminLimiterBinding.Address]: undefined } });
    expect(isAdminUnguarded({ request: adminRequest(), env, limits: [AdminLimit.Client] })).toBe(false);
  });

  test('a local site host needs neither the bindings nor the client address', () => {
    const request = adminRequest({ origin: LOCAL_SITE_ORIGIN, clientAddress: null });
    expect(isAdminUnguarded({ request, env: siteEnv({ siteOrigin: LOCAL_SITE_ORIGIN }), limits: EVERY_LIMIT })).toBe(false);
  });
});

describe('the admin limits on a local site host', () => {
  test.each(Object.values(AdminLimiterBinding))('%s is skipped, even when it would refuse', async (binding) => {
    const { limiters, keys } = recordedAdminLimiters({ refusing: Object.values(AdminLimiterBinding) });
    const request = adminRequest({ origin: LOCAL_SITE_ORIGIN, clientAddress: null });
    const env = siteEnv({ limiters, siteOrigin: LOCAL_SITE_ORIGIN });
    expect(await REFUSAL_OF_BINDING[binding]({ request, env })).toBeNull();
    expect(Object.values(keys).flat()).toEqual([]);
  });

  test('a public SITE_ORIGIN with a localhost request is not a local site host, so the limits apply', async () => {
    const { limiters } = recordedAdminLimiters({ refusing: [AdminLimiterBinding.Client] });
    const request = adminRequest({ origin: LOCAL_SITE_ORIGIN });
    expect(await adminClientRefusal({ request, env: siteEnv({ limiters }), path: AdminPath.SignInLinks })).toBe(AdminNotice.TryAgain);
  });

  test('a local SITE_ORIGIN with a public request is not a local site host, so the limits apply', async () => {
    const { limiters } = recordedAdminLimiters({ refusing: [AdminLimiterBinding.Client] });
    const env = siteEnv({ limiters, siteOrigin: LOCAL_SITE_ORIGIN });
    expect(await adminClientRefusal({ request: adminRequest(), env, path: AdminPath.SignInLinks })).toBe(AdminNotice.TryAgain);
  });
});
