import { createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { Language } from '@todz/types';
import { env } from 'cloudflare:workers';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { digestCredential } from '../src/credential-digest';
import { normalizedAddress } from '../src/email-address';
import type { Env } from '../src/env';
import { serveAdminSession, serveAdminSignInLink } from '../src/site/admin-sign-in';
import { AdminNotice } from '../src/site/admin-notice';
import { ADMIN_RESPONSE_HEADERS, AdminField, AdminPath } from '../src/site/admin-paths';
import { ADMIN_SESSION_LIFETIME_MS, ADMIN_SIGN_IN_LINK_LIFETIME_MS, AdminCookie, hasAdminSession } from '../src/site/admin-session';
import { adminSignInMail } from '../src/emails/admin-sign-in-mail';
import { serveAdminSignInPage } from '../src/site/admin-page';
import { TURNSTILE_DUMMY_TOKEN, TurnstileAction } from '../src/turnstile';
import { AdminLimiterBinding, adminLinkRows, adminSessionRows, recordedAdminLimiters, throwingLimiter } from './admin-client';
import {
  CLIENT_ADDRESS_HEADER,
  type RecordingBinding,
  TURNSTILE_TEST_SECRET,
  TURNSTILE_TOKEN_OF_ACTION,
  acceptingSiteverify,
  bindingFailingWith,
  consoleOutput,
  recordingBinding,
  sentMail,
} from './email-sign-in-client';
import { workerEnvWith } from './owner-client';

const SITE_ORIGIN = 'https://todz.app';
const SITE_HOSTNAME = 'todz.app';
const API_HOSTNAME = 'api.todz.app';
const API_ORIGIN = `https://${API_HOSTNAME}`;
const LOCAL_SITE_ORIGIN = 'http://localhost:8788';
const LOCAL_API_ORIGIN = 'http://localhost:8787';
const ADMIN_ADDRESS = 'hello@todz.app';
const OTHER_ADDRESS = 'maria@example.com';
const SITE_KEY = '1x00000000000000000000AA';
const UNUSABLE_SITE_KEY = 'not a site key';
const CLIENT_ADDRESS = '203.0.113.9';
const FORM_CONTENT_TYPE = 'application/x-www-form-urlencoded';
const JSON_CONTENT_TYPE = 'application/json';
const EMAIL_FIELD = 'email';
const TURNSTILE_FIELD = 'cf-turnstile-response';
const ADMIN_TOKEN = TURNSTILE_TOKEN_OF_ACTION[TurnstileAction.AdminSignIn];
const SIGN_IN_TOKEN = TURNSTILE_TOKEN_OF_ACTION[TurnstileAction.SignIn];
const BODY_LENGTH_MAX = 4096;
const OVERSIZED_BODY_LENGTH = 5 * 1024;
const OK_STATUS = 200;
const CREATED_STATUS = 201;
const UNAUTHORIZED_STATUS = 401;
const FORBIDDEN_STATUS = 403;
const TOO_MANY_STATUS = 429;
const UNAVAILABLE_STATUS = 503;
const RETRY_AFTER_HEADER = 'Retry-After';
const RETRY_AFTER_SECONDS = '60';
const SET_COOKIE_HEADER = 'Set-Cookie';
const LINK_PATTERN = /https:\/\/todz\.app\/admin\/sign-in#token=([A-Za-z0-9_-]{43})(?![A-Za-z0-9_-])/;
const HIDDEN_ADDRESS_PATTERN = /(name="email" value=")[^"]*/g;
const CODE_PATTERN = /(?:^|\s)([0-9]{6})(?:\s|$)/;
const LOCAL_LINK_PATTERN = /http:\/\/localhost:8788\/admin\/sign-in#token=([A-Za-z0-9_-]{43})/;
const COOKIE_VALUE_PATTERN = /^(__Host-[a-z_]+)=([A-Za-z0-9_-]*);/;
const CHALLENGE_COOKIE_PATTERN = /^__Host-todz_admin_challenge=[A-Za-z0-9_-]{43}; Path=\/; Secure; HttpOnly; SameSite=Lax; Max-Age=900$/;
const SESSION_COOKIE_PATTERN = /^__Host-todz_admin=[A-Za-z0-9_-]{43}; Path=\/; Secure; HttpOnly; SameSite=Lax; Max-Age=43200$/;
const CLEARED_CHALLENGE_COOKIE = '__Host-todz_admin_challenge=; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=0';
const HEXADECIMAL_DIGEST_PATTERN = /^[0-9a-f]{64}$/;
const ADMIN_URL = 'https://todz.app/admin';
const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const CONSOLE_METHODS = ['log', 'error', 'warn', 'info', 'debug'] as const;
const LINKS_PER_WINDOW_MAX = 5;
const PUBLIC_SETTINGS: Partial<Env> = {
  SITE_ORIGIN,
  PUBLIC_ORIGIN: API_ORIGIN,
  EMAIL_SENDER: 'cloudflare',
  ADMIN_EMAIL: ADMIN_ADDRESS,
  TURNSTILE_SITE_KEY: SITE_KEY,
  TURNSTILE_SECRET_KEY: TURNSTILE_TEST_SECRET,
};
const LOCAL_SETTINGS: Partial<Env> = {
  SITE_ORIGIN: LOCAL_SITE_ORIGIN,
  PUBLIC_ORIGIN: LOCAL_API_ORIGIN,
  EMAIL_SENDER: 'console',
  ADMIN_EMAIL: ADMIN_ADDRESS,
  TURNSTILE_SITE_KEY: SITE_KEY,
  TURNSTILE_SECRET_KEY: TURNSTILE_TEST_SECRET,
  [AdminLimiterBinding.Client]: undefined,
  [AdminLimiterBinding.Address]: undefined,
  [AdminLimiterBinding.Global]: undefined,
};

type LinkCall = {
  email?: string;
  token?: string | null;
  body?: string;
  contentType?: string;
  contentLength?: string | null;
  clientAddress?: string | null;
  origin?: string;
  fetchSite?: string | null;
  originHeader?: string | null;
  settings?: Partial<Env>;
  refusing?: AdminLimiterBinding[];
  recording?: RecordingBinding;
  shouldWait?: boolean;
};

type LinkRun = {
  email: string;
  response: Response;
  html: string;
  request: Request;
  sent: RecordingBinding['sent'];
  keys: Record<AdminLimiterBinding, string[]>;
  siteverifyBodies: Record<string, string>[];
  cookies: string[];
};

type SessionCall = {
  body?: string;
  contentType?: string;
  contentLength?: string | null;
  cookie?: string | null;
  clientAddress?: string | null;
  fetchSite?: string | null;
  originHeader?: string | null;
  settings?: Partial<Env>;
  refusing?: AdminLimiterBinding[];
};

type SessionRun = { response: Response; request: Request; keys: Record<AdminLimiterBinding, string[]>; cookies: string[] };

type AskedLink = { token: string; challenge: string };

function formBody({ email, token }: { email: string; token: string | null }): string {
  const fields = new URLSearchParams({ [EMAIL_FIELD]: email });
  if (token !== null) fields.set(TURNSTILE_FIELD, token);
  return fields.toString();
}

function headersOf({
  body,
  contentType,
  contentLength,
  clientAddress,
  fetchSite,
  originHeader,
}: {
  body: string;
  contentType: string;
  contentLength: string | null | undefined;
  clientAddress: string | null;
  fetchSite: string | null;
  originHeader: string | null;
}): Headers {
  const headers = new Headers({ 'Content-Type': contentType });
  const length = contentLength === undefined ? String(new TextEncoder().encode(body).length) : contentLength;
  if (length !== null) headers.set('Content-Length', length);
  if (clientAddress !== null) headers.set(CLIENT_ADDRESS_HEADER, clientAddress);
  if (fetchSite !== null) headers.set('Sec-Fetch-Site', fetchSite);
  if (originHeader !== null) headers.set('Origin', originHeader);
  return headers;
}

function siteverifyCalls(): Parameters<typeof fetch>[] {
  return vi.mocked(globalThis.fetch).mock.calls;
}

function siteverifyBodiesSince(count: number): Record<string, string>[] {
  return siteverifyCalls()
    .slice(count)
    .map(([, init]) => Object.fromEntries(new URLSearchParams(String(init?.body))));
}

async function askForLink({
  email = ADMIN_ADDRESS,
  token = ADMIN_TOKEN,
  body = formBody({ email, token }),
  contentType = FORM_CONTENT_TYPE,
  contentLength,
  clientAddress = CLIENT_ADDRESS,
  origin = SITE_ORIGIN,
  fetchSite = 'same-origin',
  originHeader = null,
  settings = {},
  refusing = [],
  recording = recordingBinding(),
  shouldWait = true,
}: LinkCall = {}): Promise<LinkRun> {
  const { limiters, keys } = recordedAdminLimiters({ refusing });
  const workerEnv = workerEnvWith({ ...PUBLIC_SETTINGS, EMAIL: recording.binding, ...limiters, ...settings });
  const headers = headersOf({ body, contentType, contentLength, clientAddress, fetchSite, originHeader });
  const request = new Request(`${origin}${AdminPath.SignInLinks}`, { method: 'POST', headers, body });
  const siteverifyCallsBefore = siteverifyCalls().length;
  const executionContext = createExecutionContext();
  const response = await serveAdminSignInLink({ request, env: workerEnv, executionContext });
  const html = await response.text();
  if (shouldWait) await waitOnExecutionContext(executionContext);
  return {
    email,
    response,
    html,
    request,
    sent: recording.sent,
    keys,
    siteverifyBodies: siteverifyBodiesSince(siteverifyCallsBefore),
    cookies: response.headers.getSetCookie(),
  };
}

async function askForSession({
  body = '',
  contentType = JSON_CONTENT_TYPE,
  contentLength,
  cookie = null,
  clientAddress = CLIENT_ADDRESS,
  fetchSite = 'same-origin',
  originHeader = null,
  settings = {},
  refusing = [],
}: SessionCall = {}): Promise<SessionRun> {
  const { limiters, keys } = recordedAdminLimiters({ refusing });
  const workerEnv = workerEnvWith({ ...PUBLIC_SETTINGS, ...limiters, ...settings });
  const headers = headersOf({ body, contentType, contentLength, clientAddress, fetchSite, originHeader });
  if (cookie !== null) headers.set('Cookie', cookie);
  const request = new Request(`${SITE_ORIGIN}${AdminPath.Sessions}`, { method: 'POST', headers, body });
  const executionContext = createExecutionContext();
  const response = await serveAdminSession({ request, env: workerEnv, executionContext });
  await waitOnExecutionContext(executionContext);
  return { response, request, keys, cookies: response.headers.getSetCookie() };
}

function sessionBody(token: string): string {
  return JSON.stringify({ [AdminField.Token]: token });
}

function cookieValueOf({ cookies, name }: { cookies: string[]; name: AdminCookie }): string {
  const found = cookies.map((cookie) => COOKIE_VALUE_PATTERN.exec(cookie)).find((match) => match?.[1] === name);
  if (found === null || found === undefined) throw new Error(`the answer sets no ${name} cookie`);
  const [, , value] = found;
  if (value === undefined) throw new Error(`the ${name} cookie has no value`);
  return value;
}

function cookieHeaderOf(entries: Partial<Record<AdminCookie, string>>): string {
  return Object.entries(entries)
    .map(([name, value]) => `${name}=${value}`)
    .join('; ');
}

function onlyRow<Row>(rows: Row[]): Row {
  const [row, ...others] = rows;
  if (row === undefined || others.length > 0) throw new Error('exactly one row should exist');
  return row;
}

function tokenOfSent(sent: RecordingBinding['sent']): string {
  const [message, ...others] = sent;
  if (message === undefined || others.length > 0) throw new Error('exactly one mail should have been sent');
  const token = LINK_PATTERN.exec(message.text)?.[1];
  if (token === undefined) throw new Error('the mail should carry the sign-in link');
  return token;
}

function codeOfSent(sent: RecordingBinding['sent']): string {
  const [message] = sent;
  if (message === undefined) throw new Error('a mail should have been sent');
  const code = CODE_PATTERN.exec(message.text)?.[1];
  if (code === undefined) throw new Error('the mail should carry the sign-in code');
  return code;
}

async function askedLink(): Promise<AskedLink> {
  const run = await askForLink();
  return { token: tokenOfSent(run.sent), challenge: cookieValueOf({ cookies: run.cookies, name: AdminCookie.Challenge }) };
}

function cardOf({
  notice,
  siteKey = SITE_KEY,
  address,
}: {
  notice: AdminNotice;
  siteKey?: string | null;
  address?: string;
}): Promise<string> {
  return serveAdminSignInPage({ request: new Request(ADMIN_URL), notice, siteKey, address }).then((page) => page.text());
}

function addressOfCard({ run, notice }: { run: LinkRun; notice: AdminNotice }): string | undefined {
  if (notice !== AdminNotice.CheckInbox) return undefined;
  const address = normalizedAddress(run.email);
  if (address === null) return undefined;
  return address;
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

function hangingBinding(): SendEmail {
  return { send: () => new Promise(() => undefined) };
}

function answerShapeOf(run: LinkRun): { status: number; headerNames: string[]; html: string; cookieShapes: string[] } {
  return {
    status: run.response.status,
    headerNames: [...run.response.headers.keys()].sort(),
    html: run.html.replaceAll(HIDDEN_ADDRESS_PATTERN, '$1<address>'),
    cookieShapes: run.cookies.map((cookie) => cookie.replace(COOKIE_VALUE_PATTERN, '$1=<value>;')),
  };
}

function expectAdminHeaders(response: Response): void {
  Object.entries(ADMIN_RESPONSE_HEADERS).forEach(([name, value]) => expect(response.headers.get(name)).toBe(value));
}

async function expectCard({ run, notice, status }: { run: LinkRun; notice: AdminNotice; status: number }): Promise<void> {
  expect(run.response.status).toBe(status);
  expect(run.html).toBe(await cardOf({ notice, address: addressOfCard({ run, notice }) }));
  expectAdminHeaders(run.response);
}

async function expectNothingKept(run: LinkRun): Promise<void> {
  expect(await adminLinkRows(ADMIN_ADDRESS)).toEqual([]);
  expect(run.sent).toEqual([]);
}

async function expectRefusedAlike({ run, notice, status }: { run: LinkRun; notice: AdminNotice; status: number }): Promise<void> {
  await expectCard({ run, notice, status });
  expect(run.cookies).toEqual([]);
  await expectNothingKept(run);
}

async function expectUntouched(run: LinkRun): Promise<void> {
  await expectNothingKept(run);
  expect(run.request.bodyUsed).toBe(false);
  expect(Object.values(run.keys).flat()).toEqual([]);
  expect(run.siteverifyBodies).toEqual([]);
}

async function expectNoSession(run: SessionRun): Promise<void> {
  expect(await adminSessionRows()).toEqual([]);
  expect(run.cookies).toEqual([]);
}

beforeEach(async () => {
  acceptingSiteverify();
  await env.DIRECTORY.batch([
    env.DIRECTORY.prepare('DELETE FROM admin_sign_in_links'),
    env.DIRECTORY.prepare('DELETE FROM admin_sessions'),
  ]);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('a link request as the admin on a public site host', () => {
  test('answers the check-inbox card with the challenge cookie, stores digests only and mails the link once', async () => {
    const run = await askForLink({ email: ` ${ADMIN_ADDRESS.toUpperCase()} ` });
    await expectCard({ run, notice: AdminNotice.CheckInbox, status: OK_STATUS });
    expect(run.response.headers.get(RETRY_AFTER_HEADER)).toBeNull();
    const [challengeCookie, ...otherCookies] = run.cookies;
    expect(otherCookies).toEqual([]);
    expect(challengeCookie).toMatch(CHALLENGE_COOKIE_PATTERN);
    const token = tokenOfSent(run.sent);
    const challenge = cookieValueOf({ cookies: run.cookies, name: AdminCookie.Challenge });
    const row = onlyRow(await adminLinkRows(ADMIN_ADDRESS));
    expect(row.digest).toMatch(HEXADECIMAL_DIGEST_PATTERN);
    expect(row).toMatchObject({
      digest: await digestCredential(token),
      email: ADMIN_ADDRESS,
      challenge: await digestCredential(challenge),
      consumed_at: null,
    });
    expect(JSON.stringify(row)).not.toContain(token);
    expect(JSON.stringify(row)).not.toContain(challenge);
  });

  test('the mail goes to the admin, with the link whose token rides the fragment only', async () => {
    const run = await askForLink();
    const token = tokenOfSent(run.sent);
    const link = `${SITE_ORIGIN}${AdminPath.LinkPage}#token=${token}`;
    const code = codeOfSent(run.sent);
    expect(run.sent[0]).toMatchObject(adminSignInMail({ to: ADMIN_ADDRESS, link, code, origin: SITE_ORIGIN, language: Language.English }));
    expect(run.html).not.toContain(token);
    expect(run.cookies.join()).not.toContain(token);
  });

  test('the expiry of the link is fifteen minutes from now', async () => {
    const askedFrom = Date.now();
    await askForLink();
    const row = onlyRow(await adminLinkRows(ADMIN_ADDRESS));
    expect(row.created_at).toBeGreaterThanOrEqual(askedFrom);
    expect(row.expires_at).toBe(row.created_at + ADMIN_SIGN_IN_LINK_LIFETIME_MS);
  });

  test('siteverify gets the secret and the token, once, for the admin action', async () => {
    const run = await askForLink();
    expect(run.siteverifyBodies).toEqual([{ secret: TURNSTILE_TEST_SECRET, response: ADMIN_TOKEN }]);
    expect(String(siteverifyCalls().at(-1)?.[0])).toBe(SITEVERIFY_URL);
  });

  test('the client is keyed by the link path and its address, the address by its digest and the cap by the link path', async () => {
    const run = await askForLink();
    expect(run.keys).toEqual({
      [AdminLimiterBinding.Client]: [`${AdminPath.SignInLinks}:${CLIENT_ADDRESS}`],
      [AdminLimiterBinding.Address]: [`${AdminPath.SignInLinks}:${await digestCredential(ADMIN_ADDRESS)}`],
      [AdminLimiterBinding.Global]: [AdminPath.SignInLinks],
    });
  });

  test('a fresh challenge cookie is set on every request', async () => {
    const first = await askForLink();
    const second = await askForLink();
    expect(cookieValueOf({ cookies: first.cookies, name: AdminCookie.Challenge })).not.toBe(
      cookieValueOf({ cookies: second.cookies, name: AdminCookie.Challenge }),
    );
  });

  test('the sixth link within fifteen minutes answers the same card and cookie, stores no sixth row and sends no sixth mail', async () => {
    const recording = recordingBinding();
    await Promise.all(Array.from({ length: LINKS_PER_WINDOW_MAX }, () => askForLink({ recording })));
    const sixth = await askForLink({ recording });
    await expectCard({ run: sixth, notice: AdminNotice.CheckInbox, status: OK_STATUS });
    expect(sixth.cookies[0]).toMatch(CHALLENGE_COOKIE_PATTERN);
    expect(await adminLinkRows(ADMIN_ADDRESS)).toHaveLength(LINKS_PER_WINDOW_MAX);
    expect(recording.sent).toHaveLength(LINKS_PER_WINDOW_MAX);
  });

  test('a mail that fails to send leaves the same card, deletes the row and logs no address', async () => {
    const outputs = CONSOLE_METHODS.map((method) => vi.spyOn(console, method).mockImplementation(() => undefined));
    const run = await askForLink({ settings: { EMAIL: bindingFailingWith(new Error('the sender is down')) } });
    await expectCard({ run, notice: AdminNotice.CheckInbox, status: OK_STATUS });
    expect(run.cookies[0]).toMatch(CHALLENGE_COOKIE_PATTERN);
    expect(await adminLinkRows(ADMIN_ADDRESS)).toEqual([]);
    expect(JSON.stringify(outputs.flatMap((output) => output.mock.calls))).not.toContain(ADMIN_ADDRESS);
  });
});

describe('a link request as another address', () => {
  test('answers what the admin gets, byte for byte in status, header names, body and cookie shape, and keeps and mails nothing', async () => {
    const admin = await askForLink();
    const other = await askForLink({ email: OTHER_ADDRESS });
    expect(answerShapeOf(other)).toEqual(answerShapeOf(admin));
    expect(other.cookies[0]).toMatch(CHALLENGE_COOKIE_PATTERN);
    expect(await adminLinkRows(OTHER_ADDRESS)).toEqual([]);
    expect(other.sent).toEqual([]);
    expect(other.html.replaceAll(HIDDEN_ADDRESS_PATTERN, '$1')).not.toContain(OTHER_ADDRESS);
  });

  test('a directory that throws and a sender that never answers give the admin and another address the same answer, at once', async () => {
    const settings = { DIRECTORY: failingDirectory(), EMAIL: hangingBinding() };
    const admin = await askForLink({ settings, shouldWait: false });
    const other = await askForLink({ email: OTHER_ADDRESS, settings, shouldWait: false });
    await expectCard({ run: admin, notice: AdminNotice.CheckInbox, status: OK_STATUS });
    expect(answerShapeOf(other)).toEqual(answerShapeOf(admin));
    expect(admin.cookies[0]).toMatch(CHALLENGE_COOKIE_PATTERN);
  });
});

describe('a refused link request keeps nothing, mails nothing and sets no cookie', () => {
  test.each(Object.values(AdminLimiterBinding))('a request over %s answers try again, 429 with Retry-After 60', async (binding) => {
    const run = await askForLink({ refusing: [binding] });
    await expectRefusedAlike({ run, notice: AdminNotice.TryAgain, status: TOO_MANY_STATUS });
    expect(run.response.headers.get(RETRY_AFTER_HEADER)).toBe(RETRY_AFTER_SECONDS);
  });

  test('a request over the client limit is refused before its body is read or siteverify is called', async () => {
    const run = await askForLink({ refusing: [AdminLimiterBinding.Client] });
    expect(run.request.bodyUsed).toBe(false);
    expect(run.siteverifyBodies).toEqual([]);
  });

  test('a request over the global cap never spends the slot of its address', async () => {
    const run = await askForLink({ refusing: [AdminLimiterBinding.Global] });
    expect(run.keys[AdminLimiterBinding.Global]).toEqual([AdminPath.SignInLinks]);
    expect(run.keys[AdminLimiterBinding.Address]).toEqual([]);
  });

  test.each([
    ['siteverify refuses the token', { success: false, 'error-codes': ['invalid-input-response'] }],
    ['siteverify answers timeout-or-duplicate', { success: false, 'error-codes': ['timeout-or-duplicate'] }],
    ['the action differs', { success: true, hostname: SITE_HOSTNAME, action: TurnstileAction.SignIn }],
    ['the hostname differs', { success: true, hostname: API_HOSTNAME, action: TurnstileAction.AdminSignIn }],
  ])('%s', async (_name, answer) => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => Response.json(answer));
    const run = await askForLink();
    await expectRefusedAlike({ run, notice: AdminNotice.TryAgain, status: TOO_MANY_STATUS });
    expect(run.siteverifyBodies).toHaveLength(1);
  });

  test('a token solved for another action', async () => {
    const run = await askForLink({ token: SIGN_IN_TOKEN });
    await expectRefusedAlike({ run, notice: AdminNotice.TryAgain, status: TOO_MANY_STATUS });
  });

  test.each([
    ['an empty token', ''],
    ['a token over 2048 characters', 'a'.repeat(2049)],
    ['a token with a space', 'a b'],
    ['no token', null],
  ])('%s, without calling siteverify', async (_name, token) => {
    const run = await askForLink({ token });
    await expectRefusedAlike({ run, notice: AdminNotice.TryAgain, status: TOO_MANY_STATUS });
    expect(run.siteverifyBodies).toEqual([]);
  });

  test.each([
    ['a JSON body', JSON_CONTENT_TYPE],
    ['a plain text body', 'text/plain'],
    ['a multipart body', 'multipart/form-data; boundary=x'],
  ])('%s', async (_name, contentType) => {
    const run = await askForLink({ contentType });
    await expectRefusedAlike({ run, notice: AdminNotice.TryAgain, status: TOO_MANY_STATUS });
  });

  test('no Content-Length, before the body is read', async () => {
    const run = await askForLink({ contentLength: null });
    await expectRefusedAlike({ run, notice: AdminNotice.TryAgain, status: TOO_MANY_STATUS });
    expect(run.request.bodyUsed).toBe(false);
  });

  test('a body of 5 KB, before it is read', async () => {
    const body = `${formBody({ email: ADMIN_ADDRESS, token: ADMIN_TOKEN })}&padding=${'a'.repeat(OVERSIZED_BODY_LENGTH)}`;
    const run = await askForLink({ body });
    await expectRefusedAlike({ run, notice: AdminNotice.TryAgain, status: TOO_MANY_STATUS });
    expect(run.request.bodyUsed).toBe(false);
  });

  test('a body of exactly 4096 bytes is read', async () => {
    const form = formBody({ email: ADMIN_ADDRESS, token: ADMIN_TOKEN });
    const padding = '&padding=';
    const body = `${form}${padding}${'a'.repeat(BODY_LENGTH_MAX - form.length - padding.length)}`;
    await expectCard({ run: await askForLink({ body }), notice: AdminNotice.CheckInbox, status: OK_STATUS });
  });

  test('no address', async () => {
    const run = await askForLink({ body: new URLSearchParams({ [TURNSTILE_FIELD]: ADMIN_TOKEN }).toString() });
    await expectRefusedAlike({ run, notice: AdminNotice.TryAgain, status: TOO_MANY_STATUS });
  });

  test.each([['a@b'], ['a b@c.d'], ['a@b.c\r\nBcc:x@y.z']])('the address %j', async (email) => {
    const run = await askForLink({ email });
    await expectRefusedAlike({ run, notice: AdminNotice.TryAgain, status: TOO_MANY_STATUS });
    expect(run.siteverifyBodies).toEqual([]);
  });
});

describe('a cross-origin link request answers the forbidden card, 403, before anything is read or limited', () => {
  test.each([
    ['Sec-Fetch-Site: cross-site', { fetchSite: 'cross-site' }],
    ['Sec-Fetch-Site: cross-site with the site Origin', { fetchSite: 'cross-site', originHeader: SITE_ORIGIN }],
    ['Sec-Fetch-Site: same-site with the API Origin', { fetchSite: 'same-site', originHeader: API_ORIGIN }],
    ['no Sec-Fetch-Site and a foreign Origin', { fetchSite: null, originHeader: 'https://evil.example' }],
    ['neither header', { fetchSite: null }],
  ])('%s', async (_name, call) => {
    const run = await askForLink(call);
    await expectCard({ run, notice: AdminNotice.Forbidden, status: FORBIDDEN_STATUS });
    expect(run.cookies).toEqual([]);
    await expectUntouched(run);
  });

  test('no Sec-Fetch-Site and the site Origin is same-origin', async () => {
    const run = await askForLink({ fetchSite: null, originHeader: SITE_ORIGIN });
    await expectCard({ run, notice: AdminNotice.CheckInbox, status: OK_STATUS });
  });
});

describe('an unguarded admin answers the closed card, 503, reads no body, limits nothing and keeps nothing', () => {
  test.each([
    ['no ADMIN_EMAIL', { ADMIN_EMAIL: undefined }, SITE_KEY],
    ['an ADMIN_EMAIL that is not an address', { ADMIN_EMAIL: 'not-an-address' }, SITE_KEY],
    ['no SITE_ORIGIN', { SITE_ORIGIN: undefined }, SITE_KEY],
    ['a plain http SITE_ORIGIN on a public host', { SITE_ORIGIN: 'http://todz.app' }, SITE_KEY],
    ['no site key', { TURNSTILE_SITE_KEY: undefined }, null],
    ['an unusable site key', { TURNSTILE_SITE_KEY: UNUSABLE_SITE_KEY }, null],
    ['a site key without a secret', { TURNSTILE_SECRET_KEY: undefined }, null],
    ['no mail sender', { EMAIL_SENDER: undefined }, SITE_KEY],
    ['the Cloudflare sender without its binding', { EMAIL: undefined }, SITE_KEY],
    ['the console sender on a public host', { EMAIL_SENDER: 'console' }, SITE_KEY],
    ['no ADMIN_LIMITER', { [AdminLimiterBinding.Client]: undefined }, SITE_KEY],
    ['no ADMIN_ADDRESS_LIMITER', { [AdminLimiterBinding.Address]: undefined }, SITE_KEY],
    ['no ADMIN_GLOBAL_LIMITER', { [AdminLimiterBinding.Global]: undefined }, SITE_KEY],
  ])('%s', async (_name, settings, siteKey) => {
    const run = await askForLink({ settings });
    expect(run.response.status).toBe(UNAVAILABLE_STATUS);
    expect(run.html).toBe(await cardOf({ notice: AdminNotice.Closed, siteKey }));
    expectAdminHeaders(run.response);
    expect(run.cookies).toEqual([]);
    await expectUntouched(run);
  });

  test('a request without the client address', async () => {
    const run = await askForLink({ clientAddress: null });
    await expectRefusedAlike({ run, notice: AdminNotice.Closed, status: UNAVAILABLE_STATUS });
    expect(run.request.bodyUsed).toBe(false);
    expect(run.siteverifyBodies).toEqual([]);
  });

  test('a client limiter that throws answers closed before siteverify', async () => {
    const run = await askForLink({ settings: { [AdminLimiterBinding.Client]: throwingLimiter() } });
    await expectRefusedAlike({ run, notice: AdminNotice.Closed, status: UNAVAILABLE_STATUS });
    expect(run.siteverifyBodies).toEqual([]);
  });

  test.each([AdminLimiterBinding.Address, AdminLimiterBinding.Global])('a %s limiter that throws answers closed', async (binding) => {
    const run = await askForLink({ settings: { [binding]: throwingLimiter() } });
    await expectRefusedAlike({ run, notice: AdminNotice.Closed, status: UNAVAILABLE_STATUS });
  });

  test('siteverify that cannot be reached answers closed and keeps nothing', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      throw new Error('the network is down');
    });
    const run = await askForLink();
    await expectRefusedAlike({ run, notice: AdminNotice.Closed, status: UNAVAILABLE_STATUS });
  });

  test('siteverify that answers 500 answers closed and keeps nothing', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(null, { status: 500 }));
    const run = await askForLink();
    await expectRefusedAlike({ run, notice: AdminNotice.Closed, status: UNAVAILABLE_STATUS });
  });
});

