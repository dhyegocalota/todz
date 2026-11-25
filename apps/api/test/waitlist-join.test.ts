import { createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { env } from 'cloudflare:workers';
import { MILLISECONDS_PER_HOUR, MILLISECONDS_PER_SECOND, WAITLIST_DAILY_JOINS_MAX, WAITLIST_MINIMUM_FILL_MS } from '@todz/types';
import { afterEach, beforeEach, describe, expect, onTestFinished, test, vi } from 'vitest';
import { digestCredential } from '../src/credential-digest';
import { waitlistMail } from '../src/emails/waitlist-mail';
import type { Env } from '../src/env';
import { LandingNotice, serveLandingPage } from '../src/site/landing-page';
import { serveWaitlistJoin } from '../src/site/waitlist-join';
import { TURNSTILE_DUMMY_TOKEN, TurnstileAction } from '../src/turnstile';
import {
  CLIENT_ADDRESS_HEADER,
  type RecordingBinding,
  TURNSTILE_TEST_SECRET,
  TURNSTILE_TOKEN_OF_ACTION,
  type SentMessage,
  acceptingSiteverify,
  bindingFailingWith,
  freshAddress,
  recordingBinding,
} from './email-sign-in-client';
import { workerEnvWith } from './owner-client';
import {
  JSON_ACCEPT,
  LimiterBinding,
  type WaitlistRow,
  deleteSeededJoins,
  joinStampOf,
  recordedLimiters,
  seedJoins,
  throwingLimiter,
  waitlistRows,
  withoutStamps,
} from './waitlist-client';

const SITE_ORIGIN = 'https://todz.app';
const SITE_HOSTNAME = 'todz.app';
const API_HOSTNAME = 'api.todz.app';
const API_ORIGIN = `https://${API_HOSTNAME}`;
const LOCAL_SITE_ORIGIN = 'http://localhost:8788';
const LOCAL_API_ORIGIN = 'http://localhost:8787';
const JOIN_PATH = '/join';
const SITE_KEY = '1x00000000000000000000AA';
const UNUSABLE_SITE_KEY = 'not a site key';
const CLIENT_ADDRESS = '203.0.113.9';
const EMAIL_FIELD = 'email';
const TOKEN_FIELD = 'cf-turnstile-response';
const STAMP_FIELD = 'stamp';
const HONEYPOT_FIELD = 'todz_fax';
const HONEYPOT_VALUE = 'https://spam.example';
const FIXED_NOW = 1_790_000_000_000;
const STAMP_AGE_PATIENT_MS = 2_500;
const OTHER_SECRET = '2x0000000000000000000000000000000BB';
const ACCEPT_HEADER = 'Accept';
const VARY_HEADER = 'Vary';
const HEADER_CONTENT_TYPE = 'Content-Type';
const HEADER_CACHE_CONTROL = 'Cache-Control';
const HEADER_CONTENT_TYPE_OPTIONS = 'X-Content-Type-Options';
const NO_STORE = 'no-store';
const NO_SNIFF = 'nosniff';
const JSON_CONTENT_TYPE = 'application/json';
const BAD_REQUEST_STATUS = 400;
const FORBIDDEN_STATUS = 403;
const FORM_CONTENT_TYPE = 'application/x-www-form-urlencoded';
const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const WAITLIST_TOKEN = TURNSTILE_TOKEN_OF_ACTION[TurnstileAction.Waitlist];
const REQUEST_LINK_TOKEN = TURNSTILE_TOKEN_OF_ACTION[TurnstileAction.RequestLink];
const BODY_LENGTH_MAX = 4096;
const OVERSIZED_BODY_LENGTH = 5 * 1024;
const TOKEN_LENGTH_MAX = 2048;
const OK_STATUS = 200;
const TOO_MANY_STATUS = 429;
const UNAVAILABLE_STATUS = 503;
const RETRY_AFTER_HEADER = 'Retry-After';
const RETRY_AFTER_SECONDS = '60';
const CONSOLE_METHODS = ['log', 'error', 'warn', 'info', 'debug'] as const;
const PUBLIC_SETTINGS: Partial<Env> = {
  SITE_ORIGIN,
  PUBLIC_ORIGIN: API_ORIGIN,
  EMAIL_SENDER: 'cloudflare',
  TURNSTILE_SITE_KEY: SITE_KEY,
  TURNSTILE_SECRET_KEY: TURNSTILE_TEST_SECRET,
};
const LOCAL_SETTINGS: Partial<Env> = {
  SITE_ORIGIN: LOCAL_SITE_ORIGIN,
  PUBLIC_ORIGIN: LOCAL_API_ORIGIN,
  EMAIL_SENDER: 'console',
  TURNSTILE_SITE_KEY: SITE_KEY,
  TURNSTILE_SECRET_KEY: TURNSTILE_TEST_SECRET,
  [LimiterBinding.Client]: undefined,
  [LimiterBinding.Address]: undefined,
  [LimiterBinding.Global]: undefined,
};

type JoinCall = {
  email?: string;
  token?: string | null;
  stamp?: string | null;
  website?: string | null;
  accept?: string;
  body?: string;
  contentType?: string;
  contentLength?: string | null;
  clientAddress?: string | null;
  origin?: string;
  settings?: Partial<Env>;
  refusing?: LimiterBinding[];
  recording?: RecordingBinding;
};

type JoinRun = {
  response: Response;
  html: string;
  request: Request;
  sent: SentMessage[];
  keys: Record<LimiterBinding, string[]>;
  siteverifyBodies: Record<string, string>[];
};

function formBody({
  email,
  token,
  stamp,
  website,
}: {
  email: string;
  token: string | null;
  stamp: string | null;
  website: string | null;
}): string {
  const fields = new URLSearchParams({ [EMAIL_FIELD]: email });
  if (token !== null) fields.set(TOKEN_FIELD, token);
  if (stamp !== null) fields.set(STAMP_FIELD, stamp);
  if (website !== null) fields.set(HONEYPOT_FIELD, website);
  return fields.toString();
}

function joinHeaders({
  body,
  contentType,
  contentLength,
  clientAddress,
  accept,
}: {
  body: string;
  contentType: string;
  contentLength: string | null | undefined;
  clientAddress: string | null;
  accept: string | undefined;
}): Headers {
  const headers = new Headers({ 'Content-Type': contentType });
  if (accept !== undefined) headers.set(ACCEPT_HEADER, accept);
  const length = contentLength === undefined ? String(new TextEncoder().encode(body).length) : contentLength;
  if (length !== null) headers.set('Content-Length', length);
  if (clientAddress !== null) headers.set(CLIENT_ADDRESS_HEADER, clientAddress);
  return headers;
}

function siteverifyCalls(): Parameters<typeof fetch>[] {
  return vi.mocked(globalThis.fetch).mock.calls;
}

async function join({
  email = freshAddress(),
  token = WAITLIST_TOKEN,
  stamp,
  website = null,
  accept,
  body,
  contentType = FORM_CONTENT_TYPE,
  contentLength,
  clientAddress = CLIENT_ADDRESS,
  origin = SITE_ORIGIN,
  settings = {},
  refusing = [],
  recording = recordingBinding(),
}: JoinCall = {}): Promise<JoinRun> {
  const { limiters, keys } = recordedLimiters({ refusing });
  const workerEnv = workerEnvWith({ ...PUBLIC_SETTINGS, EMAIL: recording.binding, ...limiters, ...settings });
  const stampField = stamp === undefined ? await joinStampOf() : stamp;
  const bodyText = body === undefined ? formBody({ email, token, stamp: stampField, website }) : body;
  const headers = joinHeaders({ body: bodyText, contentType, contentLength, clientAddress, accept });
  const request = new Request(`${origin}${JOIN_PATH}`, { method: 'POST', headers, body: bodyText });
  const siteverifyCallsBefore = siteverifyCalls().length;
  const executionContext = createExecutionContext();
  const response = await serveWaitlistJoin({ request, env: workerEnv, executionContext });
  const html = withoutStamps(await response.text());
  await waitOnExecutionContext(executionContext);
  const siteverifyBodies = siteverifyCalls()
    .slice(siteverifyCallsBefore)
    .map(([, init]) => Object.fromEntries(new URLSearchParams(String(init?.body))));
  return { response, html, request, sent: recording.sent, keys, siteverifyBodies };
}

async function landingHtml({ notice, siteKey }: { notice: LandingNotice; siteKey: string | null }): Promise<string> {
  const page = await serveLandingPage({ notice, challenge: siteKey === null ? null : { siteKey, stampSecret: TURNSTILE_TEST_SECRET } });
  return withoutStamps(await page.text());
}

function siteverifyAnswering(answer: () => Promise<Response>): void {
  vi.spyOn(globalThis, 'fetch').mockImplementation(answer);
}

function failingDirectory(): D1Database {
  return new Proxy(env.DIRECTORY, {
    get(target, property) {
      if (property === 'prepare') {
        return () => {
          throw new Error('the directory is down');
        };
      }
      return Reflect.get(target, property);
    },
  });
}

async function expectJoined(run: JoinRun): Promise<void> {
  expect(run.response.status).toBe(OK_STATUS);
  expect(run.response.headers.get(RETRY_AFTER_HEADER)).toBeNull();
  expect(run.response.headers.get(VARY_HEADER)).toBe(ACCEPT_HEADER);
  expect(run.html).toBe(await landingHtml({ notice: LandingNotice.Joined, siteKey: SITE_KEY }));
}

async function expectTryAgain(run: JoinRun): Promise<void> {
  expect(run.response.status).toBe(TOO_MANY_STATUS);
  expect(run.response.headers.get(RETRY_AFTER_HEADER)).toBe(RETRY_AFTER_SECONDS);
  expect(run.response.headers.get(VARY_HEADER)).toBe(ACCEPT_HEADER);
  expect(run.html).toBe(await landingHtml({ notice: LandingNotice.TryAgain, siteKey: SITE_KEY }));
}

async function expectOpensSoon({ run, siteKey = SITE_KEY }: { run: JoinRun; siteKey?: string | null }): Promise<void> {
  expect(run.response.status).toBe(UNAVAILABLE_STATUS);
  expect(run.response.headers.get(VARY_HEADER)).toBe(ACCEPT_HEADER);
  expect(run.html).toBe(await landingHtml({ notice: LandingNotice.OpensSoon, siteKey }));
}

function joinJson(call: JoinCall = {}): Promise<JoinRun> {
  return join({ ...call, accept: JSON_ACCEPT });
}

function expectOutcome({ run, status, outcome }: { run: JoinRun; status: number; outcome: string }): void {
  expect(run.response.status).toBe(status);
  expect(run.response.headers.get(HEADER_CONTENT_TYPE)).toBe(JSON_CONTENT_TYPE);
  expect(run.response.headers.get(HEADER_CACHE_CONTROL)).toBe(NO_STORE);
  expect(run.response.headers.get(HEADER_CONTENT_TYPE_OPTIONS)).toBe(NO_SNIFF);
  expect(run.response.headers.get(VARY_HEADER)).toBe(ACCEPT_HEADER);
  expect(run.html).toBe(JSON.stringify({ outcome }));
}

async function expectNothingKept({ run, address }: { run: JoinRun; address: string }): Promise<void> {
  expect(await waitlistRows(address)).toEqual([]);
  expect(run.sent).toEqual([]);
}

async function expectUntouched({ run, address }: { run: JoinRun; address: string }): Promise<void> {
  await expectNothingKept({ run, address });
  expect(run.request.bodyUsed).toBe(false);
  expect(Object.values(run.keys).flat()).toEqual([]);
  expect(run.siteverifyBodies).toEqual([]);
}

function onlyRow(rows: WaitlistRow[]): WaitlistRow {
  const [row, ...others] = rows;
  if (row === undefined || others.length > 0) throw new Error('exactly one waitlist row should exist');
  return row;
}

beforeEach(() => {
  acceptingSiteverify();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('a join on a public site host', () => {
  test('a solved join keeps the normalized address, mails it once and answers 200 with the joined landing', async () => {
    const address = freshAddress();
    const joinedFrom = Date.now();
    const run = await join({ email: `  ${address.toUpperCase()} ` });
    await expectJoined(run);
    const row = onlyRow(await waitlistRows(address));
    expect(row.joined_at).toBeGreaterThanOrEqual(joinedFrom);
    expect(row).toEqual({ address, joined_at: row.joined_at, confirmation_claimed_at: row.joined_at, confirmation_failed_at: null });
    expect(run.sent).toHaveLength(1);
    expect(run.sent[0]).toMatchObject(waitlistMail({ to: address, origin: SITE_ORIGIN }));
  });

  test('siteverify gets the secret and the token, once', async () => {
    const run = await join();
    expect(run.siteverifyBodies).toEqual([{ secret: TURNSTILE_TEST_SECRET, response: WAITLIST_TOKEN }]);
    expect(String(siteverifyCalls().at(-1)?.[0])).toBe(SITEVERIFY_URL);
  });

  test('a second join of the address answers the same page and sends no second mail', async () => {
    const address = freshAddress();
    const first = await join({ email: address });
    const second = await join({ email: address });
    await expectJoined(second);
    expect(second.html).toBe(first.html);
    expect(second.sent).toEqual([]);
    expect(await waitlistRows(address)).toHaveLength(1);
  });

  test('two concurrent joins of one address keep one row and send one mail', async () => {
    const address = freshAddress();
    const recording = recordingBinding();
    const runs = await Promise.all([join({ email: address, recording }), join({ email: address, recording })]);
    await Promise.all(runs.map(expectJoined));
    expect(recording.sent).toHaveLength(1);
    expect(await waitlistRows(address)).toHaveLength(1);
  });

  test('the client is keyed by the join path and its address, the address by its digest and the cap by the join path', async () => {
    const address = freshAddress();
    const run = await join({ email: address });
    expect(run.keys).toEqual({
      [LimiterBinding.Client]: [`${JOIN_PATH}:${CLIENT_ADDRESS}`],
      [LimiterBinding.Address]: [`${JOIN_PATH}:${await digestCredential(address)}`],
      [LimiterBinding.Global]: [JOIN_PATH],
    });
  });

  test('Maria@X.COM and maria@x.com count against one per-address limit', async () => {
    const local = crypto.randomUUID();
    const upper = await join({ email: `Maria.${local}@X.COM` });
    const lower = await join({ email: `maria.${local}@x.com` });
    expect(upper.keys[LimiterBinding.Address]).toEqual(lower.keys[LimiterBinding.Address]);
    expect(upper.keys[LimiterBinding.Address]).toEqual([`${JOIN_PATH}:${await digestCredential(`maria.${local}@x.com`)}`]);
  });

  test('the answer never echoes the address', async () => {
    const address = freshAddress();
    const run = await join({ email: address });
    expect(run.html).not.toContain(address);
  });
});

describe('a join over the daily cap', () => {
  test('answers opens soon, keeps no row and sends no mail', async () => {
    const prefix = await seedJoins({ count: WAITLIST_DAILY_JOINS_MAX, joinedAt: Date.now() - MILLISECONDS_PER_HOUR });
    onTestFinished(() => deleteSeededJoins(prefix));
    const address = freshAddress();
    const run = await join({ email: address });
    await expectOpensSoon({ run });
    await expectNothingKept({ run, address });
  });

  test('answers a known address exactly as an unknown one and mails neither', async () => {
    const known = freshAddress();
    await expectJoined(await join({ email: known }));
    const prefix = await seedJoins({ count: WAITLIST_DAILY_JOINS_MAX, joinedAt: Date.now() - MILLISECONDS_PER_HOUR });
    onTestFinished(() => deleteSeededJoins(prefix));
    const knownRun = await join({ email: known });
    const unknownRun = await join({ email: freshAddress() });
    await expectOpensSoon({ run: knownRun });
    await expectOpensSoon({ run: unknownRun });
    expect(knownRun.html).toBe(unknownRun.html);
    expect([...knownRun.sent, ...unknownRun.sent]).toEqual([]);
  });
});

describe('a refused join answers try again, 429 with Retry-After 60, and keeps nothing', () => {
  test.each(Object.values(LimiterBinding))('a join over %s', async (binding) => {
    const address = freshAddress();
    const run = await join({ email: address, refusing: [binding] });
    await expectTryAgain(run);
    await expectNothingKept({ run, address });
  });

  test('a join over the client limit is refused before its body is read or siteverify is called', async () => {
    const address = freshAddress();
    const run = await join({ email: address, refusing: [LimiterBinding.Client] });
    await expectTryAgain(run);
    expect(run.request.bodyUsed).toBe(false);
    expect(run.siteverifyBodies).toEqual([]);
  });

  test('a join over the global cap never spends the slot of its address', async () => {
    const run = await join({ refusing: [LimiterBinding.Global] });
    await expectTryAgain(run);
    expect(run.keys[LimiterBinding.Global]).toEqual([JOIN_PATH]);
    expect(run.keys[LimiterBinding.Address]).toEqual([]);
  });

  test.each([
    ['siteverify refuses the token', { success: false, 'error-codes': ['invalid-input-response'] }],
    ['siteverify answers timeout-or-duplicate', { success: false, 'error-codes': ['timeout-or-duplicate'] }],
    ['the action differs', { success: true, hostname: SITE_HOSTNAME, action: TurnstileAction.RequestLink }],
    ['the hostname differs', { success: true, hostname: API_HOSTNAME, action: TurnstileAction.Waitlist }],
  ])('%s', async (_name, answer) => {
    siteverifyAnswering(async () => Response.json(answer));
    const address = freshAddress();
    const run = await join({ email: address });
    await expectTryAgain(run);
    expect(run.siteverifyBodies).toHaveLength(1);
    await expectNothingKept({ run, address });
  });

  test('a token solved for another action', async () => {
    const address = freshAddress();
    const run = await join({ email: address, token: REQUEST_LINK_TOKEN });
    await expectTryAgain(run);
    await expectNothingKept({ run, address });
  });

  test.each([
    ['an empty token', ''],
    ['a token over 2048 characters', 'a'.repeat(TOKEN_LENGTH_MAX + 1)],
    ['a token with a space', 'a b'],
    ['no token', null],
  ])('%s, without calling siteverify', async (_name, token) => {
    const address = freshAddress();
    const run = await join({ email: address, token });
    await expectTryAgain(run);
    expect(run.siteverifyBodies).toEqual([]);
    await expectNothingKept({ run, address });
  });

  test.each([
    ['a JSON body', 'application/json'],
    ['a plain text body', 'text/plain'],
    ['a multipart body', 'multipart/form-data; boundary=x'],
  ])('%s', async (_name, contentType) => {
    const address = freshAddress();
    const run = await join({ email: address, contentType });
    await expectTryAgain(run);
    await expectNothingKept({ run, address });
  });

  test('an urlencoded body with a charset is read', async () => {
    const run = await join({ contentType: `${FORM_CONTENT_TYPE}; charset=UTF-8` });
    await expectJoined(run);
  });

  test('no Content-Length, before the body is read', async () => {
    const address = freshAddress();
    const run = await join({ email: address, contentLength: null });
    await expectTryAgain(run);
    expect(run.request.bodyUsed).toBe(false);
    await expectNothingKept({ run, address });
  });

  test('a body of 5 KB, before it is read', async () => {
    const address = freshAddress();
    const body = `${formBody({ email: address, token: WAITLIST_TOKEN, stamp: await joinStampOf(), website: null })}&padding=${'a'.repeat(OVERSIZED_BODY_LENGTH)}`;
    const run = await join({ email: address, body });
    await expectTryAgain(run);
    expect(run.request.bodyUsed).toBe(false);
    await expectNothingKept({ run, address });
  });

  test('a body of exactly 4096 bytes is read', async () => {
    const address = freshAddress();
    const form = formBody({ email: address, token: WAITLIST_TOKEN, stamp: await joinStampOf(), website: null });
    const padding = '&padding=';
    const body = `${form}${padding}${'a'.repeat(BODY_LENGTH_MAX - form.length - padding.length)}`;
    expect(body).toHaveLength(BODY_LENGTH_MAX);
    await expectJoined(await join({ email: address, body }));
  });

  test('a Content-Length that is not a number', async () => {
    const address = freshAddress();
    const run = await join({ email: address, contentLength: 'many' });
    await expectTryAgain(run);
    await expectNothingKept({ run, address });
  });

  test('no address', async () => {
    const run = await join({ body: new URLSearchParams({ [TOKEN_FIELD]: WAITLIST_TOKEN }).toString() });
    await expectTryAgain(run);
    expect(run.sent).toEqual([]);
  });

  test.each([['a@b'], ['a b@c.d'], ['a@b.c\r\nBcc:x@y.z'], ['https://a.bc/x?@a.bc']])('the address %j', async (email) => {
    const run = await join({ email });
    await expectTryAgain(run);
    expect(run.siteverifyBodies).toEqual([]);
    expect(run.sent).toEqual([]);
    expect(await waitlistRows(email.toLowerCase())).toEqual([]);
  });

  test.each([['x@todz.app'], ['X@TODZ.APP'], ['reply+abc@todz.app'], ['hello+1@todz.app']])('the own domain address %j', async (email) => {
    const run = await join({ email });
    await expectJoined(run);
    expect(run.sent).toEqual([]);
    expect(await waitlistRows(email.toLowerCase())).toEqual([]);
  });

  test('an address on a domain that only starts with the own domain joins as before', async () => {
    const address = `${crypto.randomUUID()}@todz.app.example`;
    const run = await join({ email: address });
    await expectJoined(run);
    expect(await waitlistRows(address)).toHaveLength(1);
  });

  test('a directory that fails sends nothing', async () => {
    const address = freshAddress();
    const run = await join({ email: address, settings: { DIRECTORY: failingDirectory() } });
    await expectTryAgain(run);
    await expectNothingKept({ run, address });
  });

  test('a public SITE_ORIGIN with a local PUBLIC_ORIGIN still asks siteverify about the dummy token', async () => {
    const address = freshAddress();
    const run = await join({ email: address, token: TURNSTILE_DUMMY_TOKEN, settings: { PUBLIC_ORIGIN: LOCAL_API_ORIGIN } });
    await expectTryAgain(run);
    expect(run.siteverifyBodies).toEqual([{ secret: TURNSTILE_TEST_SECRET, response: TURNSTILE_DUMMY_TOKEN }]);
    await expectNothingKept({ run, address });
  });
});

describe('an unguarded waitlist answers opens soon, 503, reads no body and keeps nothing', () => {
  test.each([
    ['no SITE_ORIGIN', { SITE_ORIGIN: undefined }, SITE_KEY],
    ['a plain http SITE_ORIGIN on a public host', { SITE_ORIGIN: 'http://todz.app' }, SITE_KEY],
    ['no site key', { TURNSTILE_SITE_KEY: undefined }, null],
    ['an unusable site key', { TURNSTILE_SITE_KEY: UNUSABLE_SITE_KEY }, null],
    ['a site key without a secret', { TURNSTILE_SECRET_KEY: undefined }, null],
    ['a secret without a site key', { TURNSTILE_SITE_KEY: undefined, TURNSTILE_SECRET_KEY: TURNSTILE_TEST_SECRET }, null],
    ['no mail sender', { EMAIL_SENDER: undefined }, SITE_KEY],
    ['the Cloudflare sender without its binding', { EMAIL: undefined }, SITE_KEY],
    ['the console sender on a public host', { EMAIL_SENDER: 'console' }, SITE_KEY],
    ['no WAITLIST_LIMITER', { [LimiterBinding.Client]: undefined }, SITE_KEY],
    ['no WAITLIST_ADDRESS_LIMITER', { [LimiterBinding.Address]: undefined }, SITE_KEY],
    ['no WAITLIST_GLOBAL_LIMITER', { [LimiterBinding.Global]: undefined }, SITE_KEY],
  ])('%s', async (_name, settings, siteKey) => {
    const address = freshAddress();
    const run = await join({ email: address, settings });
    await expectOpensSoon({ run, siteKey });
    await expectUntouched({ run, address });
  });

  test('no client address', async () => {
    const address = freshAddress();
    const run = await join({ email: address, clientAddress: null });
    await expectOpensSoon({ run });
    await expectUntouched({ run, address });
  });

  test.each(Object.values(LimiterBinding))('a %s that throws', async (binding) => {
    const address = freshAddress();
    const run = await join({ email: address, settings: { [binding]: throwingLimiter() } });
    await expectOpensSoon({ run });
    await expectNothingKept({ run, address });
  });

  test.each([
    ['siteverify times out', () => Promise.reject(new DOMException('The operation timed out.', 'TimeoutError'))],
    ['siteverify answers 500', async () => new Response(null, { status: 500 })],
    ['siteverify answers invalid-input-secret', async () => Response.json({ success: false, 'error-codes': ['invalid-input-secret'] })],
  ])('%s', async (_name, answer) => {
    siteverifyAnswering(answer);
    const address = freshAddress();
    const run = await join({ email: address });
    await expectOpensSoon({ run });
    await expectNothingKept({ run, address });
  });
});

describe('which Accept header asks for JSON', () => {
  test.each([
    ['application/json', true],
    ['Application/JSON', true],
    ['text/html, application/json;q=0.9', true],
    ['application/json;q=0', false],
    ['application/json; q=0.0', false],
    ['application/json;q=0.000', false],
    ['*/*', false],
    ['text/html', false],
    ['application/jsonp', false],
  ])('%s', async (accept, isJson) => {
    const run = await join({ accept });
    expect(run.response.headers.get(HEADER_CONTENT_TYPE) === JSON_CONTENT_TYPE).toBe(isJson);
  });
});

describe('a JSON join answers an outcome and never the address', () => {
  test('a new address answers joined, keeps the row and mails once', async () => {
    const address = freshAddress();
    const run = await joinJson({ email: address });
    expectOutcome({ run, status: OK_STATUS, outcome: 'joined' });
    expect(await waitlistRows(address)).toHaveLength(1);
    expect(run.sent).toHaveLength(1);
  });

  test('the same address again answers the same and sends no second mail', async () => {
    const address = freshAddress();
    const first = await joinJson({ email: address });
    const second = await joinJson({ email: address });
    expectOutcome({ run: second, status: OK_STATUS, outcome: 'joined' });
    expect(second.html).toBe(first.html);
    expect(second.sent).toEqual([]);
  });

  test.each([
    ['a text body', { contentType: 'text/plain' }],
    ['an address that does not normalise', { email: 'not-an-address' }],
  ])('%s answers invalid, 400', async (_name, call) => {
    const run = await joinJson(call);
    expectOutcome({ run, status: BAD_REQUEST_STATUS, outcome: 'invalid' });
  });

  test.each([
    ['no token', { token: null }],
    ['a token with a space and a bang', { token: 'bad token!' }],
  ])('%s answers check-failed, 403, without calling siteverify', async (_name, call) => {
    const address = freshAddress();
    const run = await joinJson({ email: address, ...call });
    expectOutcome({ run, status: FORBIDDEN_STATUS, outcome: 'check-failed' });
    expect(run.siteverifyBodies).toEqual([]);
    await expectNothingKept({ run, address });
  });

  test('a refusing siteverify answers check-failed, 403', async () => {
    siteverifyAnswering(async () => Response.json({ success: false, 'error-codes': ['invalid-input-response'] }));
    const address = freshAddress();
    const run = await joinJson({ email: address });
    expectOutcome({ run, status: FORBIDDEN_STATUS, outcome: 'check-failed' });
    await expectNothingKept({ run, address });
  });

  test('an unreachable siteverify answers opens-soon, 503', async () => {
    siteverifyAnswering(() => Promise.reject(new DOMException('The operation timed out.', 'TimeoutError')));
    const run = await joinJson();
    expectOutcome({ run, status: UNAVAILABLE_STATUS, outcome: 'opens-soon' });
  });

  test.each(Object.values(LimiterBinding))('a join over %s answers try-again, 429, Retry-After 60', async (binding) => {
    const address = freshAddress();
    const run = await joinJson({ email: address, refusing: [binding] });
    expectOutcome({ run, status: TOO_MANY_STATUS, outcome: 'try-again' });
    expect(run.response.headers.get(RETRY_AFTER_HEADER)).toBe(RETRY_AFTER_SECONDS);
    await expectNothingKept({ run, address });
  });

  test.each([
    ['no limiter', { [LimiterBinding.Client]: undefined }],
    ['no site key', { TURNSTILE_SITE_KEY: undefined }],
    ['no secret', { TURNSTILE_SECRET_KEY: undefined }],
  ])('%s answers opens-soon, 503, and reads no body', async (_name, settings) => {
    const address = freshAddress();
    const run = await joinJson({ email: address, settings });
    expectOutcome({ run, status: UNAVAILABLE_STATUS, outcome: 'opens-soon' });
    await expectUntouched({ run, address });
  });

  test('no client address answers opens-soon, 503, and reads no body', async () => {
    const address = freshAddress();
    const run = await joinJson({ email: address, clientAddress: null });
    expectOutcome({ run, status: UNAVAILABLE_STATUS, outcome: 'opens-soon' });
    await expectUntouched({ run, address });
  });

  test('a failing store answers try-again, 429', async () => {
    const address = freshAddress();
    const run = await joinJson({ email: address, settings: { DIRECTORY: failingDirectory() } });
    expectOutcome({ run, status: TOO_MANY_STATUS, outcome: 'try-again' });
    await expectNothingKept({ run, address });
  });

  test('no answer body contains the address', async () => {
    const address = freshAddress();
    const runs = await Promise.all([joinJson({ email: address }), joinJson({ email: address, token: null })]);
    expect(runs.map((run) => run.html.includes(address))).toEqual([false, false]);
  });
});

describe("a bot's join answers joined and keeps nothing", () => {
  async function expectSilentlyJoined({ run, address }: { run: JoinRun; address: string }): Promise<void> {
    await expectNothingKept({ run, address });
    expect(run.siteverifyBodies).toHaveLength(1);
  }

  test.each([
    ['JSON', JSON_ACCEPT],
    ['HTML', undefined],
  ])('a filled honeypot with a valid stamp and token, asked as %s', async (_name, accept) => {
    const address = freshAddress();
    const run = await join({ email: address, website: HONEYPOT_VALUE, accept });
    if (accept === undefined) await expectJoined(run);
    if (accept !== undefined) expectOutcome({ run, status: OK_STATUS, outcome: 'joined' });
    await expectSilentlyJoined({ run, address });
  });

  test('an empty honeypot is a normal join', async () => {
    const address = freshAddress();
    const run = await joinJson({ email: address, website: '' });
    expectOutcome({ run, status: OK_STATUS, outcome: 'joined' });
    expect(await waitlistRows(address)).toHaveLength(1);
    expect(run.sent).toHaveLength(1);
  });

  test('no stamp answers check-failed, 403, and keeps nothing', async () => {
    const address = freshAddress();
    const run = await joinJson({ email: address, stamp: null });
    expectOutcome({ run, status: FORBIDDEN_STATUS, outcome: 'check-failed' });
    await expectNothingKept({ run, address });
  });

  test('no stamp on the HTML post answers try again, 429', async () => {
    const address = freshAddress();
    const run = await join({ email: address, stamp: null });
    await expectTryAgain(run);
    await expectNothingKept({ run, address });
  });

  test('a stamp signed with another secret answers joined and keeps nothing', async () => {
    const address = freshAddress();
    const run = await joinJson({ email: address, stamp: await joinStampOf({ secret: OTHER_SECRET }) });
    expectOutcome({ run, status: OK_STATUS, outcome: 'joined' });
    await expectSilentlyJoined({ run, address });
  });

  test.each([
    ['rendered 1 000 ms ago', MILLISECONDS_PER_SECOND],
    ['rendered one second in the future', -MILLISECONDS_PER_SECOND],
  ])('a stamp %s answers joined and keeps nothing', async (_name, ageMs) => {
    vi.spyOn(Date, 'now').mockReturnValue(FIXED_NOW);
    const address = freshAddress();
    const run = await joinJson({ email: address, stamp: await joinStampOf({ renderedAt: FIXED_NOW - ageMs }) });
    expectOutcome({ run, status: OK_STATUS, outcome: 'joined' });
    await expectSilentlyJoined({ run, address });
  });

  test('a stamp rendered 2 500 ms ago is stored and mailed once', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(FIXED_NOW);
    const address = freshAddress();
    const run = await joinJson({ email: address, stamp: await joinStampOf({ renderedAt: FIXED_NOW - STAMP_AGE_PATIENT_MS }) });
    expectOutcome({ run, status: OK_STATUS, outcome: 'joined' });
    expect(await waitlistRows(address)).toHaveLength(1);
    expect(run.sent).toHaveLength(1);
  });

  test.each([
    ['a filled honeypot', HONEYPOT_VALUE, TURNSTILE_TEST_SECRET],
    ['a stamp signed with another secret', '', OTHER_SECRET],
  ])('%s with a token siteverify refuses answers check-failed, 403', async (_name, website, secret) => {
    siteverifyAnswering(async () => Response.json({ success: false, 'error-codes': ['invalid-input-response'] }));
    const address = freshAddress();
    const stamp = await joinStampOf({ secret });
    const run = await joinJson({ email: address, website, stamp });
    expectOutcome({ run, status: FORBIDDEN_STATUS, outcome: 'check-failed' });
    expect(run.siteverifyBodies).toHaveLength(1);
    await expectNothingKept({ run, address });
  });

  test.each(Object.values(LimiterBinding))('a filled honeypot over %s answers try again, 429, like a real join', async (binding) => {
    const address = freshAddress();
    const run = await joinJson({ email: address, website: HONEYPOT_VALUE, refusing: [binding] });
    expectOutcome({ run, status: TOO_MANY_STATUS, outcome: 'try-again' });
    await expectNothingKept({ run, address });
  });

  test('a stamp that is too young over the address limit answers try again, 429', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(FIXED_NOW);
    const run = await joinJson({
      stamp: await joinStampOf({ renderedAt: FIXED_NOW - MILLISECONDS_PER_SECOND }),
      refusing: [LimiterBinding.Address],
    });
    expectOutcome({ run, status: TOO_MANY_STATUS, outcome: 'try-again' });
  });

  test('a filled honeypot still spends a slot of the client limit', async () => {
    const run = await joinJson({ website: HONEYPOT_VALUE });
    expect(run.keys[LimiterBinding.Client]).toEqual([`${JOIN_PATH}:${CLIENT_ADDRESS}`]);
  });

  test('a honeypot with no token answers check-failed, 403: the token check comes first', async () => {
    const address = freshAddress();
    const run = await joinJson({ email: address, website: HONEYPOT_VALUE, token: null });
    expectOutcome({ run, status: FORBIDDEN_STATUS, outcome: 'check-failed' });
    await expectNothingKept({ run, address });
  });
});

describe('the confirmation mail', () => {
  test('a mail that fails still answers joined, records the failure and logs nothing', async () => {
    const consoles = CONSOLE_METHODS.map((method) => vi.spyOn(console, method).mockImplementation(() => undefined));
    const address = freshAddress();
    const recording = { binding: bindingFailingWith(new Error(`refused ${address}`)), sent: [] };
    const run = await join({ email: address, recording });
    await expectJoined(run);
    const row = onlyRow(await waitlistRows(address));
    expect(row.confirmation_claimed_at).toBe(row.joined_at);
    expect(row.confirmation_failed_at).toBeGreaterThanOrEqual(row.joined_at);
    expect(consoles.flatMap((spy) => spy.mock.calls)).toEqual([]);
  });

  test('a failed mail is not retried by the next join of the address', async () => {
    const address = freshAddress();
    await join({ email: address, recording: { binding: bindingFailingWith(new Error('the mail is down')), sent: [] } });
    const retry = await join({ email: address });
    await expectJoined(retry);
    expect(retry.sent).toEqual([]);
  });
});

describe('a join on a local site host', () => {
  test('the dummy token joins without the bindings or the client address and mails through the console', async () => {
    const output = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const address = freshAddress();
    const run = await join({
      email: address,
      token: TURNSTILE_DUMMY_TOKEN,
      origin: LOCAL_SITE_ORIGIN,
      clientAddress: null,
      settings: LOCAL_SETTINGS,
    });
    await expectJoined(run);
    expect(run.siteverifyBodies).toEqual([]);
    expect(onlyRow(await waitlistRows(address)).address).toBe(address);
    expect(output.mock.calls.map(([line]) => JSON.parse(String(line)).to)).toEqual([address]);
  });

  test('a token that is not the dummy is still asked of siteverify', async () => {
    const address = freshAddress();
    const run = await join({ email: address, token: REQUEST_LINK_TOKEN, origin: LOCAL_SITE_ORIGIN, settings: LOCAL_SETTINGS });
    await expectTryAgain(run);
    expect(run.siteverifyBodies).toHaveLength(1);
    await expectNothingKept({ run, address });
  });
});
