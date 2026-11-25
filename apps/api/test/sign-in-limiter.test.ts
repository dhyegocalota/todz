import { SIGN_IN_RATE_LIMIT_MAX, SIGN_IN_RATE_LIMIT_PERIOD_SECONDS } from '@todz/types';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { digestCredential } from '../src/credential-digest';
import type { Env } from '../src/env';
import { OwnerRoute } from '../src/owner-routes';
import { signInLimitRefusal } from '../src/sign-in-limiter';
import { TURNSTILE_DUMMY_TOKEN, TurnstileAction } from '../src/turnstile';
import {
  CLIENT_ADDRESS_HEADER,
  LINK_CHALLENGE,
  PUBLIC_HTTPS_ORIGIN,
  PUBLIC_ORIGIN,
  TURNSTILE_TOKEN_OF_ACTION,
  acceptingSiteverify,
  emailEnv,
  freshAddress,
  guardedSettings,
  linkRows,
  recordingBinding,
  recordingLimiter,
} from './email-sign-in-client';
import { type OwnerCall, ownerCall, serveOwnerCall } from './owner-client';
import { CLOCK_NOW } from './task-fixtures';

const FIRST_CLIENT_ADDRESS = '203.0.113.7';
const SECOND_CLIENT_ADDRESS = '203.0.113.8';
const FIRST_PREFIX_ADDRESS = '2001:db8:1:2:3:4:5:6';
const SECOND_PREFIX_ADDRESS = '2001:db8:1:2:ffff:eeee:dddd:cccc';
const OTHER_PREFIX_ADDRESS = '2001:db8:1:3:3:4:5:6';
const MAPPED_ADDRESS = '::ffff:203.0.113.7';
const OK_STATUS = 200;
const ACCEPTED_STATUS = 202;
const UNAUTHORIZED_STATUS = 401;
const TOO_MANY_STATUS = 429;
const UNAVAILABLE_STATUS = 503;
const SATURATED_CLIENT_ADDRESS = '198.51.100.1';
const UNTOUCHED_CLIENT_ADDRESS = '192.0.2.1';
const SIGN_IN_REFUSED = { error: 'sign_in_refused' };
const SIGN_IN_UNAVAILABLE = { error: 'sign_in_unavailable' };
const RETRY_AFTER_HEADER = 'Retry-After';
const RETRY_AFTER_SECONDS = '60';
const SESSIONS_PATH = '/owner/sessions';
const LINKS_PATH = '/owner/sign-in-links';
const METHOD_PATH = '/owner/sign-in-method';
const OWNER_PATH = '/owner';

enum LimiterBinding {
  Client = 'SIGN_IN_LIMITER',
  Address = 'SIGN_IN_ADDRESS_LIMITER',
  Global = 'SIGN_IN_GLOBAL_LIMITER',
}

type RouteCall = { email: string; call: OwnerCall };

type Limiters = Partial<Record<LimiterBinding, RateLimit | undefined>>;

type RecordedLimiters = { limiters: Limiters; keys: Record<LimiterBinding, string[]> };

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

function guardedEnv({ limiters = {}, binding = recordingBinding().binding }: { limiters?: Limiters; binding?: SendEmail } = {}): Env {
  return emailEnv({ ...guardedSettings(), EMAIL: binding, ...limiters });
}

function clientHeaders(address: string | null): Record<string, string> | undefined {
  if (address === null) return undefined;
  return { [CLIENT_ADDRESS_HEADER]: address };
}

function linkCall({
  clientAddress = FIRST_CLIENT_ADDRESS,
  origin = PUBLIC_HTTPS_ORIGIN,
  email = freshAddress(),
  turnstileToken = TURNSTILE_TOKEN_OF_ACTION[TurnstileAction.RequestLink],
}: { clientAddress?: string | null; origin?: string; email?: string; turnstileToken?: string } = {}): RouteCall {
  const body = { email, link_challenge: LINK_CHALLENGE, turnstile_token: turnstileToken };
  return { email, call: { method: 'POST', path: LINKS_PATH, body, headers: clientHeaders(clientAddress), origin } };
}