describe('a link request on a local site host', () => {
  test('needs no limiter, no client address and no mail binding, accepts the dummy token and logs the link', async () => {
    const output = consoleOutput();
    const run = await askForLink({
      origin: LOCAL_SITE_ORIGIN,
      token: TURNSTILE_DUMMY_TOKEN,
      clientAddress: null,
      settings: LOCAL_SETTINGS,
    });
    await expectCard({ run, notice: AdminNotice.CheckInbox, status: OK_STATUS });
    const mail = onlyRow(sentMail(output));
    expect(mail.to).toBe(ADMIN_ADDRESS);
    const token = LOCAL_LINK_PATTERN.exec(mail.text)?.[1];
    if (token === undefined) throw new Error('the logged mail should carry the sign-in link');
    expect(onlyRow(await adminLinkRows(ADMIN_ADDRESS)).digest).toBe(await digestCredential(token));
    expect(Object.values(run.keys).flat()).toEqual([]);
  });

  test('another address on a local site host mails nothing', async () => {
    const output = consoleOutput();
    const run = await askForLink({
      email: OTHER_ADDRESS,
      origin: LOCAL_SITE_ORIGIN,
      token: TURNSTILE_DUMMY_TOKEN,
      settings: LOCAL_SETTINGS,
    });
    await expectCard({ run, notice: AdminNotice.CheckInbox, status: OK_STATUS });
    expect(sentMail(output)).toEqual([]);
  });
});

