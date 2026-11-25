import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { generateCredentialSecret } from '../src/credential-secret';
import type { Env } from '../src/env';
import { TURNSTILE_DUMMY_TOKEN, TurnstileAction } from '../src/turnstile';
import {
  CLIENT_ADDRESS,
  CLIENT_ADDRESS_HEADER,
  LINK_CHALLENGE,
  PUBLIC_ORIGIN,
  TURNSTILE_TEST_SECRET,
  TURNSTILE_TOKEN_OF_ACTION,
  acceptingSiteverify,
  askedLink,
  consoleOutput,
  emailEnv,
  freshAddress,
  guardedSettings,
  linkRows,
  messageSent,
  recordingBinding,
  recordingLimiter,
  redeemLink,
  requestLink,
  tokenOfMail,
} from './email-sign-in-client';
import { serveOwnerCall, signInCall } from './owner-client';
import { CLOCK_NOW } from './task-fixtures';

const PUBLIC_REQUEST_ORIGIN = 'https://api.todz.test';
const LINKS_PATH = '/owner/sign-in-links';
const SESSIONS_PATH = '/owner/sessions';
const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const TOKEN_LENGTH_MAX = 2048;
const ACCEPTED_STATUS = 202;
const CREATED_STATUS = 201;
const BAD_REQUEST_STATUS = 400;
const TOO_MANY_STATUS = 429;
const UNAVAILABLE_STATUS = 503;
const INVALID_REQUEST = { error: 'invalid_request' };
const SIGN_IN_REFUSED = { error: 'sign_in_refused' };
const SIGN_IN_UNAVAILABLE = { error: 'sign_in_unavailable' };
const RETRY_AFTER_SECONDS = '60';
const REQUEST_LINK_TOKEN = TURNSTILE_TOKEN_OF_ACTION[TurnstileAction.RequestLink];
const SIGN_IN_TOKEN = TURNSTILE_TOKEN_OF_ACTION[TurnstileAction.SignIn];
const CONSOLE_METHODS = ['log', 'error', 'warn', 'info', 'debug'] as const;

const MALFORMED_TOKENS: [string, unknown][] = [
  ['an empty token', ''],
  ['a token with a space', 'a b'],
  ['a token with markup', '<script>'],
  ['a token over 2048 characters', 'a'.repeat(TOKEN_LENGTH_MAX + 1)],
  ['a number', 5],
  ['null', null],
];

type Guarded = { workerEnv: Env; sent: ReturnType<typeof recordingBinding>['sent'] };

function guarded(settings: Partial<Env> = {}): Guarded {
  const { binding, sent } = recordingBinding();
  return { workerEnv: emailEnv({ ...guardedSettings(), EMAIL: binding, ...settings }), sent };
}

function publicLink({ workerEnv, email, turnstileToken }: { workerEnv: Env; email: string; turnstileToken?: unknown }): Promise<Response> {
  return requestLink({ email, origin: PUBLIC_REQUEST_ORIGIN, workerEnv, turnstileToken });
}

function siteverifyAnswering(answer: () => Promise<Response>): void {
  vi.spyOn(globalThis, 'fetch').mockImplementation(answer);
}

async function expectRefused(response: Response): Promise<void> {
  expect(response.status).toBe(TOO_MANY_STATUS);
  expect(await response.json()).toEqual(SIGN_IN_REFUSED);
  expect(response.headers.get('Retry-After')).toBe(RETRY_AFTER_SECONDS);
}

async function expectUnavailable(response: Response): Promise<void> {
  expect(response.status).toBe(UNAVAILABLE_STATUS);
  expect(await response.json()).toEqual(SIGN_IN_UNAVAILABLE);
}

