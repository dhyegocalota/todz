import { SIGN_IN_RATE_LIMIT_MAX, SIGN_IN_RATE_LIMIT_PERIOD_SECONDS } from '@todz/types';
import { describe, expect, test } from 'vitest';
import type { Env } from '../src/env';
import { OwnerRoute } from '../src/owner-routes';
import { signInLimitRefusal } from '../src/sign-in-limiter';
import {
  CLOUDFLARE_SETTINGS,
  LINK_CHALLENGE,
  PUBLIC_HTTPS_ORIGIN,
  PUBLIC_ORIGIN,
  emailEnv,
  freshAddress,
  recordingBinding,
} from './email-sign-in-client';
import { type OwnerCall, ownerCall, serveOwnerCall } from './owner-client';
import { CLOCK_NOW } from './task-fixtures';

const CLIENT_ADDRESS_HEADER = 'CF-Connecting-IP';
const FIRST_CLIENT_ADDRESS = '203.0.113.7';
const SECOND_CLIENT_ADDRESS = '203.0.113.8';
const FIRST_PREFIX_ADDRESS = '2001:db8:1:2:3:4:5:6';
const SECOND_PREFIX_ADDRESS = '2001:db8:1:2:ffff:eeee:dddd:cccc';
const OTHER_PREFIX_ADDRESS = '2001:db8:1:3:3:4:5:6';
const MAPPED_ADDRESS = '::ffff:203.0.113.7';
const ACCEPTED_STATUS = 202;
const OK_STATUS = 200;
const SATURATED_CLIENT_ADDRESS = '198.51.100.1';
const UNTOUCHED_CLIENT_ADDRESS = '192.0.2.1';
const TOO_MANY_STATUS = 429;
const TOO_MANY_REQUESTS = { error: 'too_many_requests' };
const RETRY_AFTER_HEADER = 'Retry-After';
const SESSIONS_PATH = '/owner/sessions';
const LINKS_PATH = '/owner/sign-in-links';
const METHOD_PATH = '/owner/sign-in-method';

type RecordingLimiter = { limiter: RateLimit; keys: string[] };

function recordingLimiter({ isAllowed }: { isAllowed: boolean }): RecordingLimiter {
  const keys: string[] = [];
  const limiter: RateLimit = {
    async limit({ key }) {
      keys.push(key);
      return { success: isAllowed };
    },
  };
  return { limiter, keys };
}

function limitedEnv(limiter: RateLimit | undefined): Env {
  return emailEnv({ ...CLOUDFLARE_SETTINGS, EMAIL: recordingBinding().binding, SIGN_IN_LIMITER: limiter });
}

function linkCall(address?: string, origin = PUBLIC_HTTPS_ORIGIN): OwnerCall {
  const headers = address === undefined ? undefined : { [CLIENT_ADDRESS_HEADER]: address };
  return { method: 'POST', path: LINKS_PATH, body: { email: freshAddress(), link_challenge: LINK_CHALLENGE }, headers, origin };
}

function sessionCall(address: string, origin = PUBLIC_HTTPS_ORIGIN): OwnerCall {
  const body = { identity_token: 'not-a-link-token', time_zone: 'UTC' };
  return { method: 'POST', path: SESSIONS_PATH, body, headers: { [CLIENT_ADDRESS_HEADER]: address }, origin };
}

function serve({ call, workerEnv }: { call: OwnerCall; workerEnv: Env }): Promise<Response> {
  return serveOwnerCall({ call, now: CLOCK_NOW, workerEnv });
}

