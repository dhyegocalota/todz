import { DAY_EMAIL_STOP_TOKEN_LENGTH, MILLISECONDS_PER_DAY } from '@todz/types';
import { createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { env, exports } from 'cloudflare:workers';
import { describe, expect, test } from 'vitest';
import { issueReplyAddress } from '../../src/day-email/day-email-reply-address';
import { issueStopLink } from '../../src/day-email/day-email-stop-link';
import { insertStopLink } from '../../src/day-email/day-email-store';
import { digestCredential } from '../../src/credential-digest';
import { generateStopSecret } from '../../src/credential-secret';
import type { Env } from '../../src/env';
import worker from '../../src/index';
import { CLIENT_ADDRESS, CLIENT_ADDRESS_HEADER, recordingLimiter } from '../email-sign-in-client';
import { ownerCall, signInOwner, workerEnvWith } from '../owner-client';

const STOP_URL = 'http://localhost:8787/day-email/stop';
const PUBLIC_API_ORIGIN = 'https://api.todz.test';
const PUBLIC_STOP_URL = `${PUBLIC_API_ORIGIN}/day-email/stop`;
const OK_STATUS = 200;
const NOT_FOUND_STATUS = 404;
const METHOD_NOT_ALLOWED_STATUS = 405;
const TOO_MANY_REQUESTS_STATUS = 429;
const UNAVAILABLE_STATUS = 503;
const STOP_PAGE_HEADING = 'Stop your day email?';
const DONE_PAGE_HEADING = 'Your day email is off';
const GONE_PAGE_HEADING = 'This link no longer works';
const LIMITED_PAGE_HEADING = 'Try again in a minute';
const STOP_BUTTON = 'Stop my day email';
const STYLE_BLOCK_PATTERN = /<style>([^<]*)<\/style>/;
const STYLE_CONTENT_GROUP = 1;
const HASH_ALGORITHM = 'SHA-256';

type EdgeRequest = Request<unknown, IncomingRequestCfProperties>;
type SeededStop = { ownerId: string; token: string; sessionToken: string };

type StopRow = { owner_id: string };
type DayEmailRow = { day_email: number; day_email_chosen_at: number | null };

function stopRequest({ method, token, url = STOP_URL, body, headers }: StopCall): Request {
  const address = token === undefined ? url : `${url}?token=${token}`;
  return new Request(address, { method, body, headers });
}

type StopCall = { method: string; token?: string; url?: string; body?: BodyInit; headers?: Record<string, string> };

function stopCall(call: StopCall): Promise<Response> {
  return exports.default.fetch(stopRequest(call));
}

async function publicStopCall({
  call,
  workerEnv,
  clientAddress = CLIENT_ADDRESS,
}: {
  call: StopCall;
  workerEnv: Env;
  clientAddress?: string | null;
}): Promise<Response> {
  const executionContext = createExecutionContext();
  const addressHeaders: Record<string, string> = clientAddress === null ? {} : { [CLIENT_ADDRESS_HEADER]: clientAddress };
  const request = stopRequest({ ...call, url: PUBLIC_STOP_URL, headers: addressHeaders });
  const response = await worker.fetch(request as EdgeRequest, workerEnv, executionContext);
  await waitOnExecutionContext(executionContext);
  return response;
}

async function seededStop(): Promise<SeededStop> {
  const { ownerId, token: sessionToken } = await signInOwner();
  const token = await issueStopLink({ directory: env.DIRECTORY, ownerId, now: Date.now() });
  await issueReplyAddress({ directory: env.DIRECTORY, ownerId, now: Date.now() });
  return { ownerId, token, sessionToken };
}

async function dayEmailRow(ownerId: string): Promise<DayEmailRow> {
  const row = await env.DIRECTORY.prepare('SELECT day_email, day_email_chosen_at FROM owners WHERE id = ?')
    .bind(ownerId)
    .first<DayEmailRow>();
  if (row === null) throw new Error('the owner should exist');
  return row;
}

async function stopLinkOwners(ownerId: string): Promise<StopRow[]> {
  const { results } = await env.DIRECTORY.prepare('SELECT owner_id FROM day_email_stop_links WHERE owner_id = ?')
    .bind(ownerId)
    .all<StopRow>();
  return results;
}

async function replyAddressCount(ownerId: string): Promise<number> {
  const { results } = await env.DIRECTORY.prepare('SELECT digest FROM day_email_reply_addresses WHERE owner_id = ?').bind(ownerId).all();
  return results.length;
}

async function expectUntouched(seeded: SeededStop): Promise<void> {
  expect(await dayEmailRow(seeded.ownerId)).toEqual({ day_email: 1, day_email_chosen_at: null });
  expect(await stopLinkOwners(seeded.ownerId)).toHaveLength(1);
  expect(await replyAddressCount(seeded.ownerId)).toBe(1);
}

async function expectedPolicy(html: string): Promise<string> {
  const style = STYLE_BLOCK_PATTERN.exec(html)?.[STYLE_CONTENT_GROUP];
  if (style === undefined) throw new Error('the page should carry one style block');
  const digest = await crypto.subtle.digest(HASH_ALGORITHM, new TextEncoder().encode(style));
  const hash = btoa(String.fromCharCode(...new Uint8Array(digest)));
  return `default-src 'none'; style-src 'sha256-${hash}'; img-src data:; form-action 'self'; base-uri 'none'; frame-ancestors 'none'`;
}

describe('GET /day-email/stop with a live token', () => {
  test('answers the page with one button that posts to the same address and changes nothing', async () => {
    const seeded = await seededStop();
    const response = await stopCall({ method: 'GET', token: seeded.token });
    expect(response.status).toBe(OK_STATUS);
    const html = await response.text();
    expect(html).toContain(STOP_PAGE_HEADING);
    expect(html).toContain(STOP_BUTTON);
    expect(html).toContain('method="post"');
    expect(html.split(seeded.token)).toHaveLength(2);
    await expectUntouched(seeded);
  });

  test('answers it again to a second GET', async () => {
    const seeded = await seededStop();
    await stopCall({ method: 'GET', token: seeded.token });
    expect((await stopCall({ method: 'GET', token: seeded.token })).status).toBe(OK_STATUS);
    await expectUntouched(seeded);
  });
});

describe('POST /day-email/stop with a live token', () => {
  test.each([
    ['the one-click body', { body: 'List-Unsubscribe=One-Click', headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }],
    ['an empty body', {}],
    ['a JSON body', { body: '{"stop":false}', headers: { 'Content-Type': 'application/json' } }],
    ['a body of no declared type', { body: 'anything' }],
    ['a body far past any bound', { body: 'x'.repeat(100_000), headers: { 'Content-Type': 'text/plain' } }],
  ])('with %s turns the day email off, stamps the choice and deletes the reply addresses and stop links', async (_name, call) => {
    const seeded = await seededStop();
    const response = await stopCall({ method: 'POST', token: seeded.token, ...call });
    expect(response.status).toBe(OK_STATUS);
    expect(await response.text()).toContain(DONE_PAGE_HEADING);
    const row = await dayEmailRow(seeded.ownerId);
    expect(row.day_email).toBe(0);
    expect(row.day_email_chosen_at).not.toBeNull();
    expect(row.day_email_chosen_at).toBeLessThanOrEqual(Date.now());
    expect(await stopLinkOwners(seeded.ownerId)).toEqual([]);
    expect(await replyAddressCount(seeded.ownerId)).toBe(0);
  });

  test('a second POST with the same token answers 404', async () => {
    const seeded = await seededStop();
    await stopCall({ method: 'POST', token: seeded.token });
    const response = await stopCall({ method: 'POST', token: seeded.token });
    expect(response.status).toBe(NOT_FOUND_STATUS);
    expect(await response.text()).toContain(GONE_PAGE_HEADING);
  });

  test("one owner's token changes no other owner", async () => {
    const stopped = await seededStop();
    const other = await seededStop();
    await stopCall({ method: 'POST', token: stopped.token });
    await expectUntouched(other);
  });
});

describe('a token that does not name a live link', () => {
  const VALID_LENGTH = DAY_EMAIL_STOP_TOKEN_LENGTH;

  async function expiredToken(): Promise<SeededStop> {
    const { ownerId, token: sessionToken } = await signInOwner();
    const token = generateStopSecret();
    await insertStopLink({
      directory: env.DIRECTORY,
      digest: await digestCredential(token),
      ownerId,
      now: Date.now() - MILLISECONDS_PER_DAY,
      expiresAt: Date.now() - 1,
    });
    return { ownerId, token, sessionToken };
  }

  test.each(['GET', 'POST'])('%s answers 404 for each of them and stores nothing', async (method) => {
    const live = await seededStop();
    const expired = await expiredToken();
    const unknown = 'd'.repeat(VALID_LENGTH);
    const tokens = [
      unknown,
      expired.token,
      'a'.repeat(VALID_LENGTH - 1),
      'a'.repeat(VALID_LENGTH + 1),
      'g'.repeat(VALID_LENGTH),
      live.token.toUpperCase(),
    ];
    const responses = await Promise.all(tokens.map((token) => stopCall({ method, token })));
    expect(responses.map((response) => response.status)).toEqual(tokens.map(() => NOT_FOUND_STATUS));
    expect(await responses[0]?.text()).toContain(GONE_PAGE_HEADING);
    await expectUntouched(live);
    expect(await dayEmailRow(expired.ownerId)).toEqual({ day_email: 1, day_email_chosen_at: null });
  });

  test.each(['GET', 'POST'])('%s with no token answers 404', async (method) => {
    expect((await stopCall({ method })).status).toBe(NOT_FOUND_STATUS);
  });

  test.each(['GET', 'POST'])('%s with the token repeated answers 404 and stores nothing', async (method) => {
    const live = await seededStop();
    const response = await stopCall({ method, url: `${STOP_URL}?token=${live.token}&token=${live.token}` });
    expect(response.status).toBe(NOT_FOUND_STATUS);
    await expectUntouched(live);
  });
});

describe('the other methods', () => {
  test.each(['PUT', 'DELETE', 'PATCH'])('%s answers 405', async (method) => {
    const seeded = await seededStop();
    const response = await stopCall({ method, token: seeded.token });
    expect(response.status).toBe(METHOD_NOT_ALLOWED_STATUS);
    await expectUntouched(seeded);
  });
});

describe('every answer', () => {
  type Answer = { name: string; call: () => Promise<Response> };

  async function answers(): Promise<Answer[]> {
    const seeded = await seededStop();
    const gone = 'e'.repeat(DAY_EMAIL_STOP_TOKEN_LENGTH);
    const other = await seededStop();
    return [
      { name: 'the page of a GET', call: () => stopCall({ method: 'GET', token: seeded.token }) },
      { name: 'the 404 of a GET', call: () => stopCall({ method: 'GET', token: gone }) },
      { name: 'the 404 of a POST', call: () => stopCall({ method: 'POST', token: gone }) },
      { name: 'the 429', call: () => limitedCall() },
      { name: 'the page of a POST', call: () => stopCall({ method: 'POST', token: other.token }) },
    ];
  }

  async function limitedCall(): Promise<Response> {
    const { limiter } = recordingLimiter({ isAllowed: false });
    return publicStopCall({ call: { method: 'GET', token: 'f'.repeat(DAY_EMAIL_STOP_TOKEN_LENGTH) }, workerEnv: publicEnv(limiter) });
  }

  test('carries the exact policy of its own style block, noindex, no-store and the shared security headers', async () => {
    const calls = await answers();
    const responses = await Promise.all(calls.map(({ call }) => call()));
    const policies = await Promise.all(responses.map(async (response) => expectedPolicy(await response.clone().text())));
    responses.forEach((response, index) => {
      expect(response.headers.get('Content-Security-Policy')).toBe(policies[index]);
      expect(response.headers.get('X-Robots-Tag')).toBe('noindex');
      expect(response.headers.get('Cache-Control')).toBe('no-store');
      expect(response.headers.get('Strict-Transport-Security')).toBe('max-age=31536000; includeSubDomains');
      expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
      expect(response.headers.get('Referrer-Policy')).toBe('no-referrer');
      expect(response.headers.get('Content-Type')).toContain('text/html');
    });
  });
});

function publicEnv(limiter: RateLimit | undefined): Env {
  return workerEnvWith({ PUBLIC_ORIGIN: PUBLIC_API_ORIGIN, DAY_EMAIL_STOP_LIMITER: limiter });
}

describe('the limiter', () => {
  test('answers 429 with the try again page, Retry-After and nothing stored past the limit of one client', async () => {
    const seeded = await seededStop();
    const { limiter, keys } = recordingLimiter({ isAllowed: false });
    const response = await publicStopCall({ call: { method: 'POST', token: seeded.token }, workerEnv: publicEnv(limiter) });
    expect(response.status).toBe(TOO_MANY_REQUESTS_STATUS);
    expect(response.headers.get('Retry-After')).toBe('60');
    expect(await response.text()).toContain(LIMITED_PAGE_HEADING);
    expect(keys).toEqual([`/day-email/stop:${CLIENT_ADDRESS}`]);
    await expectUntouched(seeded);
  });

  test('lets a request within the limit through', async () => {
    const seeded = await seededStop();
    const { limiter } = recordingLimiter({ isAllowed: true });
    const response = await publicStopCall({ call: { method: 'POST', token: seeded.token }, workerEnv: publicEnv(limiter) });
    expect(response.status).toBe(OK_STATUS);
    expect((await dayEmailRow(seeded.ownerId)).day_email).toBe(0);
  });

  test('a public host without its limiter answers 503 and stores nothing', async () => {
    const seeded = await seededStop();
    const response = await publicStopCall({ call: { method: 'POST', token: seeded.token }, workerEnv: publicEnv(undefined) });
    expect(response.status).toBe(UNAVAILABLE_STATUS);
    await expectUntouched(seeded);
  });

  test('a public host without a client address answers 503 and stores nothing', async () => {
    const seeded = await seededStop();
    const { limiter } = recordingLimiter({ isAllowed: true });
    const response = await publicStopCall({
      call: { method: 'POST', token: seeded.token },
      workerEnv: publicEnv(limiter),
      clientAddress: null,
    });
    expect(response.status).toBe(UNAVAILABLE_STATUS);
    await expectUntouched(seeded);
  });
});

describe('PATCH /owner with the day email off', () => {
  test("deletes that owner's stop links and leaves another owner's", async () => {
    const first = await seededStop();
    const second = await seededStop();
    await ownerCall({ method: 'PATCH', path: '/owner', token: first.sessionToken, body: { day_email: false } });
    expect(await stopLinkOwners(first.ownerId)).toEqual([]);
    expect(await stopLinkOwners(second.ownerId)).toHaveLength(1);
  });
});
