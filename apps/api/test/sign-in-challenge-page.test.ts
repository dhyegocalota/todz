import { exports } from 'cloudflare:workers';
import { describe, expect, test } from 'vitest';
import { serveSignInChallengePage } from '../src/sign-in-challenge-page';
import { SIGN_IN_PAGE_COPY } from '../src/sign-in-page-copy';
import { workerEnvWith } from './owner-client';
import { TEST_SITE_KEY, onlyInlineSource, runPageScript, sourceHash } from './page-script';

const PAGE_PATH = '/sign-in/challenge';
const PAGE_URL = `http://localhost:8787${PAGE_PATH}`;
const OK_STATUS = 200;
const NOT_FOUND_STATUS = 404;
const UNAVAILABLE_STATUS = 503;
const TURNSTILE_TOKEN = 'solved.turnstile_token-1';
const SCRIPT_PATTERN = /<script>([\s\S]*?)<\/script>/g;
const STYLE_PATTERN = /<style>([\s\S]*?)<\/style>/g;
const WIDGET_PATTERN = /<div class="cf-turnstile"[^>]*><\/div>/g;
const TURNSTILE_SCRIPT_TAG = '<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>';
const SOLVED_CALLBACK = 'challengeSolved';
const LOST_CALLBACK = 'challengeLost';

async function pageSource(path = PAGE_PATH): Promise<{ response: Response; html: string }> {
  const response = await exports.default.fetch(`http://localhost:8787${path}`);
  return { response, html: await response.text() };
}

async function challengeRun(): Promise<ReturnType<typeof runPageScript>> {
  const { html } = await pageSource();
  return runPageScript({ script: onlyInlineSource({ html, pattern: SCRIPT_PATTERN }), hash: '', pathname: PAGE_PATH });
}

describe('GET /sign-in/challenge', () => {
  test('answers the page with the headers of the sign-in page', async () => {
    const { response } = await pageSource();
    expect(response.status).toBe(OK_STATUS);
    expect(response.headers.get('Content-Type')).toBe('text/html; charset=utf-8');
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(response.headers.get('Referrer-Policy')).toBe('no-referrer');
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
  });

  test('the content security policy is the sign-in page one with its own hashes', async () => {
    const { response, html } = await pageSource();
    const script = onlyInlineSource({ html, pattern: SCRIPT_PATTERN });
    const style = onlyInlineSource({ html, pattern: STYLE_PATTERN });
    expect(response.headers.get('Content-Security-Policy')).toBe(
      [
        "default-src 'none'",
        `script-src ${await sourceHash(script)} https://challenges.cloudflare.com`,
        `style-src ${await sourceHash(style)}`,
        'img-src data:',
        'frame-src https://challenges.cloudflare.com',
        "base-uri 'none'",
        "form-action 'none'",
        "frame-ancestors 'none'",
      ].join('; '),
    );
  });

  test('renders one widget with the site key, the request_link action and the four callbacks', async () => {
    const { html } = await pageSource();
    const widgets = [...html.matchAll(WIDGET_PATTERN)].map(([widget]) => widget);
    expect(widgets).toEqual([
      `<div class="cf-turnstile" data-sitekey="${TEST_SITE_KEY}" data-action="request_link" data-callback="${SOLVED_CALLBACK}" data-expired-callback="${LOST_CALLBACK}" data-error-callback="${LOST_CALLBACK}" data-timeout-callback="${LOST_CALLBACK}"></div>`,
    ]);
  });

  test('loads the Turnstile script once, after the inline script, async and deferred', async () => {
    const { html } = await pageSource();
    expect(html.split(TURNSTILE_SCRIPT_TAG)).toHaveLength(2);
    expect(html.indexOf('<script>')).toBeLessThan(html.indexOf(TURNSTILE_SCRIPT_TAG));
  });

  test('carries its title from the copy module, no link and no handler of its own', async () => {
    const { html } = await pageSource();
    expect(html).toContain(`<title>${SIGN_IN_PAGE_COPY.challengeTitle}</title>`);
    expect(html).not.toContain('todz://');
    expect(html).not.toMatch(/\son[a-z]+=/);
    expect(html).not.toContain('style=');
  });

  test('ignores a query string', async () => {
    const plain = await pageSource();
    const withQuery = await pageSource(`${PAGE_PATH}?token=${TURNSTILE_TOKEN}`);
    expect(withQuery.html).toBe(plain.html);
  });

  test('a method other than GET answers 404 with an empty body', async () => {
    const response = await exports.default.fetch(PAGE_URL, { method: 'POST' });
    expect(response.status).toBe(NOT_FOUND_STATUS);
    expect(await response.text()).toBe('');
  });

  test('without a site key it answers 503 with the unavailable words and no widget', async () => {
    const response = await serveSignInChallengePage({ request: new Request(PAGE_URL), env: workerEnvWith({}) });
    const html = await response.text();
    expect(response.status).toBe(UNAVAILABLE_STATUS);
    expect(html).toContain(SIGN_IN_PAGE_COPY.unavailable);
    expect(html).not.toContain('cf-turnstile');
    expect(html).not.toContain('<script');
  });
});

describe('the script of the challenge page', () => {
  test('posts a solved token to the turnstile message handler', async () => {
    const { posted, callback } = await challengeRun();
    callback({ name: SOLVED_CALLBACK, argument: TURNSTILE_TOKEN });
    expect(posted).toEqual([TURNSTILE_TOKEN]);
  });

  test('posts an empty string when the token expires, the widget errors or it times out', async () => {
    const { posted, callback } = await challengeRun();
    callback({ name: LOST_CALLBACK });
    expect(posted).toEqual(['']);
  });

  test('wires only its two callbacks and navigates nowhere', async () => {
    const { steps, callbackNames } = await challengeRun();
    expect(callbackNames().sort()).toEqual([LOST_CALLBACK, SOLVED_CALLBACK]);
    expect(steps).toEqual([]);
  });
});
