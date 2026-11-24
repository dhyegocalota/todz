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

function runPageScript({ script, hash }: { script: string; hash: string }): { steps: string[]; openedHref: string } {
  const steps: string[] = [];
  const anchor = { href: '' };
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
  const document = { getElementById: () => anchor };
  new Function('location', 'history', 'document', script)(location, history, document);
  return { steps, openedHref: anchor.href };
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
    expect(html).toContain(SIGN_IN_PAGE_COPY.heading);
    expect(html).toContain(SIGN_IN_PAGE_COPY.hint);
    expect(html).toContain(SIGN_IN_PAGE_COPY.button);
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
  test('drops the fragment before it opens the app with the token it read', async () => {
    const { steps, openedHref } = runPageScript({ script: await onlyScript(), hash: `#token=${TOKEN}` });
    expect(steps).toEqual([`replace ${PAGE_PATH}`, `navigate todz://sign-in?token=${TOKEN}`]);
    expect(openedHref).toBe(`todz://sign-in?token=${TOKEN}`);
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
  ])('the fragment %j opens nothing', async (hash) => {
    const { steps, openedHref } = runPageScript({ script: await onlyScript(), hash });
    expect(steps).toEqual([]);
    expect(openedHref).toBe('');
  });
});