async function expectInvalid(response: Response): Promise<void> {
  expect(response.status).toBe(BAD_REQUEST_STATUS);
  expect(await response.json()).toEqual(INVALID_REQUEST);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('the Turnstile token on POST /owner/sign-in-links', () => {
  beforeEach(() => {
    acceptingSiteverify();
  });

  test('a solved token sends the mail and stores the link', async () => {
    const { workerEnv, sent } = guarded();
    const email = freshAddress();
    expect((await publicLink({ workerEnv, email, turnstileToken: REQUEST_LINK_TOKEN })).status).toBe(ACCEPTED_STATUS);
    expect(messageSent(sent).to).toBe(email);
    expect(await linkRows(email)).toHaveLength(1);
  });

  test('siteverify gets the secret and the token, once', async () => {
    const siteverify = acceptingSiteverify();
    const { workerEnv } = guarded();
    await publicLink({ workerEnv, email: freshAddress(), turnstileToken: REQUEST_LINK_TOKEN });
    expect(siteverify).toHaveBeenCalledTimes(1);
    const [url, init] = siteverify.mock.calls[0]!;
    expect(String(url)).toBe(SITEVERIFY_URL);
    expect(Object.fromEntries(new URLSearchParams(String(init?.body)))).toEqual({
      secret: TURNSTILE_TEST_SECRET,
      response: REQUEST_LINK_TOKEN,
    });
  });

  test('a missing token answers 400 invalid_request and sends nothing', async () => {
    const { workerEnv, sent } = guarded();
    const email = freshAddress();
    const response = await serveOwnerCall({
      call: {
        method: 'POST',
        path: LINKS_PATH,
        body: { email, link_challenge: LINK_CHALLENGE },
        headers: { [CLIENT_ADDRESS_HEADER]: CLIENT_ADDRESS },
        origin: PUBLIC_REQUEST_ORIGIN,
      },
      now: CLOCK_NOW,
      workerEnv,
    });
    await expectInvalid(response);
    expect(sent).toEqual([]);
    expect(await linkRows(email)).toEqual([]);
  });

  test.each(MALFORMED_TOKENS)('%s answers 400 invalid_request and sends nothing', async (_name, turnstileToken) => {
    const { workerEnv, sent } = guarded();
    const email = freshAddress();
    await expectInvalid(await publicLink({ workerEnv, email, turnstileToken }));
    expect(sent).toEqual([]);
    expect(await linkRows(email)).toEqual([]);
  });

  test('a token of 2048 characters is well formed', async () => {
    const { workerEnv } = guarded();
    const response = await publicLink({ workerEnv, email: freshAddress(), turnstileToken: 'a'.repeat(TOKEN_LENGTH_MAX) });
    expect(response.status).toBe(TOO_MANY_STATUS);
  });

  test.each([
    ['an unsolved token', 'never.solved.token'],
    ['a token solved for signing in', SIGN_IN_TOKEN],
  ])('%s answers 429 sign_in_refused, sends nothing and stores nothing', async (_name, turnstileToken) => {
    const { workerEnv, sent } = guarded();
    const email = freshAddress();
    await expectRefused(await publicLink({ workerEnv, email, turnstileToken }));
    expect(sent).toEqual([]);
    expect(await linkRows(email)).toEqual([]);
  });

  test('a token solved on another host answers 429 sign_in_refused', async () => {
    siteverifyAnswering(async () => Response.json({ success: true, hostname: 'evil.example', action: TurnstileAction.RequestLink }));
    const { workerEnv } = guarded();
    await expectRefused(await publicLink({ workerEnv, email: freshAddress(), turnstileToken: REQUEST_LINK_TOKEN }));
  });

  test('a refused token never reaches the address limit or the global cap', async () => {
    const address = recordingLimiter({ isAllowed: true });
    const global = recordingLimiter({ isAllowed: true });
    const { workerEnv } = guarded({ SIGN_IN_ADDRESS_LIMITER: address.limiter, SIGN_IN_GLOBAL_LIMITER: global.limiter });
    await expectRefused(await publicLink({ workerEnv, email: freshAddress(), turnstileToken: 'never.solved.token' }));
    expect([...address.keys, ...global.keys]).toEqual([]);
  });

  test.each([
    ['a fetch that throws', () => Promise.reject(new TypeError('network down'))],
    ['a non-2xx answer', async () => new Response('down', { status: 500 })],
    ['malformed JSON', async () => new Response('not json')],
    ['our own fault', async () => Response.json({ success: false, 'error-codes': ['invalid-input-secret'] })],
  ])('siteverify with %s answers 503 sign_in_unavailable, sends nothing and stores nothing', async (_name, answer) => {
    siteverifyAnswering(answer);
    const { workerEnv, sent } = guarded();
    const email = freshAddress();
    await expectUnavailable(await publicLink({ workerEnv, email, turnstileToken: REQUEST_LINK_TOKEN }));
    expect(sent).toEqual([]);
    expect(await linkRows(email)).toEqual([]);
  });

  test('no secret on a public host answers 503 before the body', async () => {
    const { workerEnv, sent } = guarded({ TURNSTILE_SECRET_KEY: undefined });
    const response = await serveOwnerCall({
      call: {
        method: 'POST',
        path: LINKS_PATH,
        rawBody: 'not json',
        headers: { [CLIENT_ADDRESS_HEADER]: CLIENT_ADDRESS },
        origin: PUBLIC_REQUEST_ORIGIN,
      },
      now: CLOCK_NOW,
      workerEnv,
    });
    await expectUnavailable(response);
    expect(sent).toEqual([]);
  });

  test('a malformed address answers 400 invalid_request before siteverify is asked', async () => {
    const siteverify = acceptingSiteverify();
    const { workerEnv, sent } = guarded();
    await expectInvalid(await publicLink({ workerEnv, email: 'not-an-address', turnstileToken: REQUEST_LINK_TOKEN }));
    expect(siteverify).not.toHaveBeenCalled();
    expect(sent).toEqual([]);
  });

  test.each([
    ['no public origin', undefined],
    ['an invalid public origin', 'https://todz.app/'],
  ])('%s answers 503 sign_in_unavailable before the body', async (_name, publicOrigin) => {
    const siteverify = acceptingSiteverify();
    const { workerEnv, sent } = guarded({ PUBLIC_ORIGIN: publicOrigin });
    const response = await serveOwnerCall({
      call: {
        method: 'POST',
        path: LINKS_PATH,
        rawBody: 'not json',
        headers: { [CLIENT_ADDRESS_HEADER]: CLIENT_ADDRESS },
        origin: PUBLIC_REQUEST_ORIGIN,
      },
      now: CLOCK_NOW,
      workerEnv,
    });
    await expectUnavailable(response);
    expect(siteverify).not.toHaveBeenCalled();
    expect(sent).toEqual([]);
  });

  test('no secret on a local host answers 503 too', async () => {
    const output = consoleOutput();
    await expectUnavailable(await requestLink({ workerEnv: emailEnv({ TURNSTILE_SECRET_KEY: undefined }) }));
    expect(output).not.toHaveBeenCalled();
  });
});

describe('the dummy token', () => {
  test('a local host accepts it without calling siteverify', async () => {
    consoleOutput();
    const siteverify = vi.spyOn(globalThis, 'fetch');
    expect((await requestLink({ turnstileToken: TURNSTILE_DUMMY_TOKEN })).status).toBe(ACCEPTED_STATUS);
    expect(siteverify).not.toHaveBeenCalled();
  });

  test('a local request to a public PUBLIC_ORIGIN sends it to siteverify, which refuses it', async () => {
    const siteverify = acceptingSiteverify();
    const { workerEnv, sent } = guarded();
    const email = freshAddress();
    await expectRefused(await requestLink({ email, origin: PUBLIC_ORIGIN, workerEnv, turnstileToken: TURNSTILE_DUMMY_TOKEN }));
    expect(siteverify).toHaveBeenCalledTimes(1);
    expect(sent).toEqual([]);
  });

  test('a public host sends it to siteverify, which refuses it', async () => {
    const siteverify = acceptingSiteverify();
    const { workerEnv } = guarded();
    await expectRefused(await publicLink({ workerEnv, email: freshAddress(), turnstileToken: TURNSTILE_DUMMY_TOKEN }));
    expect(siteverify).toHaveBeenCalledTimes(1);
  });
});

describe('the Turnstile token on POST /owner/sessions with the email provider', () => {
  beforeEach(() => {
    acceptingSiteverify();
  });

  test('a solved token signs in with the link', async () => {
    const link = await askedLink();
    const { workerEnv } = guarded();
    expect((await redeemLink({ ...link, workerEnv, turnstileToken: SIGN_IN_TOKEN })).status).toBe(CREATED_STATUS);
  });

  test('a missing token answers 400 invalid_request and leaves the link unspent', async () => {
    const link = await askedLink();
    const { workerEnv } = guarded();
    const response = await serveOwnerCall({
      call: {
        method: 'POST',
        path: SESSIONS_PATH,
        body: { identity_token: link.token, link_verifier: link.verifier, time_zone: 'UTC' },
        headers: { [CLIENT_ADDRESS_HEADER]: CLIENT_ADDRESS },
      },
      now: CLOCK_NOW,
      workerEnv,
    });
    await expectInvalid(response);
    expect((await redeemLink({ ...link, workerEnv, turnstileToken: SIGN_IN_TOKEN })).status).toBe(CREATED_STATUS);
  });

  test.each(MALFORMED_TOKENS)('%s answers 400 invalid_request', async (_name, turnstileToken) => {
    const link = await askedLink();
    await expectInvalid(await redeemLink({ ...link, workerEnv: guarded().workerEnv, turnstileToken }));
  });

  test.each([
    ['an unsolved token', 'never.solved.token'],
    ['a token solved for requesting a link', REQUEST_LINK_TOKEN],
  ])('%s answers 429 sign_in_refused and leaves the link unspent', async (_name, turnstileToken) => {
    const link = await askedLink();
    const { workerEnv } = guarded();
    await expectRefused(await redeemLink({ ...link, workerEnv, turnstileToken }));
    expect((await linkRows(link.email)).map((row) => row.consumed_at)).toEqual([null]);
    expect((await redeemLink({ ...link, workerEnv, turnstileToken: SIGN_IN_TOKEN })).status).toBe(CREATED_STATUS);
  });

  test('a refused token never reaches the global cap', async () => {
    const global = recordingLimiter({ isAllowed: true });
    const link = await askedLink();
    const { workerEnv } = guarded({ SIGN_IN_GLOBAL_LIMITER: global.limiter });
    await expectRefused(await redeemLink({ ...link, workerEnv, turnstileToken: 'never.solved.token' }));
    expect(global.keys).toEqual([]);
  });

  test('siteverify down answers 503 sign_in_unavailable and leaves the link unspent', async () => {
    siteverifyAnswering(() => Promise.reject(new TypeError('network down')));
    const link = await askedLink();
    const { workerEnv } = guarded();
    await expectUnavailable(await redeemLink({ ...link, workerEnv, turnstileToken: SIGN_IN_TOKEN }));
    expect((await linkRows(link.email)).map((row) => row.consumed_at)).toEqual([null]);
  });

  test('over the global cap answers 429 and leaves the link unspent', async () => {
    const link = await askedLink();
    const { workerEnv } = guarded({ SIGN_IN_GLOBAL_LIMITER: recordingLimiter({ isAllowed: false }).limiter });
    await expectRefused(await redeemLink({ ...link, workerEnv, turnstileToken: SIGN_IN_TOKEN }));
    expect((await linkRows(link.email)).map((row) => row.consumed_at)).toEqual([null]);
  });

  test.each([
    ['no secret', { TURNSTILE_SECRET_KEY: undefined }],
    ['no public origin', { PUBLIC_ORIGIN: undefined }],
    ['an invalid public origin', { PUBLIC_ORIGIN: 'https://todz.app/' }],
  ])('%s answers 503 sign_in_unavailable before the body and leaves the link unspent', async (_name, settings) => {
    const link = await askedLink();
    const { workerEnv } = guarded(settings);
    const raw = await serveOwnerCall({
      call: { method: 'POST', path: SESSIONS_PATH, rawBody: 'not json', headers: { [CLIENT_ADDRESS_HEADER]: CLIENT_ADDRESS } },
      now: CLOCK_NOW,
      workerEnv,
    });
    await expectUnavailable(raw);
    await expectUnavailable(await redeemLink({ ...link, workerEnv, turnstileToken: SIGN_IN_TOKEN }));
    expect((await linkRows(link.email)).map((row) => row.consumed_at)).toEqual([null]);
  });
});

describe('POST /owner/sessions with the fake provider', () => {
  test('needs no token and calls no siteverify', async () => {
    const siteverify = vi.spyOn(globalThis, 'fetch');
    const response = await serveOwnerCall({ call: signInCall({ identityToken: crypto.randomUUID(), timeZone: 'UTC' }), now: CLOCK_NOW });
    expect(response.status).toBe(CREATED_STATUS);
    expect(siteverify).not.toHaveBeenCalled();
  });
});

describe('what the guard writes to the log', () => {
  test('no console line carries the address, the link token or either Turnstile token', async () => {
    acceptingSiteverify();
    const lines = CONSOLE_METHODS.map((method) => vi.spyOn(console, method).mockImplementation(() => undefined));
    const { workerEnv, sent } = guarded();
    const email = freshAddress();
    expect((await publicLink({ workerEnv, email, turnstileToken: REQUEST_LINK_TOKEN })).status).toBe(ACCEPTED_STATUS);
    const token = tokenOfMail(messageSent(sent));
    await expectRefused(await publicLink({ workerEnv, email, turnstileToken: SIGN_IN_TOKEN }));
    const refused = await redeemLink({ token, verifier: generateCredentialSecret(), workerEnv, turnstileToken: REQUEST_LINK_TOKEN });
    expect(refused.status).toBe(TOO_MANY_STATUS);
    const logged = lines.flatMap((spy) => spy.mock.calls.map((call) => JSON.stringify(call))).join('\n');
    [email, token, REQUEST_LINK_TOKEN, SIGN_IN_TOKEN].forEach((secret) => expect(logged).not.toContain(secret));
  });
});
