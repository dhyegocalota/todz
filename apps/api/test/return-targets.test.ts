import { required } from './required';
import { createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { describe, expect, test } from 'vitest';
import type { Env } from '../src/env';
import worker from '../src/index';
import { serveOAuthLinkPage } from '../src/oauth/oauth-link-page';
import { OAuthNotice, OAuthRefusal, approvedPageOf, inboxPageOf, refusalPageOf, signInPageOf } from '../src/oauth/oauth-pages';
import { AdminNotice } from '../src/site/admin-notice';
import { serveAdminLinkPage } from '../src/site/admin-link-page';
import { serveAdminSignInPage } from '../src/site/admin-page';
import { workerEnvWith } from './owner-client';
import { TEST_SITE_KEY } from './page-script';

const SITE_ORIGIN = 'https://todz.app';
const API_ORIGIN = 'https://api.todz.app';
const ADDRESS = 'maria@example.com';
const SITE_KEY = '1x00000000000000000000AA';
const SETTINGS: Partial<Env> = { PUBLIC_ORIGIN: API_ORIGIN, SITE_ORIGIN, SIGN_IN_PROVIDER: 'fake' };
const RETURN_PATTERN = /<input type="hidden" name="return" value="([^"]*)">/g;
const SEE_OTHER_STATUS = 303;
const NOT_FOUND_STATUS = 404;
const BROWSER_USER_AGENT = 'Mozilla/5.0 (Macintosh) AppleWebKit/605.1.15 Safari/605.1.15';
const AUTHORIZATION_QUERY = 'client_id=abc&state=xyz';

type EdgeRequest = Request<unknown, IncomingRequestCfProperties>;
type RenderedPage = { name: string; origin: string; hasControls: boolean; html: () => Promise<string> };

async function serve({
  origin,
  path,
  method = 'GET',
  form,
}: {
  origin: string;
  path: string;
  method?: string;
  form?: Record<string, string>;
}) {
  const body = form === undefined ? undefined : new URLSearchParams(form).toString();
  const headers: Record<string, string> = { 'User-Agent': BROWSER_USER_AGENT, Origin: origin };
  if (body !== undefined) {
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
    headers['Content-Length'] = String(new TextEncoder().encode(body).length);
  }
  const request = new Request(`${origin}${path}`, { method, headers, body, redirect: 'manual' });
  const executionContext = createExecutionContext();
  const response = await worker.fetch(request as EdgeRequest, workerEnvWith(SETTINGS), executionContext);
  await waitOnExecutionContext(executionContext);
  return response;
}

function requestOf({ origin, path, method = 'GET' }: { origin: string; path: string; method?: string }): Request {
  return new Request(`${origin}${path}`, { method });
}

function fetched({ origin, path }: { origin: string; path: string }): () => Promise<string> {
  return async () => (await serve({ origin, path })).text();
}

const PAGES: RenderedPage[] = [
  { name: 'the landing', origin: SITE_ORIGIN, hasControls: true, html: fetched({ origin: SITE_ORIGIN, path: '/ja/' }) },
  {
    name: 'the cloud queue page',
    origin: SITE_ORIGIN,
    hasControls: true,
    html: fetched({ origin: SITE_ORIGIN, path: '/pt-br/cloud-queue' }),
  },
  { name: 'the admin sign-in card', origin: SITE_ORIGIN, hasControls: true, html: fetched({ origin: SITE_ORIGIN, path: '/admin' }) },
  {
    name: 'the admin card answering a post',
    origin: SITE_ORIGIN,
    hasControls: true,
    html: async () =>
      (
        await serveAdminSignInPage({
          request: requestOf({ origin: SITE_ORIGIN, path: '/admin/sign-in-links', method: 'POST' }),
          notice: AdminNotice.CheckInbox,
          siteKey: TEST_SITE_KEY,
        })
      ).text(),
  },
  {
    name: 'the OAuth sign-in page',
    origin: API_ORIGIN,
    hasControls: true,
    html: async () =>
      signInPageOf({
        request: requestOf({ origin: API_ORIGIN, path: '/oauth/sign-in-links', method: 'POST' }),
        clientName: 'Agent',
        params: new URLSearchParams(AUTHORIZATION_QUERY),
        notice: OAuthNotice.None,
        siteKey: TEST_SITE_KEY,
      }).text(),
  },
  {
    name: 'the admin link page',
    origin: SITE_ORIGIN,
    hasControls: false,
    html: async () => (await serveAdminLinkPage({ request: requestOf({ origin: SITE_ORIGIN, path: '/admin/sign-in' }) })).text(),
  },
  {
    name: 'the OAuth link page',
    origin: API_ORIGIN,
    hasControls: false,
    html: async () => (await serveOAuthLinkPage({ request: requestOf({ origin: API_ORIGIN, path: '/oauth/sign-in' }) })).text(),
  },
  {
    name: 'an OAuth refusal',
    origin: API_ORIGIN,
    hasControls: false,
    html: async () =>
      refusalPageOf({
        request: requestOf({ origin: API_ORIGIN, path: '/oauth/authorize', method: 'POST' }),
        refusal: OAuthRefusal.Forbidden,
      }).text(),
  },
  {
    name: 'the OAuth approved page',
    origin: API_ORIGIN,
    hasControls: false,
    html: async () =>
      approvedPageOf({ request: requestOf({ origin: API_ORIGIN, path: '/oauth/authorize', method: 'POST' }), clientName: 'Agent' }).text(),
  },
  {
    name: 'the OAuth inbox page',
    origin: API_ORIGIN,
    hasControls: false,
    html: async () =>
      inboxPageOf({
        request: requestOf({ origin: API_ORIGIN, path: '/oauth/sign-in-links', method: 'POST' }),
        cookies: [],
        address: ADDRESS,
        params: new URLSearchParams(),
        siteKey: SITE_KEY,
        state: null,
      }).text(),
  },
];

function returnsOf(html: string): string[] {
  return [...html.matchAll(RETURN_PATTERN)].map(([, value]) => required({ value, description: 'a return value' }).replaceAll('&amp;', '&'));
}

describe.each(PAGES)('$name', ({ origin, hasControls, html }) => {
  test(
    hasControls ? 'carries the controls, and every return lands on a page of its own host' : 'carries no language or theme control',
    async () => {
      const rendered = await html();
      const returns = returnsOf(rendered);
      if (!hasControls) {
        expect(returns).toEqual([]);
        expect(rendered).not.toContain('action="/language"');
        expect(rendered).not.toContain('action="/theme"');
        return;
      }
      expect(returns.length).toBeGreaterThan(0);
      for (const returned of returns) {
        for (const [path, form] of [
          ['/language', { language: 'de', return: returned }],
          ['/theme', { theme: 'dark', return: returned }],
        ] as const) {
          const answer = await serve({ origin, path, method: 'POST', form });
          expect(answer.status).toBe(SEE_OTHER_STATUS);
          const location = answer.headers.get('Location');
          if (location === null) throw new Error('a preference form answers with a Location');
          expect(location).toMatch(/^\/(?![/\\])/);
          expect((await serve({ origin, path: location })).status).not.toBe(NOT_FOUND_STATUS);
        }
      }
    },
  );
});
