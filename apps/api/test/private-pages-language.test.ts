import { LANGUAGE_PROFILES, Language } from '@todz/types';
import { describe, expect, test } from 'vitest';
import { OAuthNotice, OAuthRefusal, approvedPageOf, inboxPageOf, refusalPageOf, signInPageOf } from '../src/oauth/oauth-pages';
import { serveAdminLinkPage } from '../src/site/admin-link-page';
import { serveAdminSignInPage } from '../src/site/admin-page';
import { AdminNotice } from '../src/site/admin-notice';
import { serveOAuthLinkPage } from '../src/oauth/oauth-link-page';
import { dayEmailStopResponse } from '../src/day-email/day-email-stop';
import { serveSignInPage } from '../src/sign-in-page';
import { serveSignInChallengePage } from '../src/sign-in-challenge-page';
import { workerEnvWith } from './owner-client';
import { TEST_SITE_KEY } from './page-script';

const SITE_ORIGIN = 'https://todz.app';
const API_ORIGIN = 'https://api.todz.app';
const LANGUAGE_COOKIE = 'todz_language';
const THEME_COOKIE = 'todz_theme';
const STOP_PATH = `/day-email/stop?token=${'a'.repeat(64)}`;
const AUTHORIZATION_QUERY = 'client_id=abc&state=xyz';

type PageOf = (request: Request) => Promise<Response> | Response;

function requestOf({ url, headers = {} }: { url: string; headers?: Record<string, string> }): Request {
  return new Request(url, { headers });
}

const PAGES: { name: string; url: string; pageOf: PageOf }[] = [
  {
    name: 'the admin sign-in card',
    url: `${SITE_ORIGIN}/admin`,
    pageOf: (request) => serveAdminSignInPage({ request, notice: AdminNotice.None, siteKey: TEST_SITE_KEY }),
  },
  { name: 'the admin link page', url: `${SITE_ORIGIN}/admin/sign-in`, pageOf: (request) => serveAdminLinkPage({ request }) },
  { name: 'the OAuth link page', url: `${API_ORIGIN}/oauth/sign-in`, pageOf: (request) => serveOAuthLinkPage({ request }) },
  {
    name: 'an OAuth refusal',
    url: `${API_ORIGIN}/oauth/authorize`,
    pageOf: (request) => refusalPageOf({ request, refusal: OAuthRefusal.Invalid }),
  },
  {
    name: 'the OAuth approved page',
    url: `${API_ORIGIN}/oauth/authorize`,
    pageOf: (request) => approvedPageOf({ request, clientName: 'Agent' }),
  },
  { name: 'the OAuth inbox page', url: `${API_ORIGIN}/oauth/sign-in-links`, pageOf: (request) => inboxPageOf({ request, cookies: [] }) },
  {
    name: 'the app sign-in page',
    url: `${API_ORIGIN}/sign-in`,
    pageOf: (request) => serveSignInPage({ request, env: workerEnvWith({}) }),
  },
  {
    name: 'the sign-in challenge page',
    url: `${API_ORIGIN}/sign-in/challenge`,
    pageOf: (request) => serveSignInChallengePage({ request, env: workerEnvWith({}) }),
  },
  {
    name: 'the day-email stop page',
    url: `${API_ORIGIN}${STOP_PATH}`,
    pageOf: (request) => dayEmailStopResponse({ request, env: workerEnvWith({}) }),
  },
];

describe('the language of a private page', () => {
  test.each(PAGES)('$name takes the cookie, then Accept-Language, then English', async ({ url, pageOf }) => {
    const [cookie, negotiated, fallback, both] = await Promise.all([
      pageOf(requestOf({ url, headers: { Cookie: `${LANGUAGE_COOKIE}=de` } })),
      pageOf(requestOf({ url, headers: { 'Accept-Language': 'ja,en;q=0.5' } })),
      pageOf(requestOf({ url })),
      pageOf(requestOf({ url, headers: { Cookie: `${LANGUAGE_COOKIE}=ko`, 'Accept-Language': 'ja' } })),
    ]);
    expect(await cookie.text()).toContain('<html lang="de"');
    expect(await negotiated.text()).toContain('<html lang="ja"');
    expect(await fallback.text()).toContain('<html lang="en"');
    expect(await both.text()).toContain('<html lang="ko"');
  });

  test.each(PAGES)('$name takes the theme cookie', async ({ url, pageOf }) => {
    const html = await (await pageOf(requestOf({ url, headers: { Cookie: `${THEME_COOKIE}=dark` } }))).text();
    expect(html).toMatch(/<html lang="[^"]+" dir="(?:ltr|rtl)" data-theme="dark">/);
    expect(html).toContain('<meta name="color-scheme" content="dark">');
  });

  test.each(PAGES)('$name follows the system theme without an attribute', async ({ url, pageOf }) => {
    const html = await (await pageOf(requestOf({ url }))).text();
    expect(html).not.toContain('data-theme="light"');
    expect(html).not.toContain('data-theme="dark"');
    expect(html).toContain('<meta name="color-scheme" content="light dark">');
  });

  test.each(PAGES)('$name keeps its content security policy to hashes', async ({ url, pageOf }) => {
    const policy = (await pageOf(requestOf({ url }))).headers.get('Content-Security-Policy');
    expect(policy).not.toContain('unsafe-inline');
    expect(policy).not.toContain('unsafe-eval');
  });
});

describe('the selector of a private page', () => {
  test('the admin sign-in card returns to the admin even for a result of a post', async () => {
    const request = new Request(`${SITE_ORIGIN}/admin/sign-in-links`, { method: 'POST' });
    const html = await (await serveAdminSignInPage({ request, notice: AdminNotice.CheckInbox, siteKey: null })).text();
    expect(html).toContain('<input type="hidden" name="return" value="/admin">');
  });

  test('the OAuth sign-in page replays the authorization request', async () => {
    const request = new Request(`${API_ORIGIN}/oauth/sign-in-links`, { method: 'POST' });
    const response = signInPageOf({
      request,
      clientName: 'Agent',
      params: new URLSearchParams(AUTHORIZATION_QUERY),
      notice: OAuthNotice.None,
      siteKey: TEST_SITE_KEY,
    });
    const html = await response.text();
    expect(html).toContain(`<input type="hidden" name="return" value="/oauth/authorize?${AUTHORIZATION_QUERY.replace('&', '&amp;')}">`);
    expect(html).toContain('action="/language"');
  });

  test.each(['/sign-in', '/sign-in/challenge'])('%s has no selector', async (path) => {
    const pageOf = path === '/sign-in' ? serveSignInPage : serveSignInChallengePage;
    const html = await (await pageOf({ request: requestOf({ url: `${API_ORIGIN}${path}` }), env: workerEnvWith({}) })).text();
    expect(html).not.toContain('action="/language"');
  });
});
