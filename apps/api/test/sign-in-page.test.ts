import { exports } from 'cloudflare:workers';
import { describe, expect, test } from 'vitest';
import { SIGN_IN_PAGE_COPY } from '../src/sign-in-page-copy';
import { serveSignInPage } from '../src/sign-in-page';
import { workerEnvWith } from './owner-client';
import {
  type PageScriptRun,
  TEST_PAGE_ORIGIN,
  TEST_SITE_KEY,
  WIDGET_ID,
  inlineSources,
  onlyInlineSource,
  runPageScript,
  sourceHash,
} from './page-script';

const PAGE_URL = 'http://localhost:8787/sign-in';
const PAGE_PATH = '/sign-in';
const OK_STATUS = 200;
const NOT_FOUND_STATUS = 404;
const UNAVAILABLE_STATUS = 503;
const TOKEN = 'A'.repeat(43);
const TURNSTILE_TOKEN = 'solved.turnstile_token-1';
const OTHER_TURNSTILE_TOKEN = 'solved.turnstile_token-2';
const TOKEN_SHAPED_RUN_PATTERN = /[A-Za-z0-9_-]{43}/;
const SCRIPT_PATTERN = /<script>([\s\S]*?)<\/script>/g;
const STYLE_PATTERN = /<style>([\s\S]*?)<\/style>/g;
const WIDGET_PATTERN = /<div id="check"[^>]*><\/div>/g;
const TURNSTILE_HOST = 'challenges.cloudflare.com';
const EXPLICIT_TURNSTILE_SCRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
const IMPLICIT_WIDGET_CLASS = 'cf-turnstile';
const SCRIPT_BINDINGS = ['token', 'button', 'check', 'appLink', 'widget', 'fail', 'checked', 'expired', 'loader'];
const READY_STATE = 'ready';
const CHECKING_STATE = 'checking';
const FAILED_STATE = 'failed';
const CHECKED_CALLBACK = 'callback';
const EXPIRED_CALLBACK = 'expired-callback';
const ERROR_CALLBACK = 'error-callback';
const TIMEOUT_CALLBACK = 'timeout-callback';

function appLink(turnstileToken: string): string {
  return `todz://sign-in?token=${TOKEN}&turnstile=${turnstileToken}&origin=${encodeURIComponent(TEST_PAGE_ORIGIN)}`;
}

async function pageSource(path = PAGE_PATH): Promise<{ response: Response; html: string }> {
  const response = await exports.default.fetch(`http://localhost:8787${path}`);
  return { response, html: await response.text() };
}

async function onlyScript(): Promise<string> {
  const { html } = await pageSource();
  return onlyInlineSource({ html, pattern: SCRIPT_PATTERN });
}

async function signInPageRun(hash: string): Promise<PageScriptRun> {
  return runPageScript({ script: await onlyScript(), hash, pathname: PAGE_PATH, probedNames: SCRIPT_BINDINGS });
}

async function checkingRun(): Promise<PageScriptRun> {
  const run = await signInPageRun(`#token=${TOKEN}`);
  run.loadScripts();
  return run;
}