function sessionCall({
  clientAddress = FIRST_CLIENT_ADDRESS,
  origin = PUBLIC_HTTPS_ORIGIN,
  turnstileToken = TURNSTILE_TOKEN_OF_ACTION[TurnstileAction.SignIn],
}: { clientAddress?: string | null; origin?: string; turnstileToken?: string } = {}): OwnerCall {
  const body = { identity_token: 'not-a-link-token', time_zone: 'UTC', turnstile_token: turnstileToken };
  return { method: 'POST', path: SESSIONS_PATH, body, headers: clientHeaders(clientAddress), origin };
}

function methodCall({
  clientAddress = FIRST_CLIENT_ADDRESS,
  origin = PUBLIC_HTTPS_ORIGIN,
}: { clientAddress?: string | null; origin?: string } = {}): OwnerCall {
  return { method: 'GET', path: METHOD_PATH, headers: clientHeaders(clientAddress), origin };
}

function serve({ call, workerEnv }: { call: OwnerCall; workerEnv: Env }): Promise<Response> {
  return serveOwnerCall({ call, now: CLOCK_NOW, workerEnv });
}

async function expectRefused(response: Response): Promise<void> {
  expect(response.status).toBe(TOO_MANY_STATUS);
  expect(await response.json()).toEqual(SIGN_IN_REFUSED);
  expect(response.headers.get(RETRY_AFTER_HEADER)).toBe(RETRY_AFTER_SECONDS);
}

async function expectUnavailable(response: Response): Promise<void> {
  expect(response.status).toBe(UNAVAILABLE_STATUS);
  expect(await response.json()).toEqual(SIGN_IN_UNAVAILABLE);
}

