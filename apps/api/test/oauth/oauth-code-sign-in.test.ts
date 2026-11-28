import { EMAIL_CODE_MISSES_PER_REQUEST_MAX } from '@todz/types';
import { env } from 'cloudflare:workers';
import { describe, expect, test } from 'vitest';
import { EMAIL_CODE_SCRIPT } from '../../src/site/email-code-input';
import { sourceHash } from '../../src/turnstile-page';
import { seedEmailIdentity, seedOwner } from '../directory-seed';
import { freshAddress } from '../email-sign-in-client';
import {
  type Browser,
  TIME_ZONE,
  askForLink,
  authorizeParams,
  browserVisit,
  clientMetadata,
  consentPage,
  formRequest,
  mailedCodeOf,
  mailedLinkOf,
  newBrowser,
  pkcePair,
  registerClient,
  spendLink,
} from './oauth-client';

const CODE_PATH = '/oauth/code-sessions';
const WRONG_CODE = '000000';
const SEE_OTHER_STATUS = 303;
const UNAUTHORIZED_STATUS = 401;
const BAD_REQUEST_STATUS = 400;
const FORBIDDEN_STATUS = 403;
const TOO_MANY_STATUS = 429;
const SESSION_COOKIE = '__Host-todz_oauth';
const CHALLENGE_COOKIE = '__Host-todz_oauth_challenge';
const AUTOFOCUS_PATTERN = /\sautofocus[\s>=]/g;

type AskedCode = {
  browser: Browser;
  params: URLSearchParams;
  email: string;
  code: string;
  token: string;
  html: string;
  policy: string | null;
};

async function freshParams(): Promise<URLSearchParams> {
  const clientId = await registerClient({ metadata: clientMetadata() });
  const { challenge } = await pkcePair();
  return authorizeParams({ clientId, challenge });
}

async function askedCode({ email = freshAddress() }: { email?: string } = {}): Promise<AskedCode> {
  const params = await freshParams();
  const browser = newBrowser();
  const { response, mails } = await askForLink({ browser, params, email });
  const [mail] = mails;
  if (mail === undefined) throw new Error('asking for a link should mail one');
  return {
    browser,
    params,
    email,
    code: mailedCodeOf(mail),
    token: mailedLinkOf(mail).token,
    html: await response.text(),
    policy: response.headers.get('Content-Security-Policy'),
  };
}

function enterCode({
  browser,
  params,
  email,
  code,
  fields = {},
  headers,
}: {
  browser: Browser;
  params: URLSearchParams;
  email: string;
  code: string;
  fields?: Record<string, string>;
  headers?: Record<string, string>;
}): Promise<Response> {
  return browserVisit({
    browser,
    request: formRequest({
      path: CODE_PATH,
      fields: { email, email_code: code, request: params.toString(), time_zone: TIME_ZONE, ...fields },
      headers,
    }),
  });
}

describe('the code page that follows asking for a link', () => {
  test('is the inbox page with one labelled six digit field that autofocuses once', async () => {
    const { html } = await askedCode();
    expect(html).toContain('Check your inbox');
    expect(html).toContain(`action="${CODE_PATH}"`);
    expect(html).toContain('name="email_code"');
    expect(html).toContain('autocomplete="one-time-code"');
    expect(html).toContain('inputmode="numeric"');
    expect(html).toContain('maxlength="6"');
    expect(html).toMatch(/<label[^>]*for="oauth-code"[^>]*>Sign-in code<\/label>/);
    expect(html.match(AUTOFOCUS_PATTERN)).toHaveLength(1);
    expect(html).toMatch(/<input[^>]*id="oauth-code"[^>]*\sautofocus/);
  });

  test('works without script: a plain field, a submit button and no inline handler', async () => {
    const { html } = await askedCode();
    expect(html).toMatch(/<button[^>]*type="submit"[^>]*>Sign in<\/button>/);
    expect(html).not.toMatch(/<[^>]*\son[a-z]+=/);
  });

  test('hashes the code script into a strict policy, with no unsafe-inline', async () => {
    const { policy } = await askedCode();
    expect(policy).toContain(await sourceHash(EMAIL_CODE_SCRIPT));
    expect(policy).not.toContain('unsafe-inline');
  });

  test('carries the address and the request back in hidden fields, and a resend form for the same address', async () => {
    const { html, email, params } = await askedCode();
    expect(html).toContain(`<input type="hidden" name="email" value="${email}">`);
    expect(html).toContain(`<input type="hidden" name="request" value="${params.toString().replaceAll('&', '&amp;')}">`);
    expect(html).toContain('action="/oauth/sign-in-links"');
    expect(html).toContain('Resend code');
    expect(html).toContain('data-resend-seconds="30"');
  });
});

