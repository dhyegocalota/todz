import { exports } from 'cloudflare:workers';
import { describe, expect, test } from 'vitest';
import { SIGN_IN_PAGE_COPY } from '../src/sign-in-page-copy';

const PAGE_URL = 'https://api.todz.test/sign-in';
const PAGE_PATH = '/sign-in';
const OK_STATUS = 200;
const NOT_FOUND_STATUS = 404;
const TOKEN = 'A'.repeat(43);
const TOKEN_SHAPED_RUN_PATTERN = /[A-Za-z0-9_-]{43}/;
const SCRIPT_PATTERN = /<script>([\s\S]*?)<\/script>/g;
const STYLE_PATTERN = /<style>([\s\S]*?)<\/style>/g;
const CONTENT_GROUP = 1;
const READY_STATE = 'ready';
const BASE64_ALGORITHM = 'SHA-256';

async function sourceHash(source: string): Promise<string> {
  const digest = await crypto.subtle.digest(BASE64_ALGORITHM, new TextEncoder().encode(source));
  return `'sha256-${btoa(String.fromCharCode(...new Uint8Array(digest)))}'`;
}

function inlineSources({ html, pattern }: { html: string; pattern: RegExp }): string[] {
  return [...html.matchAll(pattern)].map((match) => {
    const [, source] = match;
    if (source === undefined) throw new Error('an inline element always has content');
    return source;
  });
}

function onlyInlineSource({ html, pattern }: { html: string; pattern: RegExp }): string {
  const [source, ...others] = inlineSources({ html, pattern });
  if (source === undefined || others.length > 0) throw new Error('the page has exactly one inline element of that kind');
  return source;
}

async function pageSource(path = PAGE_PATH): Promise<{ response: Response; html: string }> {
  const response = await exports.default.fetch(`https://api.todz.test${path}`);
  return { response, html: await response.text() };
}

function runPageScript({ script, hash }: { script: string; hash: string }): {
  steps: string[];
  state: string | undefined;
  pressButton: () => void;
} {
  const steps: string[] = [];
  const pressListeners: (() => void)[] = [];
  const button = {
    focus() {
      steps.push('focus');
    },
    addEventListener(_type: string, listener: () => void) {
      pressListeners.push(listener);
    },
  };
  const body = { dataset: {} as Record<string, string> };
  const location = {
    hash,
    pathname: PAGE_PATH,
    set href(target: string) {
      steps.push(`navigate ${target}`);
    },
  };
  const history = {
    replaceState(_state: unknown, _title: string, address: string) {
      steps.push(`replace ${address}`);
    },
  };
  const document = { body, getElementById: () => button };
  new Function('location', 'history', 'document', script)(location, history, document);
  return { steps, state: body.dataset.state, pressButton: () => pressListeners.forEach((listener) => listener()) };
}

async function onlyScript(): Promise<string> {
  const { html } = await pageSource();
  return onlyInlineSource({ html, pattern: SCRIPT_PATTERN });
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

  test('the content security policy allows only its own script and style, by hash', async () => {
    const { response, html } = await pageSource();
    const script = onlyInlineSource({ html, pattern: SCRIPT_PATTERN });
    const style = onlyInlineSource({ html, pattern: STYLE_PATTERN });
    expect(response.headers.get('Content-Security-Policy')).toBe(
      [
        "default-src 'none'",
        `script-src ${await sourceHash(script)}`,
        `style-src ${await sourceHash(style)}`,
        'img-src data:',
        "base-uri 'none'",
        "form-action 'none'",
        "frame-ancestors 'none'",
      ].join('; '),
    );
  });

  test('says its words from the copy module and carries no token, link or handler of its own', async () => {
    const { html } = await pageSource();
    expect(html).toContain(SIGN_IN_PAGE_COPY.title);
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
});

describe('the script of the page', () => {
  test('drops the fragment, shows the opening state, focuses the button and opens the app with the token it read', async () => {
    const { steps, state } = runPageScript({ script: await onlyScript(), hash: `#token=${TOKEN}` });
    expect(steps).toEqual([`replace ${PAGE_PATH}`, 'focus', `navigate todz://sign-in?token=${TOKEN}`]);
    expect(state).toBe(READY_STATE);
  });

  test('the button opens the app again with the same token', async () => {
    const { steps, pressButton } = runPageScript({ script: await onlyScript(), hash: `#token=${TOKEN}` });
    pressButton();
    expect(steps.slice(-1)).toEqual([`navigate todz://sign-in?token=${TOKEN}`]);
    expect(steps).toHaveLength(4);
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
  ])('the fragment %j opens nothing, is dropped and leaves the missing-token state', async (hash) => {
    const { steps, state } = runPageScript({ script: await onlyScript(), hash });
    expect(steps).toEqual([`replace ${PAGE_PATH}`]);
    expect(state).toBeUndefined();
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
});
