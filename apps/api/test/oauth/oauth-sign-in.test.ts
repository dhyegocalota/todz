import { MILLISECONDS_PER_MINUTE } from '@todz/types';
import { env } from 'cloudflare:workers';
import { describe, expect, test, vi } from 'vitest';
import { countActiveAccounts, countOutstandingAdmissions } from '../../src/cloud-queue-store';
import { TURNSTILE_DUMMY_TOKEN } from '../../src/turnstile';
import { seedOwner } from '../directory-seed';
import { freshAddress } from '../email-sign-in-client';
import { ownerCall } from '../owner-client';
import { CLOCK_NOW } from '../task-fixtures';
import {
  OAUTH_ORIGIN,
  askForLink,
  authorizeParams,
  authorizeRequest,
  browserVisit,
  clientMetadata,
  formRequest,
  mailedLinkOf,
  newBrowser,
  oauthEnv,
  pkcePair,
  registerClient,
  serveOAuthRequest,
  signedInBrowser,
  spendLink,
} from './oauth-client';

const CHALLENGE_COOKIE = '__Secure-todz_oauth_challenge';
const SESSION_COOKIE = '__Secure-todz_oauth';
const SESSION_LIFETIME_MS = 30 * MILLISECONDS_PER_MINUTE;
const SITE_ORIGIN = 'https://todz.app';

async function freshParams(): Promise<URLSearchParams> {
  const clientId = await registerClient({ metadata: clientMetadata() });
  const { challenge } = await pkcePair();
  return authorizeParams({ clientId, challenge });
}

function setCookieNamed({ response, name }: { response: Response; name: string }): string {
  const header = response.headers.getSetCookie().find((cookie) => cookie.startsWith(`${name}=`));
  if (header === undefined) throw new Error(`the answer should set ${name}`);
  return header;
}

async function fullCloudEnv(): Promise<ReturnType<typeof oauthEnv>> {
  await seedOwner();
  const active = await countActiveAccounts({ directory: env.DIRECTORY, now: CLOCK_NOW });
  const outstanding = await countOutstandingAdmissions({ directory: env.DIRECTORY, now: CLOCK_NOW });
  return oauthEnv({ CLOUD_ACCOUNTS_MAX: String(active + outstanding), SITE_ORIGIN });
}

describe('asking for a sign-in link from the authorize page', () => {
  test('answers the inbox page, sets the challenge cookie and mails a link back to this request', async () => {
    const params = await freshParams();
    const browser = newBrowser();

    const { response, mails } = await askForLink({ browser, params });

    expect(response.status).toBe(200);
    expect(await response.text()).toContain('Check your inbox');
    const cookie = setCookieNamed({ response, name: CHALLENGE_COOKIE });
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('Secure');
    expect(cookie).toContain('SameSite=Lax');
    expect(cookie).toContain('Path=/oauth');
    expect(cookie).not.toContain('Domain=');
    expect(mails).toHaveLength(1);
    const link = mailedLinkOf(mails[0]!);
    expect(link.request).toBe(params.toString());
    expect(mails[0]).toContain(`${OAUTH_ORIGIN}/oauth/sign-in#token=`);
  });

  test('a cross-site post is refused and mails nothing', async () => {
    const params = await freshParams();
    const output = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const response = await browserVisit({
      browser: newBrowser(),
      request: formRequest({
        path: '/oauth/sign-in-links',
        fields: { email: freshAddress(), 'cf-turnstile-response': TURNSTILE_DUMMY_TOKEN, request: params.toString() },
        headers: { 'Sec-Fetch-Site': 'cross-site' },
      }),
    });

    expect(response.status).toBe(403);
    expect(response.headers.getSetCookie()).toEqual([]);
    expect(output).not.toHaveBeenCalled();
    output.mockRestore();
  });

  test('a request for an unknown client renders the error page and mails nothing', async () => {
    const params = await freshParams();
    params.set('client_id', 'unknownunknownunknownunknownunknownunknown0');

    const { response, mails } = await askForLink({ browser: newBrowser(), params });

    expect(response.status).toBe(400);
    expect(mails).toEqual([]);
  });

  test('a malformed address asks again and mails nothing', async () => {
    const params = await freshParams();

    const { response, mails } = await askForLink({ browser: newBrowser(), params, email: 'not an address' });

    expect(response.status).toBe(400);
    expect(await response.text()).toContain('action="/oauth/sign-in-links"');
    expect(mails).toEqual([]);
  });

  test('a full cloud answers the same inbox page and mails the queue message instead of a link', async () => {
    const params = await freshParams();
    const workerEnv = await fullCloudEnv();

    const { response, mails } = await askForLink({ browser: newBrowser(), params, workerEnv });

    expect(response.status).toBe(200);
    expect(await response.text()).toContain('Check your inbox');
    expect(mails.join('\n')).not.toContain('/oauth/sign-in#token=');
  });

  test('without the email sign-in provider the page says sign-in is unavailable', async () => {
    const params = await freshParams();

    const response = await serveOAuthRequest({ request: authorizeRequest(params), workerEnv: oauthEnv({ SIGN_IN_PROVIDER: 'fake' }) });

    expect(response.status).toBe(503);
    expect(await response.text()).toContain('Signing in to connect apps is not available on this server.');
  });
});