describe('POST /oauth/code-sessions', () => {
  test('the right code opens the browser session and returns to the authorize page', async () => {
    const { browser, params, email, code } = await askedCode();
    const response = await enterCode({ browser, params, email, code });
    expect(response.status).toBe(SEE_OTHER_STATUS);
    expect(response.headers.get('Location')).toBe(`/oauth/authorize?${params.toString()}`);
    expect(browser.cookies.has(SESSION_COOKIE)).toBe(true);
    expect(browser.cookies.has(CHALLENGE_COOKIE)).toBe(false);
    expect(await consentPage({ browser, params })).toContain('name="decision"');
  });

  test('spending the code spends the emailed link', async () => {
    const { browser, params, email, code, token } = await askedCode();
    const challenge = browser.cookies.get(CHALLENGE_COOKIE);
    await enterCode({ browser, params, email, code });
    if (challenge !== undefined) browser.cookies.set(CHALLENGE_COOKIE, challenge);
    const link = await spendLink({ browser, token });
    expect(link.status).toBe(UNAUTHORIZED_STATUS);
  });

  test('spending the link spends the code', async () => {
    const { browser, params, email, code, token } = await askedCode();
    const challenge = browser.cookies.get(CHALLENGE_COOKIE);
    expect((await spendLink({ browser, token })).status).toBe(201);
    if (challenge !== undefined) browser.cookies.set(CHALLENGE_COOKIE, challenge);
    const response = await enterCode({ browser, params, email, code });
    expect(response.status).toBe(UNAUTHORIZED_STATUS);
  });

  test('a wrong code answers the code page again with the shaking error, and opens no session', async () => {
    const { browser, params, email } = await askedCode();
    const response = await enterCode({ browser, params, email, code: WRONG_CODE });
    const html = await response.text();
    expect(response.status).toBe(UNAUTHORIZED_STATUS);
    expect(html).toContain('That code didn&#39;t work. Check it and try again.');
    expect(html).toContain('data-state="wrong"');
    expect(html).toContain('name="email_code"');
    expect(browser.cookies.has(SESSION_COOKIE)).toBe(false);
  });

  test('a code works only in the browser that asked for it', async () => {
    const { params, email, code } = await askedCode();
    const response = await enterCode({ browser: newBrowser(), params, email, code });
    expect(response.status).toBe(UNAUTHORIZED_STATUS);
  });

  test('five wrong codes lock the request: 429 with Retry-After, and the right code no longer signs in', async () => {
    const { browser, params, email, code } = await askedCode();
    const answers = await Array.from({ length: EMAIL_CODE_MISSES_PER_REQUEST_MAX }).reduce<Promise<Response[]>>(
      async (previous) => [...(await previous), await enterCode({ browser, params, email, code: WRONG_CODE })],
      Promise.resolve([]),
    );
    const last = answers.at(-1);
    expect(last?.status).toBe(TOO_MANY_STATUS);
    expect(Number(last?.headers.get('Retry-After'))).toBeGreaterThan(0);
    expect(await last?.text()).toContain('Too many tries. Use the link in the email or ask for a new code.');
    const right = await enterCode({ browser, params, email, code });
    expect(right.status).toBe(TOO_MANY_STATUS);
    expect(browser.cookies.has(SESSION_COOKIE)).toBe(false);
  });

  test('an address nobody asked for answers exactly as one that was asked for', async () => {
    const { browser, params } = await askedCode();
    const stranger = freshAddress();
    const response = await enterCode({ browser, params, email: stranger, code: WRONG_CODE });
    expect(response.status).toBe(UNAUTHORIZED_STATUS);
    expect(await response.text()).toContain('data-state="wrong"');
  });

  test('keeps the time zone of a known owner when the page sent none, and never makes up one for a new owner', async () => {
    const ownerId = await seedOwner('America/Sao_Paulo');
    const email = freshAddress();
    await seedEmailIdentity({ ownerId, email });
    const { browser, params, code } = await askedCode({ email });
    const response = await enterCode({ browser, params, email, code, fields: { time_zone: '' } });
    expect(response.status).toBe(SEE_OTHER_STATUS);
    const row = await env.DIRECTORY.prepare('SELECT time_zone FROM owners WHERE id = ?').bind(ownerId).first<{ time_zone: string }>();
    expect(row?.time_zone).toBe('America/Sao_Paulo');
    const fresh = await askedCode();
    const unplaced = await enterCode({ ...fresh, fields: { time_zone: '' } });
    expect(unplaced.status).not.toBe(SEE_OTHER_STATUS);
    const created = await env.DIRECTORY.prepare('SELECT count(*) AS owners FROM owner_identities WHERE subject = ?')
      .bind(fresh.email)
      .first<{ owners: number }>();
    expect(created?.owners).toBe(0);
  });

  test('a cross-site post is refused', async () => {
    const { browser, params, email, code } = await askedCode();
    const response = await enterCode({ browser, params, email, code, headers: { 'Sec-Fetch-Site': 'cross-site' } });
    expect(response.status).toBe(FORBIDDEN_STATUS);
    expect(browser.cookies.has(SESSION_COOKIE)).toBe(false);
  });

  test('a request that is not a valid authorization request answers the invalid page', async () => {
    const { browser, email, code } = await askedCode();
    const response = await enterCode({ browser, params: new URLSearchParams({ client_id: 'unknown' }), email, code });
    expect(response.status).toBe(BAD_REQUEST_STATUS);
  });

  test.each([['12345'], ['abcdef'], ['']])('a code of %j is a wrong code, never a server error', async (code) => {
    const { browser, params, email } = await askedCode();
    const response = await enterCode({ browser, params, email, code });
    expect(response.status).toBe(UNAUTHORIZED_STATUS);
  });
});