describe('opening a session', () => {
  test('the mailed token with its challenge cookie answers 201, sets the session cookie, clears the challenge and spends the link', async () => {
    const { token, challenge } = await askedLink();
    const openedFrom = Date.now();
    const run = await askForSession({ body: sessionBody(token), cookie: cookieHeaderOf({ [AdminCookie.Challenge]: challenge }) });
    expect(run.response.status).toBe(CREATED_STATUS);
    expect(await run.response.json()).toEqual({});
    expectAdminHeaders(run.response);
    expect(run.cookies).toHaveLength(2);
    expect(run.cookies.filter((cookie) => SESSION_COOKIE_PATTERN.test(cookie))).toHaveLength(1);
    expect(run.cookies).toContain(CLEARED_CHALLENGE_COOKIE);
    const secret = cookieValueOf({ cookies: run.cookies, name: AdminCookie.Session });
    const session = onlyRow(await adminSessionRows());
    expect(session).toMatchObject({ digest: await digestCredential(secret), email: ADMIN_ADDRESS });
    expect(session.created_at).toBeGreaterThanOrEqual(openedFrom);
    expect(session.expires_at).toBe(session.created_at + ADMIN_SESSION_LIFETIME_MS);
    expect(onlyRow(await adminLinkRows(ADMIN_ADDRESS)).consumed_at).not.toBeNull();
  });

  test('the cookie it sets is a session on the next request', async () => {
    const { token, challenge } = await askedLink();
    const run = await askForSession({ body: sessionBody(token), cookie: cookieHeaderOf({ [AdminCookie.Challenge]: challenge }) });
    const secret = cookieValueOf({ cookies: run.cookies, name: AdminCookie.Session });
    const request = new Request(`${SITE_ORIGIN}${AdminPath.Panel}`, {
      headers: { Cookie: cookieHeaderOf({ [AdminCookie.Session]: secret }) },
    });
    expect(await hasAdminSession({ request, env: workerEnvWith(PUBLIC_SETTINGS), now: Date.now() })).toBe(true);
  });

  test('the client is keyed by the sessions path and its address', async () => {
    const { token, challenge } = await askedLink();
    const run = await askForSession({ body: sessionBody(token), cookie: cookieHeaderOf({ [AdminCookie.Challenge]: challenge }) });
    expect(run.keys[AdminLimiterBinding.Client]).toEqual([`${AdminPath.Sessions}:${CLIENT_ADDRESS}`]);
    expect(run.keys[AdminLimiterBinding.Address]).toEqual([]);
    expect(run.keys[AdminLimiterBinding.Global]).toEqual([]);
  });

  test('the same token a second time answers 401 and opens no second session', async () => {
    const { token, challenge } = await askedLink();
    const call = { body: sessionBody(token), cookie: cookieHeaderOf({ [AdminCookie.Challenge]: challenge }) };
    await askForSession(call);
    const second = await askForSession(call);
    expect(second.response.status).toBe(UNAUTHORIZED_STATUS);
    expect(await second.response.json()).toEqual({});
    expectAdminHeaders(second.response);
    expect(second.cookies).toEqual([]);
    expect(await adminSessionRows()).toHaveLength(1);
  });

  test('two concurrent openings of one link open exactly one session', async () => {
    const { token, challenge } = await askedLink();
    const call = { body: sessionBody(token), cookie: cookieHeaderOf({ [AdminCookie.Challenge]: challenge }) };
    const runs = await Promise.all([askForSession(call), askForSession(call)]);
    expect(runs.map((run) => run.response.status).sort()).toEqual([CREATED_STATUS, UNAUTHORIZED_STATUS]);
    expect(await adminSessionRows()).toHaveLength(1);
  });

  test.each([
    ['no challenge cookie', () => null],
    ['another browser challenge', () => cookieHeaderOf({ [AdminCookie.Challenge]: 'b'.repeat(43) })],
    ['only the session cookie name', () => cookieHeaderOf({ [AdminCookie.Session]: 'b'.repeat(43) })],
  ])('the token with %s answers 401 and keeps the link unspent', async (_name, cookieOf) => {
    const { token } = await askedLink();
    const run = await askForSession({ body: sessionBody(token), cookie: cookieOf() });
    expect(run.response.status).toBe(UNAUTHORIZED_STATUS);
    expect(await run.response.json()).toEqual({});
    await expectNoSession(run);
    expect(onlyRow(await adminLinkRows(ADMIN_ADDRESS)).consumed_at).toBeNull();
  });

  test('another browser holding the token but its own challenge cannot spend it, and the first browser still can', async () => {
    const first = await askedLink();
    const other = await askedLink();
    const stolen = await askForSession({
      body: sessionBody(first.token),
      cookie: cookieHeaderOf({ [AdminCookie.Challenge]: other.challenge }),
    });
    expect(stolen.response.status).toBe(UNAUTHORIZED_STATUS);
    const own = await askForSession({
      body: sessionBody(first.token),
      cookie: cookieHeaderOf({ [AdminCookie.Challenge]: first.challenge }),
    });
    expect(own.response.status).toBe(CREATED_STATUS);
  });

  test('a link past fifteen minutes answers 401', async () => {
    const { token, challenge } = await askedLink();
    await env.DIRECTORY.prepare('UPDATE admin_sign_in_links SET expires_at = ?')
      .bind(Date.now() - 1)
      .run();
    const run = await askForSession({ body: sessionBody(token), cookie: cookieHeaderOf({ [AdminCookie.Challenge]: challenge }) });
    expect(run.response.status).toBe(UNAUTHORIZED_STATUS);
    await expectNoSession(run);
  });

  test('a link whose address is no longer ADMIN_EMAIL answers 401', async () => {
    const { token, challenge } = await askedLink();
    const run = await askForSession({
      body: sessionBody(token),
      cookie: cookieHeaderOf({ [AdminCookie.Challenge]: challenge }),
      settings: { ADMIN_EMAIL: 'other@todz.app' },
    });
    expect(run.response.status).toBe(UNAUTHORIZED_STATUS);
    await expectNoSession(run);
  });

  test.each([
    ['a form body', { body: sessionBody('x'.repeat(43)), contentType: FORM_CONTENT_TYPE }],
    ['a plain text body', { body: 'not json', contentType: 'text/plain' }],
    ['a body that is not JSON', { body: 'not json' }],
    ['a body without a token', { body: '{}' }],
    ['a token of another length', { body: sessionBody('x'.repeat(42)) }],
    ['a token that is not a string', { body: JSON.stringify({ [AdminField.Token]: 42 }) }],
    ['a body of 5 KB', { body: JSON.stringify({ [AdminField.Token]: 'x'.repeat(OVERSIZED_BODY_LENGTH) }) }],
    ['no Content-Length', { body: sessionBody('x'.repeat(43)), contentLength: null }],
  ])('%s answers 401 and opens no session', async (_name, call) => {
    const { challenge } = await askedLink();
    const run = await askForSession({ ...call, cookie: cookieHeaderOf({ [AdminCookie.Challenge]: challenge }) });
    expect(run.response.status).toBe(UNAUTHORIZED_STATUS);
    expect(await run.response.json()).toEqual({});
    await expectNoSession(run);
  });

  test.each([
    ['Sec-Fetch-Site: cross-site', { fetchSite: 'cross-site' }],
    ['Sec-Fetch-Site: same-site with the API Origin', { fetchSite: 'same-site', originHeader: API_ORIGIN }],
    ['no Sec-Fetch-Site and a foreign Origin', { fetchSite: null, originHeader: 'https://evil.example' }],
    ['neither header', { fetchSite: null }],
  ])('a cross-origin post (%s) answers 403 before the limit or the body', async (_name, call) => {
    const { token, challenge } = await askedLink();
    const run = await askForSession({ ...call, body: sessionBody(token), cookie: cookieHeaderOf({ [AdminCookie.Challenge]: challenge }) });
    expect(run.response.status).toBe(FORBIDDEN_STATUS);
    expect(await run.response.json()).toEqual({});
    expectAdminHeaders(run.response);
    expect(run.request.bodyUsed).toBe(false);
    expect(Object.values(run.keys).flat()).toEqual([]);
    await expectNoSession(run);
  });

  test.each([
    ['no SITE_ORIGIN', { SITE_ORIGIN: undefined }],
    ['a plain http SITE_ORIGIN on a public host', { SITE_ORIGIN: 'http://todz.app' }],
  ])('%s answers 503, not 403, before the body or the limit', async (_name, settings) => {
    const { token, challenge } = await askedLink();
    const run = await askForSession({
      fetchSite: 'cross-site',
      body: sessionBody(token),
      cookie: cookieHeaderOf({ [AdminCookie.Challenge]: challenge }),
      settings,
    });
    expect(run.response.status).toBe(UNAVAILABLE_STATUS);
    expect(await run.response.json()).toEqual({});
    expect(run.request.bodyUsed).toBe(false);
    expect(Object.values(run.keys).flat()).toEqual([]);
    await expectNoSession(run);
  });

  test('a post over the client limit answers 429 with Retry-After 60 and opens nothing', async () => {
    const { token, challenge } = await askedLink();
    const run = await askForSession({
      body: sessionBody(token),
      cookie: cookieHeaderOf({ [AdminCookie.Challenge]: challenge }),
      refusing: [AdminLimiterBinding.Client],
    });
    expect(run.response.status).toBe(TOO_MANY_STATUS);
    expect(run.response.headers.get(RETRY_AFTER_HEADER)).toBe(RETRY_AFTER_SECONDS);
    expect(await run.response.json()).toEqual({});
    expect(run.request.bodyUsed).toBe(false);
    await expectNoSession(run);
  });

  test.each([
    ['no ADMIN_EMAIL', { ADMIN_EMAIL: undefined }],
    ['an ADMIN_EMAIL that is not an address', { ADMIN_EMAIL: 'not-an-address' }],
    ['no ADMIN_LIMITER', { [AdminLimiterBinding.Client]: undefined }],
    ['an ADMIN_LIMITER that throws', { [AdminLimiterBinding.Client]: throwingLimiter() }],
  ])('%s answers 503 and opens nothing', async (_name, settings) => {
    const { token, challenge } = await askedLink();
    const run = await askForSession({ body: sessionBody(token), cookie: cookieHeaderOf({ [AdminCookie.Challenge]: challenge }), settings });
    expect(run.response.status).toBe(UNAVAILABLE_STATUS);
    expect(await run.response.json()).toEqual({});
    expectAdminHeaders(run.response);
    await expectNoSession(run);
  });

  test('a post without the client address answers 503 before the body is read', async () => {
    const run = await askForSession({ body: sessionBody('x'.repeat(43)), clientAddress: null });
    expect(run.response.status).toBe(UNAVAILABLE_STATUS);
    expect(run.request.bodyUsed).toBe(false);
  });

  test('a directory that throws answers 503 and opens nothing', async () => {
    const { token, challenge } = await askedLink();
    const run = await askForSession({
      body: sessionBody(token),
      cookie: cookieHeaderOf({ [AdminCookie.Challenge]: challenge }),
      settings: { DIRECTORY: failingDirectory() },
    });
    expect(run.response.status).toBe(UNAVAILABLE_STATUS);
    expect(await run.response.json()).toEqual({});
    expect(run.cookies).toEqual([]);
    expect(await adminSessionRows()).toEqual([]);
  });
});

describe('the admin answers carry the admin headers', () => {
  test.each([
    ['the check-inbox card', () => askForLink()],
    ['the try-again card', () => askForLink({ refusing: [AdminLimiterBinding.Client] })],
    ['the forbidden card', () => askForLink({ fetchSite: 'cross-site' })],
    ['the closed card', () => askForLink({ settings: { ADMIN_EMAIL: undefined } })],
  ])('%s', async (_name, ask) => {
    expectAdminHeaders((await ask()).response);
  });
});