describe('the sign-in limiter', () => {
  test.each([
    { name: 'the link request', call: linkCall(FIRST_CLIENT_ADDRESS) },
    { name: 'the session post', call: sessionCall(FIRST_CLIENT_ADDRESS) },
  ])('$name over the limit answers 429 too_many_requests with the period as Retry-After', async ({ call }) => {
    const { limiter } = recordingLimiter({ isAllowed: false });
    const response = await serve({ call, workerEnv: limitedEnv(limiter) });
    expect(response.status).toBe(TOO_MANY_STATUS);
    expect(await response.json()).toEqual(TOO_MANY_REQUESTS);
    expect(response.headers.get(RETRY_AFTER_HEADER)).toBe(String(SIGN_IN_RATE_LIMIT_PERIOD_SECONDS));
  });

  test('both posts answer the same body when over the limit', async () => {
    const { limiter } = recordingLimiter({ isAllowed: false });
    const link = await serve({ call: linkCall(FIRST_CLIENT_ADDRESS), workerEnv: limitedEnv(limiter) });
    const session = await serve({ call: sessionCall(FIRST_CLIENT_ADDRESS), workerEnv: limitedEnv(limiter) });
    expect(await link.text()).toBe(await session.text());
  });

  test('the key names the route and the client address, so the two posts have separate buckets', async () => {
    const { limiter, keys } = recordingLimiter({ isAllowed: true });
    await serve({ call: linkCall(FIRST_CLIENT_ADDRESS), workerEnv: limitedEnv(limiter) });
    await serve({ call: sessionCall(FIRST_CLIENT_ADDRESS), workerEnv: limitedEnv(limiter) });
    await serve({ call: linkCall(SECOND_CLIENT_ADDRESS), workerEnv: limitedEnv(limiter) });
    expect(keys).toEqual([
      `${OwnerRoute.RequestSignInLink}:${FIRST_CLIENT_ADDRESS}`,
      `${OwnerRoute.SignIn}:${FIRST_CLIENT_ADDRESS}`,
      `${OwnerRoute.RequestSignInLink}:${SECOND_CLIENT_ADDRESS}`,
    ]);
  });

  test('a request within the limit reaches the handler', async () => {
    const { limiter } = recordingLimiter({ isAllowed: true });
    const response = await serve({ call: linkCall(FIRST_CLIENT_ADDRESS), workerEnv: limitedEnv(limiter) });
    expect(response.status).toBe(ACCEPTED_STATUS);
  });

  test('a request without the client address header skips the check', async () => {
    const { limiter, keys } = recordingLimiter({ isAllowed: false });
    const response = await serve({ call: linkCall(), workerEnv: limitedEnv(limiter) });
    expect(response.status).toBe(ACCEPTED_STATUS);
    expect(keys).toEqual([]);
  });

  test.each([
    { name: 'the link request', call: linkCall(FIRST_CLIENT_ADDRESS, PUBLIC_ORIGIN) },
    { name: 'the session post', call: sessionCall(FIRST_CLIENT_ADDRESS, PUBLIC_ORIGIN) },
  ])('$name whose own host is local skips the check, whatever address the local runtime sets', async ({ call }) => {
    const { limiter, keys } = recordingLimiter({ isAllowed: false });
    const response = await serve({ call, workerEnv: limitedEnv(limiter) });
    expect(response.status).not.toBe(TOO_MANY_STATUS);
    expect(keys).toEqual([]);
  });

  test('two addresses in one IPv6 /64 share a bucket and another /64 has its own', async () => {
    const { limiter, keys } = recordingLimiter({ isAllowed: true });
    await serve({ call: sessionCall(FIRST_PREFIX_ADDRESS), workerEnv: limitedEnv(limiter) });
    await serve({ call: sessionCall(SECOND_PREFIX_ADDRESS), workerEnv: limitedEnv(limiter) });
    await serve({ call: sessionCall(OTHER_PREFIX_ADDRESS), workerEnv: limitedEnv(limiter) });
    const [first, second, other] = keys;
    expect(first).toBe(second);
    expect(other).not.toBe(first);
  });

  test('an IPv4-mapped IPv6 address shares the bucket of its IPv4 address', async () => {
    const { limiter, keys } = recordingLimiter({ isAllowed: true });
    await serve({ call: sessionCall(FIRST_CLIENT_ADDRESS), workerEnv: limitedEnv(limiter) });
    await serve({ call: sessionCall(MAPPED_ADDRESS), workerEnv: limitedEnv(limiter) });
    expect(keys[0]).toBe(keys[1]);
  });

  test('a Worker without the binding skips the check', async () => {
    const response = await serve({ call: linkCall(FIRST_CLIENT_ADDRESS), workerEnv: limitedEnv(undefined) });
    expect(response.status).toBe(ACCEPTED_STATUS);
  });

  test('a route that is not a public post never reaches the limiter', async () => {
    const { limiter, keys } = recordingLimiter({ isAllowed: false });
    const call: OwnerCall = { method: 'GET', path: METHOD_PATH, headers: { [CLIENT_ADDRESS_HEADER]: FIRST_CLIENT_ADDRESS } };
    const response = await serve({ call, workerEnv: limitedEnv(limiter) });
    expect(response.status).toBe(OK_STATUS);
    expect(keys).toEqual([]);
  });

  test('the configured binding refuses the call after the shared maximum, for that client address only', async () => {
    const responses = await Promise.all(
      Array.from({ length: SIGN_IN_RATE_LIMIT_MAX + 1 }, () => ownerCall(sessionCall(SATURATED_CLIENT_ADDRESS))),
    );
    const statuses = responses.map((response) => response.status);
    const otherClient = await ownerCall(sessionCall(UNTOUCHED_CLIENT_ADDRESS));
    expect(statuses.filter((status) => status === TOO_MANY_STATUS)).toHaveLength(1);
    expect(otherClient.status).not.toBe(TOO_MANY_STATUS);
  });

  test('the helper refuses only when the limiter says so', async () => {
    const request = new Request(`https://api.todz.test${LINKS_PATH}`, {
      method: 'POST',
      headers: { [CLIENT_ADDRESS_HEADER]: FIRST_CLIENT_ADDRESS },
    });
    const { limiter } = recordingLimiter({ isAllowed: true });
    expect(await signInLimitRefusal({ request, env: limitedEnv(limiter), route: OwnerRoute.RequestSignInLink })).toBeNull();
  });
});