describe('GET /sign-in', () => {
  test('answers the page with the headers that keep it private and inert', async () => {
    const { response } = await pageSource();
    expect(response.status).toBe(OK_STATUS);
    expect(response.headers.get('Content-Type')).toBe('text/html; charset=utf-8');
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(response.headers.get('Referrer-Policy')).toBe('no-referrer');
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
  });

  test('the content security policy allows its own script and style by hash, and Turnstile only as a script and a frame', async () => {
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

  test('says its words from the copy module and carries no token, link or handler of its own', async () => {
    const { html } = await pageSource();
    expect(html).toContain(SIGN_IN_PAGE_COPY.title);
    expect(html).toContain(SIGN_IN_PAGE_COPY.checking);
    expect(html).toContain(SIGN_IN_PAGE_COPY.checkFailed);
    expect(html).toContain(SIGN_IN_PAGE_COPY.opening);
    expect(html).toContain(SIGN_IN_PAGE_COPY.openButton);
    expect(html).toContain(SIGN_IN_PAGE_COPY.notOpened);
    expect(html).toContain(SIGN_IN_PAGE_COPY.missingToken);
    expect(html).not.toMatch(TOKEN_SHAPED_RUN_PATTERN);
    expect(html).not.toMatch(/\son[a-z]+=/);
    expect(html).not.toContain('style=');
  });

  test('ignores a query string, so a token in it is never echoed', async () => {
    const plain = await pageSource();
    const withQuery = await pageSource(`${PAGE_PATH}?token=${TOKEN}`);
    expect(withQuery.response.status).toBe(OK_STATUS);
    expect(withQuery.html).toBe(plain.html);
  });

  test('a method other than GET answers 404 with an empty body', async () => {
    const response = await exports.default.fetch(PAGE_URL, { method: 'POST' });
    expect(response.status).toBe(NOT_FOUND_STATUS);
    expect(await response.text()).toBe('');
  });

  test('without a site key it answers 503 with the unavailable words, no widget and no script', async () => {
    const response = await serveSignInPage({ request: new Request(PAGE_URL), env: workerEnvWith({}) });
    const html = await response.text();
    expect(response.status).toBe(UNAVAILABLE_STATUS);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(html).toContain(SIGN_IN_PAGE_COPY.unavailable);
    expect(html).not.toContain('cf-turnstile');
    expect(html).not.toContain('<script');
  });

  test('a site key that is not a plain key is treated as absent', async () => {
    const response = await serveSignInPage({
      request: new Request(PAGE_URL),
      env: workerEnvWith({ TURNSTILE_SITE_KEY: '"><script>' }),
    });
    expect(response.status).toBe(UNAVAILABLE_STATUS);
    expect(await response.text()).not.toContain('"><script>');
  });
});

describe('the widget of the page', () => {
  test('is one empty container with the site key, and no widget Turnstile would render by itself', async () => {
    const { html } = await pageSource();
    const widgets = [...html.matchAll(WIDGET_PATTERN)].map(([widget]) => widget);
    expect(widgets).toEqual([`<div id="check" class="checking" data-sitekey="${TEST_SITE_KEY}"></div>`]);
    expect(html).not.toContain(IMPLICIT_WIDGET_CLASS);
  });

  test('the markup loads no Turnstile script of its own', async () => {
    const { html } = await pageSource();
    expect(html.replace(SCRIPT_PATTERN, '')).not.toContain(TURNSTILE_HOST);
  });

  test('a valid link token loads the explicit Turnstile script once and renders nothing before it loads', async () => {
    const { loadedScripts, renders } = await signInPageRun(`#token=${TOKEN}`);
    expect(loadedScripts()).toEqual([EXPLICIT_TURNSTILE_SCRIPT]);
    expect(renders()).toEqual([]);
  });

  test('once the script loads, it renders one widget in the container with the site key, the sign_in action and its four callbacks', async () => {
    const { renders } = await checkingRun();
    const [render, ...others] = renders();
    expect(others).toEqual([]);
    expect(render?.container.dataset.sitekey).toBe(TEST_SITE_KEY);
    expect(render?.options).toMatchObject({ sitekey: TEST_SITE_KEY, action: 'sign_in', 'refresh-expired': 'manual' });
    [CHECKED_CALLBACK, EXPIRED_CALLBACK, ERROR_CALLBACK, TIMEOUT_CALLBACK].forEach((name) =>
      expect(typeof render?.options[name]).toBe('function'),
    );
  });
});

describe('the script of the page', () => {
  test('binds nothing at the top level, so no other script can read the link token by name', async () => {
    const { leakedNames } = await checkingRun();
    expect(leakedNames()).toEqual([]);
  });

  test('puts nothing on window', async () => {
    const { callbackNames } = await checkingRun();
    expect(callbackNames()).toEqual([]);
  });

  test('drops the fragment and waits in the checking state, opening nothing before the check', async () => {
    const { steps, state } = await checkingRun();
    expect(steps).toEqual([`replace ${PAGE_PATH}`]);
    expect(state()).toBe(CHECKING_STATE);
  });

  test('a solved check shows the opening state, focuses the button and opens the app with both tokens and the page origin', async () => {
    const { steps, state, widgetCallback } = await checkingRun();
    widgetCallback({ name: CHECKED_CALLBACK, argument: TURNSTILE_TOKEN });
    expect(steps).toEqual([`replace ${PAGE_PATH}`, 'focus', `navigate ${appLink(TURNSTILE_TOKEN)}`]);
    expect(state()).toBe(READY_STATE);
  });

  test('the origin in the app link is read from the page at run time, so the script stays one source for its hash', async () => {
    const { steps, widgetCallback } = await checkingRun();
    widgetCallback({ name: CHECKED_CALLBACK, argument: TURNSTILE_TOKEN });
    expect(steps.at(-1)).toMatch(/&origin=http%3A%2F%2Flocalhost%3A8787$/);
    expect(await onlyScript()).not.toContain(TEST_PAGE_ORIGIN);
  });

  test('the button opens the app again with the same tokens', async () => {
    const { steps, widgetCallback, pressButton } = await checkingRun();
    widgetCallback({ name: CHECKED_CALLBACK, argument: TURNSTILE_TOKEN });
    pressButton();
    expect(steps.slice(-1)).toEqual([`navigate ${appLink(TURNSTILE_TOKEN)}`]);
    expect(steps).toHaveLength(4);
  });

  test.each([
    ['an empty', ''],
    ['a spaced', 'a b'],
    ['a 2049-character', 'a'.repeat(2049)],
    ['a parameter-smuggling', 'x&token=other'],
  ])('%s Turnstile token opens nothing and shows the failed state', async (_name, turnstileToken) => {
    const { steps, state, widgetCallback } = await checkingRun();
    widgetCallback({ name: CHECKED_CALLBACK, argument: turnstileToken });
    expect(steps).toEqual([`replace ${PAGE_PATH}`]);
    expect(state()).toBe(FAILED_STATE);
  });

  test('an expired check goes back to checking and resets its widget', async () => {
    const { steps, state, widgetCallback, resets } = await checkingRun();
    widgetCallback({ name: CHECKED_CALLBACK, argument: TURNSTILE_TOKEN });
    widgetCallback({ name: EXPIRED_CALLBACK });
    expect(state()).toBe(CHECKING_STATE);
    expect(resets()).toEqual([WIDGET_ID]);
    expect(steps).toHaveLength(3);
  });

  test('a check solved again after it expired updates the button without opening the app by itself', async () => {
    const { steps, state, widgetCallback, pressButton } = await checkingRun();
    widgetCallback({ name: CHECKED_CALLBACK, argument: TURNSTILE_TOKEN });
    widgetCallback({ name: EXPIRED_CALLBACK });
    widgetCallback({ name: CHECKED_CALLBACK, argument: OTHER_TURNSTILE_TOKEN });
    expect(state()).toBe(READY_STATE);
    expect(steps).toHaveLength(3);
    pressButton();
    expect(steps.slice(-1)).toEqual([`navigate ${appLink(OTHER_TURNSTILE_TOKEN)}`]);
  });

  test.each([[ERROR_CALLBACK], [TIMEOUT_CALLBACK]])('the widget %s shows the failed state', async (name) => {
    const { state, widgetCallback } = await checkingRun();
    widgetCallback({ name });
    expect(state()).toBe(FAILED_STATE);
  });

  test.each([
    [''],
    ['#'],
    ['#token='],
    [`#token=${'A'.repeat(42)}`],
    [`#token=${'A'.repeat(44)}`],
    [`#token=${'A'.repeat(42)}!`],
    [`#token=${TOKEN}%0A`],
    [`#other=${TOKEN}`],
    [`#token=${TOKEN}/../../x`],
  ])('the fragment %j opens nothing, is dropped, runs no challenge and leaves the missing-token state', async (hash) => {
    const { steps, state, callbackNames, loadedScripts, loadScripts, renders } = await signInPageRun(hash);
    loadScripts();
    expect(steps).toEqual([`replace ${PAGE_PATH}`]);
    expect(state()).toBeUndefined();
    expect(callbackNames()).toEqual([]);
    expect(loadedScripts()).toEqual([]);
    expect(renders()).toEqual([]);
  });
});

describe('the markup of the page', () => {
  test('starts in the missing-token state: a real button, no app link outside the script, the missing-token words shown', async () => {
    const { html } = await pageSource();
    const markup = html.replace(SCRIPT_PATTERN, '');
    expect(markup).not.toContain('todz://');
    expect(markup).toMatch(/<button id="open"/);
    expect(markup).not.toMatch(/<a\s/);
    expect(markup).toContain(`<p class="missing">${SIGN_IN_PAGE_COPY.missingToken}</p>`);
    expect(markup).toMatch(/\[data-state=ready\]/);
    expect(markup).toMatch(/\[data-state=checking\]/);
    expect(markup).toMatch(/\[data-state=failed\]/);
  });

  test('draws the app icon at 64 pixels and the system colours, with no hex value', async () => {
    const { html } = await pageSource();
    const style = onlyInlineSource({ html, pattern: STYLE_PATTERN });
    expect(html).toMatch(/<svg[^>]* width="64" height="64"/);
    expect(html).toContain('M300 532 L448 680 L724 404');
    expect(style).toContain('color-scheme:light dark');
    ['Canvas', 'CanvasText', 'GrayText', 'AccentColor', 'AccentColorText'].forEach((keyword) => expect(style).toContain(keyword));
    expect(style).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });

  test('has exactly one inline script and one inline style', async () => {
    const { html } = await pageSource();
    expect(inlineSources({ html, pattern: SCRIPT_PATTERN })).toHaveLength(1);
    expect(inlineSources({ html, pattern: STYLE_PATTERN })).toHaveLength(1);
  });
});
