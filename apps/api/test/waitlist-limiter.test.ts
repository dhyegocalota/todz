import { describe, expect, test } from 'vitest';
import { digestCredential } from '../src/credential-digest';
import type { Env } from '../src/env';
import { LandingNotice } from '../src/site/landing-page';
import { isWaitlistUnguarded, waitlistAddressRefusal, waitlistClientRefusal, waitlistGlobalRefusal } from '../src/site/waitlist-limiter';
import { CLIENT_ADDRESS_HEADER, recordingLimiter } from './email-sign-in-client';
import { workerEnvWith } from './owner-client';

const PUBLIC_SITE_ORIGIN = 'https://todz.app';
const LOCAL_SITE_ORIGIN = 'http://localhost:8788';
const LOCAL_API_ORIGIN = 'http://localhost:8787';
const JOIN_PATH = '/join';
const CLIENT_ADDRESS = '203.0.113.7';
const FIRST_PREFIX_ADDRESS = '2001:db8:1:2:3:4:5:6';
const SECOND_PREFIX_ADDRESS = '2001:db8:1:2:ffff:eeee:dddd:cccc';
const ADDRESS = 'maria@example.com';

enum LimiterBinding {
  Client = 'WAITLIST_LIMITER',
  Address = 'WAITLIST_ADDRESS_LIMITER',
  Global = 'WAITLIST_GLOBAL_LIMITER',
}

type Limiters = Partial<Record<LimiterBinding, RateLimit | undefined>>;

type RecordedLimiters = { limiters: Limiters; keys: Record<LimiterBinding, string[]> };

type Refusal = (input: { request: Request; env: Env }) => Promise<LandingNotice | null>;

const REFUSAL_OF_BINDING: Record<LimiterBinding, Refusal> = {
  [LimiterBinding.Client]: waitlistClientRefusal,
  [LimiterBinding.Address]: ({ request, env }) => waitlistAddressRefusal({ request, env, address: ADDRESS }),
  [LimiterBinding.Global]: waitlistGlobalRefusal,
};

function recordedLimiters({ refusing = [] }: { refusing?: LimiterBinding[] } = {}): RecordedLimiters {
  const recorded = Object.values(LimiterBinding).map((binding) => ({
    binding,
    ...recordingLimiter({ isAllowed: !refusing.includes(binding) }),
  }));
  return {
    limiters: Object.fromEntries(recorded.map(({ binding, limiter }) => [binding, limiter])),
    keys: Object.fromEntries(recorded.map(({ binding, keys }) => [binding, keys])) as Record<LimiterBinding, string[]>,
  };
}

function throwingLimiter(): RateLimit {
  return {
    async limit() {
      throw new Error('the limiter is down');
    },
  };
}

function siteEnv({ limiters = {}, siteOrigin = PUBLIC_SITE_ORIGIN }: { limiters?: Limiters; siteOrigin?: string } = {}): Env {
  return workerEnvWith({ SITE_ORIGIN: siteOrigin, PUBLIC_ORIGIN: LOCAL_API_ORIGIN, ...limiters });
}

function joinRequest({
  origin = PUBLIC_SITE_ORIGIN,
  clientAddress = CLIENT_ADDRESS,
}: { origin?: string; clientAddress?: string | null } = {}): Request {
  const headers = clientAddress === null ? undefined : { [CLIENT_ADDRESS_HEADER]: clientAddress };
  return new Request(`${origin}${JOIN_PATH}`, { method: 'POST', headers });
}