beforeEach(() => {
  acceptingSiteverify();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('the three sign-in limits on a public host', () => {
  test.each([
    { name: 'the method read', binding: LimiterBinding.Client, call: () => methodCall() },
    { name: 'the link request', binding: LimiterBinding.Client, call: () => linkCall().call },
    { name: 'the link request', binding: LimiterBinding.Address, call: () => linkCall().call },
    { name: 'the link request', binding: LimiterBinding.Global, call: () => linkCall().call },
    { name: 'the session post', binding: LimiterBinding.Client, call: () => sessionCall() },
    { name: 'the session post', binding: LimiterBinding.Global, call: () => sessionCall() },
  ])('$name over $binding answers 429 sign_in_refused with Retry-After 60', async ({ binding, call }) => {
    const { limiters } = recordedLimiters({ refusing: [binding] });
    await expectRefused(await serve({ call: call(), workerEnv: guardedEnv({ limiters }) }));
  });

  test('the refusals of every limit and route have the same body', async () => {
    const bodies = await Promise.all(
      [
        { binding: LimiterBinding.Client, call: methodCall() },
        { binding: LimiterBinding.Address, call: linkCall().call },
        { binding: LimiterBinding.Global, call: linkCall().call },
        { binding: LimiterBinding.Global, call: sessionCall() },
      ].map(async ({ binding, call }) => {
        const { limiters } = recordedLimiters({ refusing: [binding] });
        return (await serve({ call, workerEnv: guardedEnv({ limiters }) })).text();
      }),
    );
    expect(new Set(bodies).size).toBe(1);
  });

  test.each([[LimiterBinding.Client], [LimiterBinding.Address], [LimiterBinding.Global]])(
    'a link request refused by %s sends no mail and stores no link',
    async (binding) => {
      const { binding: mail, sent } = recordingBinding();
      const { limiters } = recordedLimiters({ refusing: [binding] });
      const { email, call } = linkCall();
      await expectRefused(await serve({ call, workerEnv: guardedEnv({ limiters, binding: mail }) }));
      expect(sent).toEqual([]);
      expect(await linkRows(email)).toEqual([]);
    },
  );

  test('the link request keys the client by route and address, the address by its digest and the cap by route', async () => {
    const { limiters, keys } = recordedLimiters();
    const { call } = linkCall({ email: '  Maria.Limit@Example.COM ' });
    expect((await serve({ call, workerEnv: guardedEnv({ limiters }) })).status).toBe(ACCEPTED_STATUS);
    expect(keys).toEqual({
      [LimiterBinding.Client]: [`${OwnerRoute.RequestSignInLink}:${FIRST_CLIENT_ADDRESS}`],
      [LimiterBinding.Address]: [`${OwnerRoute.RequestSignInLink}:${await digestCredential('maria.limit@example.com')}`],
      [LimiterBinding.Global]: [OwnerRoute.RequestSignInLink],
    });
    expect(keys[LimiterBinding.Address].join()).not.toMatch(/maria/i);
  });

  test('the session post keys the client and the cap and never the address limit', async () => {
    const { limiters, keys } = recordedLimiters();
    expect((await serve({ call: sessionCall(), workerEnv: guardedEnv({ limiters }) })).status).toBe(UNAUTHORIZED_STATUS);
    expect(keys).toEqual({
      [LimiterBinding.Client]: [`${OwnerRoute.SignIn}:${FIRST_CLIENT_ADDRESS}`],
      [LimiterBinding.Address]: [],
      [LimiterBinding.Global]: [OwnerRoute.SignIn],
    });
  });

  test('the method read keys the client only', async () => {
    const { limiters, keys } = recordedLimiters();
    expect((await serve({ call: methodCall(), workerEnv: guardedEnv({ limiters }) })).status).toBe(OK_STATUS);
    expect(keys).toEqual({
      [LimiterBinding.Client]: [`${OwnerRoute.ReadSignInMethod}:${FIRST_CLIENT_ADDRESS}`],
      [LimiterBinding.Address]: [],
      [LimiterBinding.Global]: [],
    });
  });

  test('two client addresses have separate buckets on each route', async () => {
    const { limiters, keys } = recordedLimiters();
    await serve({ call: linkCall().call, workerEnv: guardedEnv({ limiters }) });
    await serve({ call: sessionCall(), workerEnv: guardedEnv({ limiters }) });
    await serve({ call: linkCall({ clientAddress: SECOND_CLIENT_ADDRESS }).call, workerEnv: guardedEnv({ limiters }) });
    expect(keys[LimiterBinding.Client]).toEqual([
      `${OwnerRoute.RequestSignInLink}:${FIRST_CLIENT_ADDRESS}`,
      `${OwnerRoute.SignIn}:${FIRST_CLIENT_ADDRESS}`,
      `${OwnerRoute.RequestSignInLink}:${SECOND_CLIENT_ADDRESS}`,
    ]);
  });

  test('two addresses in one IPv6 /64 share a bucket and another /64 has its own', async () => {
    const { limiters, keys } = recordedLimiters();
    await serve({ call: sessionCall({ clientAddress: FIRST_PREFIX_ADDRESS }), workerEnv: guardedEnv({ limiters }) });
    await serve({ call: sessionCall({ clientAddress: SECOND_PREFIX_ADDRESS }), workerEnv: guardedEnv({ limiters }) });
    await serve({ call: sessionCall({ clientAddress: OTHER_PREFIX_ADDRESS }), workerEnv: guardedEnv({ limiters }) });
    const [first, second, other] = keys[LimiterBinding.Client];
    expect(first).toBe(second);
    expect(other).not.toBe(first);
  });

  test('an IPv4-mapped IPv6 address shares the bucket of its IPv4 address', async () => {
    const { limiters, keys } = recordedLimiters();
    await serve({ call: sessionCall(), workerEnv: guardedEnv({ limiters }) });
    await serve({ call: sessionCall({ clientAddress: MAPPED_ADDRESS }), workerEnv: guardedEnv({ limiters }) });
    const [ipv4, mapped] = keys[LimiterBinding.Client];
    expect(mapped).toBe(ipv4);
  });

  test('a request within every limit reaches the handler', async () => {
    const { limiters } = recordedLimiters();
    expect((await serve({ call: linkCall().call, workerEnv: guardedEnv({ limiters }) })).status).toBe(ACCEPTED_STATUS);
  });

  test('a route that is not public never reaches a limiter', async () => {
    const { limiters, keys } = recordedLimiters({ refusing: Object.values(LimiterBinding) });
    const call: OwnerCall = { method: 'GET', path: OWNER_PATH, headers: clientHeaders(FIRST_CLIENT_ADDRESS), origin: PUBLIC_HTTPS_ORIGIN };
    const response = await serve({ call, workerEnv: guardedEnv({ limiters }) });
    expect(response.status).toBe(UNAUTHORIZED_STATUS);
    expect(Object.values(keys).flat()).toEqual([]);
  });

  test('the configured binding refuses the call after the shared maximum, for that client address only', async () => {
    const responses = await Promise.all(
      Array.from({ length: SIGN_IN_RATE_LIMIT_MAX + 1 }, () => ownerCall(sessionCall({ clientAddress: SATURATED_CLIENT_ADDRESS }))),
    );
    const statuses = responses.map((response) => response.status);
    const otherClient = await ownerCall(sessionCall({ clientAddress: UNTOUCHED_CLIENT_ADDRESS }));
    expect(statuses.filter((status) => status === TOO_MANY_STATUS)).toHaveLength(1);
    expect(otherClient.status).not.toBe(TOO_MANY_STATUS);
  });

  test('the helper refuses only when the limiter says so', async () => {
    const request = new Request(`https://api.todz.test${METHOD_PATH}`, { headers: clientHeaders(FIRST_CLIENT_ADDRESS) });
    const { limiters } = recordedLimiters();
    expect(await signInLimitRefusal({ request, env: guardedEnv({ limiters }), route: OwnerRoute.ReadSignInMethod })).toBeNull();
    expect(SIGN_IN_RATE_LIMIT_PERIOD_SECONDS).toBe(Number(RETRY_AFTER_SECONDS));
  });
});

describe('the sign-in limits failing closed on a public host', () => {
  test.each([
    { name: 'the method read', binding: LimiterBinding.Client, call: () => methodCall() },
    { name: 'the link request', binding: LimiterBinding.Client, call: () => linkCall().call },
    { name: 'the link request', binding: LimiterBinding.Address, call: () => linkCall().call },
    { name: 'the link request', binding: LimiterBinding.Global, call: () => linkCall().call },
    { name: 'the session post', binding: LimiterBinding.Client, call: () => sessionCall() },
    { name: 'the session post', binding: LimiterBinding.Global, call: () => sessionCall() },
  ])('$name without $binding answers 503 sign_in_unavailable', async ({ binding, call }) => {
    const { limiters } = recordedLimiters();
    await expectUnavailable(await serve({ call: call(), workerEnv: guardedEnv({ limiters: { ...limiters, [binding]: undefined } }) }));
  });

  test.each([
    { name: 'the method read', bindings: [LimiterBinding.Address, LimiterBinding.Global], call: () => methodCall(), status: OK_STATUS },
    { name: 'the session post', bindings: [LimiterBinding.Address], call: () => sessionCall(), status: UNAUTHORIZED_STATUS },
  ])('$name never needs $bindings', async ({ bindings, call, status }) => {
    const { limiters } = recordedLimiters();
    const absent = Object.fromEntries(bindings.map((binding) => [binding, undefined]));
    expect((await serve({ call: call(), workerEnv: guardedEnv({ limiters: { ...limiters, ...absent } }) })).status).toBe(status);
  });

  test.each([
    { name: 'the method read', call: () => methodCall({ clientAddress: null }) },
    { name: 'the link request', call: () => linkCall({ clientAddress: null }).call },
    { name: 'the session post', call: () => sessionCall({ clientAddress: null }) },
  ])('$name without the client address header answers 503 sign_in_unavailable and consults no limiter', async ({ call }) => {
    const { limiters, keys } = recordedLimiters();
    await expectUnavailable(await serve({ call: call(), workerEnv: guardedEnv({ limiters }) }));
    expect(Object.values(keys).flat()).toEqual([]);
  });

  test.each([
    { name: 'the method read', binding: LimiterBinding.Client, call: () => methodCall() },
    { name: 'the link request', binding: LimiterBinding.Client, call: () => linkCall().call },
    { name: 'the link request', binding: LimiterBinding.Address, call: () => linkCall().call },
    { name: 'the link request', binding: LimiterBinding.Global, call: () => linkCall().call },
    { name: 'the session post', binding: LimiterBinding.Global, call: () => sessionCall() },
  ])('$name whose $binding throws answers 503 sign_in_unavailable', async ({ binding, call }) => {
    const { limiters } = recordedLimiters();
    await expectUnavailable(
      await serve({ call: call(), workerEnv: guardedEnv({ limiters: { ...limiters, [binding]: throwingLimiter() } }) }),
    );
  });

  test('a link request with no limiter binding at all sends no mail and stores no link', async () => {
    const { binding: mail, sent } = recordingBinding();
    const { email, call } = linkCall();
    const absent = Object.fromEntries(Object.values(LimiterBinding).map((binding) => [binding, undefined]));
    await expectUnavailable(await serve({ call, workerEnv: guardedEnv({ limiters: absent, binding: mail }) }));
    expect(sent).toEqual([]);
    expect(await linkRows(email)).toEqual([]);
  });
});

describe('the sign-in limits on a local host', () => {
  function localEnv(limiters: Limiters): Env {
    return emailEnv({ ...limiters });
  }

  test.each([
    { name: 'the method read', call: () => methodCall({ origin: PUBLIC_ORIGIN }), status: OK_STATUS },
    {
      name: 'the link request',
      call: () => linkCall({ origin: PUBLIC_ORIGIN, turnstileToken: TURNSTILE_DUMMY_TOKEN }).call,
      status: ACCEPTED_STATUS,
    },
    {
      name: 'the session post',
      call: () => sessionCall({ origin: PUBLIC_ORIGIN, turnstileToken: TURNSTILE_DUMMY_TOKEN }),
      status: UNAUTHORIZED_STATUS,
    },
  ])('$name skips all three limits, whatever address the local runtime sets', async ({ call, status }) => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const { limiters, keys } = recordedLimiters({ refusing: Object.values(LimiterBinding) });
    expect((await serve({ call: call(), workerEnv: localEnv(limiters) })).status).toBe(status);
    expect(Object.values(keys).flat()).toEqual([]);
  });

  test('a local host needs neither the bindings nor the client address', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const call = linkCall({ origin: PUBLIC_ORIGIN, clientAddress: null, turnstileToken: TURNSTILE_DUMMY_TOKEN }).call;
    expect((await serve({ call, workerEnv: localEnv({}) })).status).toBe(ACCEPTED_STATUS);
  });

  test('a public PUBLIC_ORIGIN with a localhost request is not a local host, so the limits apply', async () => {
    const { limiters, keys } = recordedLimiters({ refusing: [LimiterBinding.Client] });
    await expectRefused(await serve({ call: methodCall({ origin: PUBLIC_ORIGIN }), workerEnv: guardedEnv({ limiters }) }));
    expect(keys[LimiterBinding.Client]).toEqual([`${OwnerRoute.ReadSignInMethod}:${FIRST_CLIENT_ADDRESS}`]);
  });

  test('a local PUBLIC_ORIGIN with a public request is not a local host, so the limits apply', async () => {
    const { limiters } = recordedLimiters({ refusing: [LimiterBinding.Client] });
    const workerEnv = emailEnv({ ...guardedSettings(), PUBLIC_ORIGIN, ...limiters });
    await expectRefused(await serve({ call: methodCall(), workerEnv }));
  });
});
