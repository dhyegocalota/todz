import { EMAIL_CODE_MISSES_PER_REQUEST_MAX } from '@todz/types';
import { createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { afterEach, describe, expect, test, vi } from 'vitest';
import type { Env } from '../src/env';
import { serveAdminCodeSession } from '../src/site/admin-code-sign-in';
import { serveAdminSession, serveAdminSignInLink } from '../src/site/admin-sign-in';
import { AdminPath } from '../src/site/admin-paths';
import { TURNSTILE_DUMMY_TOKEN } from '../src/turnstile';
import { adminSessionRows } from './admin-client';
import { TURNSTILE_TEST_SECRET, consoleOutput, mailSent } from './email-sign-in-client';
import { workerEnvWith } from './owner-client';

const SITE_ORIGIN = 'http://localhost:8788';
const ADMIN_ADDRESS = 'hello@todz.app';
const STRANGER_ADDRESS = 'stranger@example.com';
const SITE_KEY = '1x00000000000000000000AA';
const FORM_CONTENT_TYPE = 'application/x-www-form-urlencoded';
const JSON_CONTENT_TYPE = 'application/json';
const CHALLENGE_COOKIE = '__Host-todz_admin_challenge';
const SESSION_COOKIE = '__Host-todz_admin';
const WRONG_CODE = '000000';
const SEE_OTHER_STATUS = 303;
const OK_STATUS = 200;
const CREATED_STATUS = 201;
const UNAUTHORIZED_STATUS = 401;
const FORBIDDEN_STATUS = 403;
const TOO_MANY_STATUS = 429;
const CODE_PATTERN = /(?:^|\s)([0-9]{6})(?:\s|$)/;
const TOKEN_PATTERN = /admin\/sign-in#token=([A-Za-z0-9_-]{43})/;
const AUTOFOCUS_PATTERN = /\sautofocus[\s>=]/g;
const COOKIE_VALUE_PATTERN = /^([^=]+)=([^;]*)/;
const LOCAL_SETTINGS: Partial<Env> = {
  SITE_ORIGIN,
  PUBLIC_ORIGIN: 'http://localhost:8787',
  EMAIL_SENDER: 'console',
  ADMIN_EMAIL: ADMIN_ADDRESS,
  TURNSTILE_SITE_KEY: SITE_KEY,
  TURNSTILE_SECRET_KEY: TURNSTILE_TEST_SECRET,
};

type AskedAdminCode = { challenge: string; code: string; token: string; html: string };

function localEnv(): Env {
  return workerEnvWith(LOCAL_SETTINGS);
}

function cookieValueOf({ cookies, name }: { cookies: string[]; name: string }): string | null {
  const found = cookies.map((cookie) => COOKIE_VALUE_PATTERN.exec(cookie)).find((match) => match?.[1] === name);
  if (found === null || found === undefined) return null;
  const [, , value] = found;
  if (value === undefined) return null;
  return value;
}

function formRequest({
  path,
  fields,
  cookie,
  headers = {},
}: {
  path: string;
  fields: Record<string, string>;
  cookie?: string;
  headers?: Record<string, string>;
}): Request {
  const body = new URLSearchParams(fields).toString();
  const requestHeaders = new Headers({
    'Content-Type': FORM_CONTENT_TYPE,
    'Content-Length': String(new TextEncoder().encode(body).length),
    'Sec-Fetch-Site': 'same-origin',
    ...headers,
  });
  if (cookie !== undefined) requestHeaders.set('Cookie', cookie);
  return new Request(`${SITE_ORIGIN}${path}`, { method: 'POST', headers: requestHeaders, body });
}

async function askedAdminCode({ email = ADMIN_ADDRESS }: { email?: string } = {}): Promise<AskedAdminCode> {
  const output = consoleOutput();
  const executionContext = createExecutionContext();
  const response = await serveAdminSignInLink({
    request: formRequest({ path: AdminPath.SignInLinks, fields: { email, 'cf-turnstile-response': TURNSTILE_DUMMY_TOKEN } }),
    env: localEnv(),
    executionContext,
  });
  const html = await response.text();
  await waitOnExecutionContext(executionContext);
  const challenge = cookieValueOf({ cookies: response.headers.getSetCookie(), name: CHALLENGE_COOKIE });
  if (challenge === null) throw new Error('asking for a link should set the challenge cookie');
  if (email !== ADMIN_ADDRESS) return { challenge, code: WRONG_CODE, token: '', html };
  const mail = mailSent(output);
  const code = CODE_PATTERN.exec(mail.text)?.[1];
  const token = TOKEN_PATTERN.exec(mail.text)?.[1];
  if (code === undefined || token === undefined) throw new Error('the admin mail should carry a code and a link');
  return { challenge, code, token, html };
}

async function enterCode({
  challenge,
  code,
  email = ADMIN_ADDRESS,
  headers,
}: {
  challenge: string | null;
  code: string;
  email?: string;
  headers?: Record<string, string>;
}): Promise<Response> {
  const executionContext = createExecutionContext();
  const cookie = challenge === null ? undefined : `${CHALLENGE_COOKIE}=${challenge}`;
  const response = await serveAdminCodeSession({
    request: formRequest({ path: AdminPath.CodeSessions, fields: { email, email_code: code }, cookie, headers }),
    env: localEnv(),
    executionContext,
  });
  await waitOnExecutionContext(executionContext);
  return response;
}

function wrongAnswers({ challenge, count }: { challenge: string; count: number }): Promise<Response[]> {
  return Array.from({ length: count }).reduce<Promise<Response[]>>(
    async (previous) => [...(await previous), await enterCode({ challenge, code: WRONG_CODE })],
    Promise.resolve([]),
  );
}

async function spentLink({ challenge, token }: { challenge: string; token: string }): Promise<Response> {
  const body = JSON.stringify({ token });
  return serveAdminSession({
    request: new Request(`${SITE_ORIGIN}${AdminPath.Sessions}`, {
      method: 'POST',
      headers: {
        'Content-Type': JSON_CONTENT_TYPE,
        'Content-Length': String(new TextEncoder().encode(body).length),
        'Sec-Fetch-Site': 'same-origin',
        Cookie: `${CHALLENGE_COOKIE}=${challenge}`,
      },
      body,
    }),
    env: localEnv(),
    executionContext: createExecutionContext(),
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('the admin code page that follows asking for a link', () => {
  test('is the inbox card with one labelled six digit field that autofocuses once', async () => {
    const { html } = await askedAdminCode();
    expect(html).toContain('Check your inbox');
    expect(html).toContain(`action="${AdminPath.CodeSessions}"`);
    expect(html).toContain('name="email_code"');
    expect(html).toContain('autocomplete="one-time-code"');
    expect(html).toContain('inputmode="numeric"');
    expect(html).toMatch(/<label[^>]*for="admin-code"[^>]*>Sign-in code<\/label>/);
    expect(html.match(AUTOFOCUS_PATTERN)).toHaveLength(1);
    expect(html).toContain('action="/admin/sign-in-links"');
    expect(html).toContain('data-resend-seconds="30"');
  });

  test('looks the same for an address that is not the admin', async () => {
    const admin = await askedAdminCode();
    const stranger = await askedAdminCode({ email: STRANGER_ADDRESS });
    expect(stranger.html.match(AUTOFOCUS_PATTERN)).toHaveLength(1);
    expect(stranger.html.includes('name="email_code"')).toBe(admin.html.includes('name="email_code"'));
  });
});

describe('POST /admin/code-sessions', () => {
  test('the right code opens the admin session and leaves for the panel', async () => {
    const { challenge, code } = await askedAdminCode();
    const response = await enterCode({ challenge, code });
    const cookies = response.headers.getSetCookie();
    expect(response.status).toBe(SEE_OTHER_STATUS);
    expect(response.headers.get('Location')).toBe(AdminPath.Panel);
    expect(cookieValueOf({ cookies, name: SESSION_COOKIE })).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(cookieValueOf({ cookies, name: CHALLENGE_COOKIE })).toBe('');
    expect(await adminSessionRows()).toHaveLength(1);
  });

  test('spending the code spends the emailed link', async () => {
    const { challenge, code, token } = await askedAdminCode();
    expect((await enterCode({ challenge, code })).status).toBe(SEE_OTHER_STATUS);
    expect((await spentLink({ challenge, token })).status).toBe(UNAUTHORIZED_STATUS);
  });

  test('spending the link spends the code', async () => {
    const { challenge, code, token } = await askedAdminCode();
    expect((await spentLink({ challenge, token })).status).toBe(CREATED_STATUS);
    expect((await enterCode({ challenge, code })).status).toBe(UNAUTHORIZED_STATUS);
  });

  test('a wrong code answers the card again with the shaking error and opens no session', async () => {
    const { challenge } = await askedAdminCode();
    const response = await enterCode({ challenge, code: WRONG_CODE });
    const html = await response.text();
    expect(response.status).toBe(UNAUTHORIZED_STATUS);
    expect(html).toContain('data-state="wrong"');
    expect(html).toContain('name="email_code"');
    expect(await adminSessionRows()).toEqual([]);
  });

  test('a code needs the challenge cookie of the browser that asked', async () => {
    const { code } = await askedAdminCode();
    expect((await enterCode({ challenge: null, code })).status).toBe(UNAUTHORIZED_STATUS);
    expect((await enterCode({ challenge: 'A'.repeat(43), code })).status).toBe(UNAUTHORIZED_STATUS);
  });

  test('five wrong codes lock the request: 429 with Retry-After, and the right code no longer signs in', async () => {
    const { challenge, code } = await askedAdminCode();
    const answers = await wrongAnswers({ challenge, count: EMAIL_CODE_MISSES_PER_REQUEST_MAX });
    const last = answers.at(-1);
    expect(last?.status).toBe(TOO_MANY_STATUS);
    expect(Number(last?.headers.get('Retry-After'))).toBeGreaterThan(0);
    const right = await enterCode({ challenge, code });
    expect(right.status).toBe(TOO_MANY_STATUS);
    expect(await adminSessionRows()).toEqual([]);
  });

  test('an address that is not the admin answers and locks exactly like the admin', async () => {
    const admin = await askedAdminCode();
    const stranger = await askedAdminCode({ email: STRANGER_ADDRESS });
    const run = async ({ challenge }: { challenge: string }) =>
      Promise.all(
        (
          await Array.from({ length: EMAIL_CODE_MISSES_PER_REQUEST_MAX + 1 }).reduce<Promise<Response[]>>(
            async (previous) => [...(await previous), await enterCode({ challenge, code: WRONG_CODE })],
            Promise.resolve([]),
          )
        ).map(async (response) => [response.status, response.headers.has('Retry-After')]),
      );
    expect(await run(stranger)).toEqual(await run(admin));
  });

  test('a cross-site post is refused', async () => {
    const { challenge, code } = await askedAdminCode();
    const response = await enterCode({ challenge, code, headers: { 'Sec-Fetch-Site': 'cross-site' } });
    expect(response.status).toBe(FORBIDDEN_STATUS);
    expect(await adminSessionRows()).toEqual([]);
  });

  test('the answer is never cached', async () => {
    const { challenge } = await askedAdminCode();
    const response = await enterCode({ challenge, code: WRONG_CODE });
    expect(response.headers.get('Cache-Control')).toContain('no-store');
    expect(response.status).not.toBe(OK_STATUS);
  });
});