describe('the waitlist limits on a public site host', () => {
  test.each(Object.values(LimiterBinding))('a request over %s answers try again', async (binding) => {
    const { limiters } = recordedLimiters({ refusing: [binding] });
    expect(await REFUSAL_OF_BINDING[binding]({ request: joinRequest(), env: siteEnv({ limiters }) })).toBe(LandingNotice.TryAgain);
  });

  test.each(Object.values(LimiterBinding))('a request within %s passes', async (binding) => {
    const { limiters } = recordedLimiters();
    expect(await REFUSAL_OF_BINDING[binding]({ request: joinRequest(), env: siteEnv({ limiters }) })).toBeNull();
  });

  test.each(Object.values(LimiterBinding))('a request whose %s throws answers opens soon', async (binding) => {
    const { limiters } = recordedLimiters();
    const env = siteEnv({ limiters: { ...limiters, [binding]: throwingLimiter() } });
    expect(await REFUSAL_OF_BINDING[binding]({ request: joinRequest(), env })).toBe(LandingNotice.OpensSoon);
  });

  test.each(Object.values(LimiterBinding))('a request without %s answers opens soon', async (binding) => {
    const { limiters } = recordedLimiters();
    const env = siteEnv({ limiters: { ...limiters, [binding]: undefined } });
    expect(await REFUSAL_OF_BINDING[binding]({ request: joinRequest(), env })).toBe(LandingNotice.OpensSoon);
  });

  test('a client limit without the client address answers opens soon and consults no limiter', async () => {
    const { limiters, keys } = recordedLimiters();
    expect(await waitlistClientRefusal({ request: joinRequest({ clientAddress: null }), env: siteEnv({ limiters }) })).toBe(
      LandingNotice.OpensSoon,
    );
    expect(Object.values(keys).flat()).toEqual([]);
  });

  test('the client is keyed by the join path and its address, the address by its digest and the cap by the join path', async () => {
    const { limiters, keys } = recordedLimiters();
    const request = joinRequest();
    const env = siteEnv({ limiters });
    await waitlistClientRefusal({ request, env });
    await waitlistAddressRefusal({ request, env, address: ADDRESS });
    await waitlistGlobalRefusal({ request, env });
    expect(keys).toEqual({
      [LimiterBinding.Client]: [`${JOIN_PATH}:${CLIENT_ADDRESS}`],
      [LimiterBinding.Address]: [`${JOIN_PATH}:${await digestCredential(ADDRESS)}`],
      [LimiterBinding.Global]: [JOIN_PATH],
    });
    expect(keys[LimiterBinding.Address].join()).not.toContain(ADDRESS);
  });

  test('two addresses in one IPv6 /64 share a client bucket', async () => {
    const { limiters, keys } = recordedLimiters();
    const env = siteEnv({ limiters });
    await waitlistClientRefusal({ request: joinRequest({ clientAddress: FIRST_PREFIX_ADDRESS }), env });
    await waitlistClientRefusal({ request: joinRequest({ clientAddress: SECOND_PREFIX_ADDRESS }), env });
    const [first, second] = keys[LimiterBinding.Client];
    expect(first).toBe(second);
  });
});

describe('whether the waitlist is guarded', () => {
  test('a public site host with every binding and the client address is guarded', () => {
    const { limiters } = recordedLimiters();
    expect(isWaitlistUnguarded({ request: joinRequest(), env: siteEnv({ limiters }) })).toBe(false);
  });

  test('a public site host without the client address is unguarded', () => {
    const { limiters } = recordedLimiters();
    expect(isWaitlistUnguarded({ request: joinRequest({ clientAddress: null }), env: siteEnv({ limiters }) })).toBe(true);
  });

  test.each(Object.values(LimiterBinding))('a public site host without %s is unguarded', (binding) => {
    const { limiters } = recordedLimiters();
    expect(isWaitlistUnguarded({ request: joinRequest(), env: siteEnv({ limiters: { ...limiters, [binding]: undefined } }) })).toBe(true);
  });

  test('a local site host needs neither the bindings nor the client address', () => {
    const request = joinRequest({ origin: LOCAL_SITE_ORIGIN, clientAddress: null });
    expect(isWaitlistUnguarded({ request, env: siteEnv({ siteOrigin: LOCAL_SITE_ORIGIN }) })).toBe(false);
  });
});

describe('the waitlist limits on a local site host', () => {
  test.each(Object.values(LimiterBinding))('%s is skipped, even when it would refuse', async (binding) => {
    const { limiters, keys } = recordedLimiters({ refusing: Object.values(LimiterBinding) });
    const request = joinRequest({ origin: LOCAL_SITE_ORIGIN, clientAddress: null });
    expect(await REFUSAL_OF_BINDING[binding]({ request, env: siteEnv({ limiters, siteOrigin: LOCAL_SITE_ORIGIN }) })).toBeNull();
    expect(Object.values(keys).flat()).toEqual([]);
  });

  test('a public SITE_ORIGIN with a localhost request is not a local site host, so the limits apply', async () => {
    const { limiters } = recordedLimiters({ refusing: [LimiterBinding.Client] });
    const request = joinRequest({ origin: LOCAL_SITE_ORIGIN });
    expect(await waitlistClientRefusal({ request, env: siteEnv({ limiters }) })).toBe(LandingNotice.TryAgain);
    expect(isWaitlistUnguarded({ request: joinRequest({ origin: LOCAL_SITE_ORIGIN, clientAddress: null }), env: siteEnv() })).toBe(true);
  });

  test('a local SITE_ORIGIN with a public request is not a local site host, so the limits apply', async () => {
    const { limiters } = recordedLimiters({ refusing: [LimiterBinding.Client] });
    const env = siteEnv({ limiters, siteOrigin: LOCAL_SITE_ORIGIN });
    expect(await waitlistClientRefusal({ request: joinRequest(), env })).toBe(LandingNotice.TryAgain);
  });

  test('a local PUBLIC_ORIGIN alone never makes the site host local', () => {
    const request = joinRequest({ clientAddress: null });
    expect(isWaitlistUnguarded({ request, env: siteEnv() })).toBe(true);
  });
});