describe('spending the link opens a short browser session', () => {
  test('the token with its challenge cookie sets a 30-minute session cookie for /oauth only', async () => {
    const params = await freshParams();
    const browser = newBrowser();
    const { mails } = await askForLink({ browser, params });

    const response = await spendLink({ browser, token: mailedLinkOf(mails[0]!).token });

    expect(response.status).toBe(201);
    const cookie = setCookieNamed({ response, name: SESSION_COOKIE });
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('Secure');
    expect(cookie).toContain('SameSite=Lax');
    expect(cookie).toContain('Path=/oauth');
    expect(cookie).toContain(`Max-Age=${SESSION_LIFETIME_MS / 1_000}`);
    expect(setCookieNamed({ response, name: CHALLENGE_COOKIE })).toContain('Max-Age=0');
    expect(browser.cookies.has(SESSION_COOKIE)).toBe(true);
  });

  test('a token without its challenge cookie is refused', async () => {
    const params = await freshParams();
    const { mails } = await askForLink({ browser: newBrowser(), params });

    const response = await spendLink({ browser: newBrowser(), token: mailedLinkOf(mails[0]!).token });

    expect(response.status).toBe(401);
    expect(response.headers.getSetCookie().some((cookie) => cookie.startsWith(`${SESSION_COOKIE}=`))).toBe(false);
  });

  test("a token with another browser's challenge cookie is refused", async () => {
    const params = await freshParams();
    const { mails } = await askForLink({ browser: newBrowser(), params });
    const otherBrowser = newBrowser();
    await askForLink({ browser: otherBrowser, params });

    const response = await spendLink({ browser: otherBrowser, token: mailedLinkOf(mails[0]!).token });

    expect(response.status).toBe(401);
  });

  test('a link works once', async () => {
    const params = await freshParams();
    const browser = newBrowser();
    const { mails } = await askForLink({ browser, params });
    const { token } = mailedLinkOf(mails[0]!);
    await spendLink({ browser, token });
    await askForLink({ browser, params });

    const response = await spendLink({ browser, token });

    expect(response.status).toBe(401);
  });

  test('a new address signs up through the link, as in the app', async () => {
    const params = await freshParams();
    const email = freshAddress();

    await signedInBrowser({ params, email });

    const identity = await env.DIRECTORY.prepare('SELECT owner_id FROM owner_identities WHERE provider = ? AND subject = ?')
      .bind('email', email)
      .first<{ owner_id: string }>();
    expect(identity).not.toBeNull();
    const owner = await env.DIRECTORY.prepare('SELECT time_zone FROM owners WHERE id = ?')
      .bind(identity!.owner_id)
      .first<{ time_zone: string }>();
    expect(owner?.time_zone).toBe('America/Sao_Paulo');
  });

  test('a new address under a full cloud is refused at spend time and no owner is created', async () => {
    const params = await freshParams();
    const email = freshAddress();
    const browser = newBrowser();
    const { mails } = await askForLink({ browser, params, email });

    const response = await spendLink({ browser, token: mailedLinkOf(mails[0]!).token, workerEnv: await fullCloudEnv() });

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ error: 'cloud_full' });
    const identity = await env.DIRECTORY.prepare('SELECT owner_id FROM owner_identities WHERE subject = ?').bind(email).first();
    expect(identity).toBeNull();
  });

  test('the browser session is not an owner API session', async () => {
    const params = await freshParams();
    const browser = await signedInBrowser({ params });

    const response = await ownerCall({ method: 'GET', path: '/owner', token: browser.cookies.get(SESSION_COOKIE) });

    expect(response.status).toBe(401);
  });

  test('after 30 minutes the session is gone and the email form comes back', async () => {
    const params = await freshParams();
    const browser = await signedInBrowser({ params });

    const response = await browserVisit({ browser, request: authorizeRequest(params), now: CLOCK_NOW + SESSION_LIFETIME_MS });

    expect(response.status).toBe(200);
    expect(await response.text()).toContain('action="/oauth/sign-in-links"');
  });

  test('the link page is a static page whose script reads the fragment', async () => {
    const response = await serveOAuthRequest({ request: new Request(`${OAUTH_ORIGIN}/oauth/sign-in`) });

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Security-Policy')).toContain("connect-src 'self'");
    const html = await response.text();
    expect(html).toContain("location.replace('/oauth/authorize?' + request)");
  });
});
