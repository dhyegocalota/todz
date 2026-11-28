import { describe, expect, test } from 'vitest';
import { OAuthNotice, signInPageOf } from '../src/oauth/oauth-pages';
import { EMAIL_CODE_SCRIPT } from '../src/site/email-code-input';
import { serveAdminSignInPage } from '../src/site/admin-page';
import { AdminNotice } from '../src/site/admin-notice';
import { serveLandingPage } from '../src/site/landing-page';
import { sourceHash } from '../src/turnstile-page';
import { ENGLISH_PREFERENCES } from './english-preferences';

const SITE_KEY = '1x00000000000000000000AA';
const AUTOFOCUS_PATTERN = /\sautofocus[\s>=]/g;
const CONTENT_SECURITY_POLICY = 'Content-Security-Policy';
const CLIENT_NAME = 'Claude Code';
const REQUEST_URL = 'https://todz.app/admin';

function autofocusedTagsOf(html: string): string[] {
  return [...html.matchAll(/<[a-z]+[^>]*\sautofocus[\s>=][^>]*>/g)].map(([tag]) => tag);
}

describe('autofocus', () => {
  test('the admin sign-in page focuses its email field, once', async () => {
    const page = await serveAdminSignInPage({ request: new Request(REQUEST_URL), notice: AdminNotice.None, siteKey: SITE_KEY });
    const html = await page.text();
    expect(html.match(AUTOFOCUS_PATTERN)).toHaveLength(1);
    expect(autofocusedTagsOf(html)[0]).toContain('id="admin-email"');
  });

  test('the OAuth sign-in page focuses its email field, once', async () => {
    const page = signInPageOf({
      request: new Request('https://todz.app/oauth/authorize'),
      clientName: CLIENT_NAME,
      params: new URLSearchParams({ client_id: 'x' }),
      notice: OAuthNotice.None,
      siteKey: SITE_KEY,
    });
    const html = await page.text();
    expect(html.match(AUTOFOCUS_PATTERN)).toHaveLength(1);
    expect(autofocusedTagsOf(html)[0]).toContain('id="oauth-email"');
  });

  test('the landing page focuses nothing', async () => {
    const html = await (await serveLandingPage({ stars: 1, preferences: ENGLISH_PREFERENCES })).text();
    expect(html.match(AUTOFOCUS_PATTERN)).toBeNull();
  });
});

describe('the code input script', () => {
  test('is one fixed source with no inline handler and no network call', () => {
    expect(EMAIL_CODE_SCRIPT.length).toBeGreaterThan(0);
    expect(EMAIL_CODE_SCRIPT).not.toContain('fetch(');
    expect(EMAIL_CODE_SCRIPT).not.toContain('eval(');
  });

  test('listens for paste, input and the resend countdown', () => {
    expect(EMAIL_CODE_SCRIPT).toContain("'paste'");
    expect(EMAIL_CODE_SCRIPT).toContain("'input'");
    expect(EMAIL_CODE_SCRIPT).toContain('data-resend-seconds');
  });

  test('is hashed into the policy of the admin code card, with no unsafe-inline', async () => {
    const page = await serveAdminSignInPage({
      request: new Request(REQUEST_URL),
      notice: AdminNotice.CheckInbox,
      siteKey: SITE_KEY,
      address: 'hello@todz.app',
    });
    const policy = page.headers.get(CONTENT_SECURITY_POLICY);
    expect(policy).toContain(await sourceHash(EMAIL_CODE_SCRIPT));
    expect(policy).not.toContain('unsafe-inline');
    expect(await page.text()).not.toMatch(/<[^>]*\son[a-z]+=/);
  });
});
