import { required } from './required';
import { LANGUAGE_PROFILES, Language } from '@todz/types';
import { createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { describe, expect, test } from 'vitest';
import type { Env } from '../src/env';
import worker from '../src/index';
import { publicPathOf } from '../src/site/language-paths';
import { workerEnvWith } from './owner-client';

const API_ORIGIN = 'https://api.todz.app';
const SITE_ORIGIN = 'https://todz.app';
const PRODUCTION_SETTINGS = { PUBLIC_ORIGIN: API_ORIGIN, SITE_ORIGIN, SIGN_IN_PROVIDER: 'fake' };
const BROWSER_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15';
const CRAWLER_USER_AGENTS = ['Googlebot/2.1', 'Mozilla/5.0 (compatible; GPTBot/1.1)', 'Mozilla/5.0 (compatible; ClaudeBot/1.0)'];
const FORM_CONTENT_TYPE = 'application/x-www-form-urlencoded';
const LANGUAGE_COOKIE = 'todz_language';
const THEME_COOKIE = 'todz_theme';
const ONE_YEAR_SECONDS = 31_536_000;
const OK_STATUS = 200;
const MOVED_PERMANENTLY_STATUS = 301;
const FOUND_STATUS = 302;
const SEE_OTHER_STATUS = 303;
const BAD_REQUEST_STATUS = 400;
const FORBIDDEN_STATUS = 403;
const NOT_FOUND_STATUS = 404;
const SAME_ORIGIN_HEADERS = { Origin: SITE_ORIGIN };
const REFUSED_HEADERS: Record<string, string>[] = [{ 'Sec-Fetch-Site': 'cross-site' }, { Origin: 'https://evil.example' }, {}];
const OTHER_LANGUAGES = Object.values(Language).filter((language) => language !== Language.English);
const SCRIPT_HASH_PATTERN = /^'sha256-[A-Za-z0-9+/=]+'$/;
const SIGN_IN_PATH = '/sign-in';
const OAUTH_LINK_PATH = '/oauth/sign-in';
const DAY_EMAIL_STOP_URL = `${API_ORIGIN}/day-email/stop?token=${'a'.repeat(64)}`;
const HOSTILE_RETURNS = [
  'https://evil.example/',
  '//evil.example',
  '/\\evil.example',
  '/unknown-page',
  'javascript:alert(1)',
  '',
  '/pt-br/other',
];

type EdgeRequest = Request<unknown, IncomingRequestCfProperties>;

async function serve({
  url,
  method = 'GET',
  headers = {},
  body,
  settings = {},
}: {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  settings?: Partial<Env>;
}): Promise<Response> {
  const request = new Request(url, { method, headers, body, redirect: 'manual' });
  const executionContext = createExecutionContext();
  const response = await worker.fetch(request as EdgeRequest, workerEnvWith({ ...PRODUCTION_SETTINGS, ...settings }), executionContext);
  await waitOnExecutionContext(executionContext);
  return response;
}

function visit({ path, headers = {}, origin = SITE_ORIGIN }: { path: string; headers?: Record<string, string>; origin?: string }) {
  return serve({ url: `${origin}${path}`, headers: { 'User-Agent': BROWSER_USER_AGENT, ...headers } });
}

function post({
  path,
  form,
  headers = SAME_ORIGIN_HEADERS,
  origin = SITE_ORIGIN,
  settings = {},
}: {
  path: string;
  form: Record<string, string>;
  headers?: Record<string, string>;
  origin?: string;
  settings?: Partial<Env>;
}) {
  const body = new URLSearchParams(form).toString();
  return serve({
    url: `${origin}${path}`,
    method: 'POST',
    headers: { 'Content-Type': FORM_CONTENT_TYPE, 'Content-Length': String(new TextEncoder().encode(body).length), ...headers },
    body,
    settings,
  });
}

function escapedPattern(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function cookieOf({ response, name }: { response: Response; name: string }): string | null {
  const cookie = response.headers.getSetCookie().find((candidate) => candidate.startsWith(`${name}=`));
  if (cookie === undefined) return null;
  return cookie;
}

function elementsOf({ html, pattern }: { html: string; pattern: RegExp }): RegExpMatchArray[] {
  return [...html.matchAll(pattern)];
}

describe('the first visit to the landing', () => {
  test('redirects a browser whose Accept-Language best matches another language, and sets the cookie', async () => {
    const response = await visit({ path: '/', headers: { 'Accept-Language': 'ja,en;q=0.5' } });
    expect(response.status).toBe(FOUND_STATUS);
    expect(response.headers.get('Location')).toBe('/ja/');
    const cookie = cookieOf({ response, name: LANGUAGE_COOKIE });
    expect(cookie).toBe(`${LANGUAGE_COOKIE}=ja; Path=/; SameSite=Lax; Secure; Max-Age=${ONE_YEAR_SECONDS}`);
    expect(cookie).not.toContain('Domain');
  });

  test('keeps the query of the cloud queue page through the redirect', async () => {
    const response = await visit({ path: '/cloud-queue?token=abc.def', headers: { 'Accept-Language': 'de-DE' } });
    expect(response.status).toBe(FOUND_STATUS);
    expect(response.headers.get('Location')).toBe('/de/cloud-queue?token=abc.def');
    expect(cookieOf({ response, name: LANGUAGE_COOKIE })).toContain(`${LANGUAGE_COOKIE}=de;`);
  });

  test('answers Vary with Cookie and Accept-Language on the redirect and on the English page', async () => {
    const redirect = await visit({ path: '/', headers: { 'Accept-Language': 'es' } });
    const english = await visit({ path: '/' });
    [redirect, english].forEach((response) => {
      const vary = response.headers.get('Vary');
      expect(vary).toContain('Cookie');
      expect(vary).toContain('Accept-Language');
    });
  });

  test('answers Vary with Cookie and Accept-Language on the English cloud queue page too', async () => {
    const response = await visit({ path: '/cloud-queue' });
    expect(response.status).not.toBe(NOT_FOUND_STATUS);
    expect(response.headers.get('Vary')).toContain('Cookie');
    expect(response.headers.get('Vary')).toContain('Accept-Language');
  });

  test('serves English and sets nothing when Accept-Language prefers English', async () => {
    const response = await visit({ path: '/', headers: { 'Accept-Language': 'en-US,en;q=0.9,ja;q=0.5' } });
    expect(response.status).toBe(OK_STATUS);
    expect(response.headers.getSetCookie()).toEqual([]);
  });

  test('serves English and sets nothing with no Accept-Language, with an unsupported one and with Traditional Chinese', async () => {
    const responses = await Promise.all([
      visit({ path: '/' }),
      visit({ path: '/', headers: { 'Accept-Language': 'it-IT,it;q=0.9' } }),
      visit({ path: '/', headers: { 'Accept-Language': 'zh-TW' } }),
      visit({ path: '/', headers: { 'Accept-Language': 'ja;q=0' } }),
    ]);
    responses.forEach((response) => {
      expect(response.status).toBe(OK_STATUS);
      expect(response.headers.getSetCookie()).toEqual([]);
    });
  });

  test.each(CRAWLER_USER_AGENTS)('never redirects %s', async (userAgent) => {
    const response = await serve({ url: `${SITE_ORIGIN}/`, headers: { 'User-Agent': userAgent, 'Accept-Language': 'ja' } });
    expect(response.status).toBe(OK_STATUS);
    expect(response.headers.getSetCookie()).toEqual([]);
  });

  test('never redirects a request for Markdown', async () => {
    const response = await visit({ path: '/', headers: { 'Accept-Language': 'ja', Accept: 'text/markdown' } });
    expect(response.status).toBe(OK_STATUS);
    expect(response.headers.get('Content-Type')).toContain('text/markdown');
  });

  test('redirects a HEAD request the same way', async () => {
    const response = await serve({
      url: `${SITE_ORIGIN}/`,
      method: 'HEAD',
      headers: { 'User-Agent': BROWSER_USER_AGENT, 'Accept-Language': 'ko' },
    });
    expect(response.status).toBe(FOUND_STATUS);
    expect(response.headers.get('Location')).toBe('/ko/');
  });
});

describe('the language cookie on the landing', () => {
  test.each(OTHER_LANGUAGES)('redirects to the prefix of %s and sets nothing again', async (language) => {
    const response = await visit({ path: '/', headers: { Cookie: `${LANGUAGE_COOKIE}=${language}`, 'Accept-Language': 'fr' } });
    expect(response.status).toBe(FOUND_STATUS);
    expect(response.headers.get('Location')).toBe(publicPathOf({ language, path: '/' }));
    expect(response.headers.getSetCookie()).toEqual([]);
  });

  test('serves English for a cookie of English, whatever Accept-Language says', async () => {
    const response = await visit({ path: '/', headers: { Cookie: `${LANGUAGE_COOKIE}=en`, 'Accept-Language': 'ja' } });
    expect(response.status).toBe(OK_STATUS);
  });

  test('ignores a cookie outside the enum and falls to Accept-Language', async () => {
    const response = await visit({ path: '/', headers: { Cookie: `${LANGUAGE_COOKIE}=klingon`, 'Accept-Language': 'es' } });
    expect(response.status).toBe(FOUND_STATUS);
    expect(response.headers.get('Location')).toBe('/es/');
  });

  test('redirects the cloud queue page by the cookie too', async () => {
    const response = await visit({ path: '/cloud-queue?token=x', headers: { Cookie: `${LANGUAGE_COOKIE}=zh` } });
    expect(response.status).toBe(FOUND_STATUS);
    expect(response.headers.get('Location')).toBe('/zh/cloud-queue?token=x');
  });
});

describe('a prefixed page', () => {
  test.each(OTHER_LANGUAGES)('%s never redirects, whatever the cookie and Accept-Language say', async (language) => {
    const { pathPrefix } = LANGUAGE_PROFILES[language];
    const response = await visit({ path: `${pathPrefix}/`, headers: { Cookie: `${LANGUAGE_COOKIE}=ja`, 'Accept-Language': 'de' } });
    expect(response.status).toBe(OK_STATUS);
    expect(response.headers.getSetCookie()).toEqual([]);
  });

  test.each(OTHER_LANGUAGES)('%s without its trailing slash answers 301 to the slash', async (language) => {
    const { pathPrefix } = LANGUAGE_PROFILES[language];
    const response = await visit({ path: pathPrefix });
    expect(response.status).toBe(MOVED_PERMANENTLY_STATUS);
    expect(response.headers.get('Location')).toBe(`${pathPrefix}/`);
  });

  test('keeps the query when it adds the slash', async () => {
    const response = await visit({ path: '/pt-br?utm=x' });
    expect(response.status).toBe(MOVED_PERMANENTLY_STATUS);
    expect(response.headers.get('Location')).toBe('/pt-br/?utm=x');
  });

  test('answers HEAD like GET', async () => {
    const response = await serve({ url: `${SITE_ORIGIN}/ja/`, method: 'HEAD', headers: { 'User-Agent': BROWSER_USER_AGENT } });
    expect(response.status).toBe(OK_STATUS);
  });

  test.each(['/en/', '/pt-br/nowhere', '/xx/'])('answers 404 for %s', async (path) => {
    expect((await visit({ path })).status).toBe(NOT_FOUND_STATUS);
  });

  test('serves the cloud queue page of a language at its own prefix', async () => {
    const response = await visit({ path: '/pt-br/cloud-queue' });
    expect(response.status).not.toBe(NOT_FOUND_STATUS);
    expect(await response.text()).toContain('<html lang="pt-BR"');
  });
});

describe('the head of a public page', () => {
  test.each(Object.values(Language))('%s carries its lang, canonical, alternates and Open Graph locales', async (language) => {
    const { pathPrefix, htmlLang, openGraphLocale } = LANGUAGE_PROFILES[language];
    const html = await (await visit({ path: `${pathPrefix}/` })).text();
    expect(html).toContain(`<html lang="${htmlLang}"`);
    expect(html).toContain(`<link rel="canonical" href="${SITE_ORIGIN}${pathPrefix}/">`);
    expect(html).toContain(`<meta property="og:url" content="${SITE_ORIGIN}${pathPrefix}/">`);
    expect(html).toContain(`<meta property="og:locale" content="${openGraphLocale}">`);
    const alternates = elementsOf({ html, pattern: /<meta property="og:locale:alternate" content="([^"]+)">/g }).map(
      ([, locale]) => locale,
    );
    const expectedAlternates = Object.values(LANGUAGE_PROFILES)
      .map((profile) => profile.openGraphLocale)
      .filter((locale) => locale !== openGraphLocale);
    expect(alternates.sort()).toEqual(expectedAlternates.sort());
  });

  test('lists the eight languages and x-default, in every language', async () => {
    const html = await (await visit({ path: '/ja/' })).text();
    const alternates = elementsOf({ html, pattern: /<link rel="alternate" hreflang="([^"]+)" href="([^"]+)">/g });
    const expected = Object.values(LANGUAGE_PROFILES).map(({ htmlLang, pathPrefix }) => [htmlLang, `${SITE_ORIGIN}${pathPrefix}/`]);
    expect(alternates.map(([, hreflang, href]) => [hreflang, href])).toEqual([...expected, ['x-default', `${SITE_ORIGIN}/`]]);
  });

  test('puts x-default on the English URL of the cloud queue page too', async () => {
    const html = await (await visit({ path: '/de/cloud-queue' })).text();
    expect(html).toContain(`<link rel="alternate" hreflang="x-default" href="${SITE_ORIGIN}/cloud-queue">`);
    expect(html).toContain(`<link rel="alternate" hreflang="de" href="${SITE_ORIGIN}/de/cloud-queue">`);
  });

  test.each(Object.values(Language))('%s names its language in the JSON-LD', async (language) => {
    const { pathPrefix, htmlLang } = LANGUAGE_PROFILES[language];
    const html = await (await visit({ path: `${pathPrefix}/` })).text();
    const json = required({
      value: html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)?.[1],
      description: 'the JSON-LD',
    });
    expect(JSON.parse(json)['@graph'].find((node: { '@type': string }) => node['@type'] === 'WebSite').inLanguage).toBe(htmlLang);
  });
});

describe('the sitemap', () => {
  test('lists the landing of every language with eight alternates and x-default', async () => {
    const xml = await (await visit({ path: '/sitemap.xml' })).text();
    const urls = elementsOf({ html: xml, pattern: /<url>([\s\S]*?)<\/url>/g }).map(([, block]) =>
      required({ value: block, description: 'a sitemap entry' }),
    );
    expect(urls).toHaveLength(Object.values(Language).length);
    expect(xml).toContain('xmlns:xhtml="http://www.w3.org/1999/xhtml"');
    Object.values(LANGUAGE_PROFILES).forEach(({ pathPrefix }) => {
      const block = urls.find((candidate) => candidate.includes(`<loc>${SITE_ORIGIN}${pathPrefix}/</loc>`));
      expect(block).toBeDefined();
      expect(
        elementsOf({
          html: required({ value: block, description: 'its sitemap entry' }),
          pattern: /<xhtml:link rel="alternate" hreflang="[^"]+" href="[^"]+"\/>/g,
        }),
      ).toHaveLength(Object.values(Language).length + 1);
      expect(block).toContain(`<xhtml:link rel="alternate" hreflang="x-default" href="${SITE_ORIGIN}/"/>`);
    });
  });
});

describe('the selector', () => {
  test.each(Object.values(Language))('on the page of %s, shows the eight native names and marks the current one', async (language) => {
    const { pathPrefix } = LANGUAGE_PROFILES[language];
    const html = await (await visit({ path: `${pathPrefix}/` })).text();
    expect(html).toContain('<form class="language-form" method="post" action="/language">');
    expect(html).toContain(`<input type="hidden" name="return" value="${pathPrefix}/">`);
    Object.entries(LANGUAGE_PROFILES).forEach(([candidate, profile]) => {
      const button = new RegExp(
        `<button[^>]*name="language"[^>]*value="${candidate}"[^>]*>(?:<svg[^>]*data-flag[\\s\\S]*?</svg>)?${escapedPattern(profile.nativeName)}</button>`,
      );
      expect(html).toMatch(button);
    });
    const current = elementsOf({
      html,
      pattern: /<button[^>]*name="language"[^>]*aria-current="true"[^>]*>(?:<svg[\s\S]*?<\/svg>)?([^<]*)<\/button>/g,
    });
    expect(current.map(([, name]) => name)).toEqual([LANGUAGE_PROFILES[language].nativeName]);
  });

  test('is on the admin sign-in page, returning to the admin', async () => {
    const html = await (await visit({ path: '/admin' })).text();
    expect(html).toContain('<form class="language-form" method="post" action="/language">');
    expect(html).toContain('<input type="hidden" name="return" value="/admin">');
  });
});

describe('POST /language', () => {
  test('sets the cookie and answers 303 to the twin of the page in the chosen language', async () => {
    const response = await post({ path: '/language', form: { language: 'ja', return: '/cloud-queue' } });
    expect(response.status).toBe(SEE_OTHER_STATUS);
    expect(response.headers.get('Location')).toBe('/ja/cloud-queue');
    expect(cookieOf({ response, name: LANGUAGE_COOKIE })).toBe(
      `${LANGUAGE_COOKIE}=ja; Path=/; SameSite=Lax; Secure; Max-Age=${ONE_YEAR_SECONDS}`,
    );
  });

  test.each([
    ['en', '/pt-br/', '/'],
    ['es', '/ja/cloud-queue?token=abc', '/es/cloud-queue?token=abc'],
    ['pt-BR', '/', '/pt-br/'],
    ['zh', '/ko/', '/zh/'],
  ])('%s from %s goes to %s', async (language, returned, expected) => {
    const response = await post({ path: '/language', form: { language, return: returned } });
    expect(response.status).toBe(SEE_OTHER_STATUS);
    expect(response.headers.get('Location')).toBe(expected);
  });

  test('accepts a same-origin Sec-Fetch-Site in place of Origin', async () => {
    const response = await post({ path: '/language', form: { language: 'fr', return: '/' }, headers: { 'Sec-Fetch-Site': 'same-origin' } });
    expect(response.status).toBe(SEE_OTHER_STATUS);
  });

  test.each(REFUSED_HEADERS)('refuses %j and sets nothing', async (headers) => {
    const response = await post({ path: '/language', form: { language: 'ja', return: '/' }, headers });
    expect(response.status).toBe(FORBIDDEN_STATUS);
    expect(response.headers.getSetCookie()).toEqual([]);
  });

  test.each(HOSTILE_RETURNS)('sends %j to the language home and never off the host', async (returned) => {
    const response = await post({ path: '/language', form: { language: 'ja', return: returned } });
    expect(response.status).toBe(SEE_OTHER_STATUS);
    expect(response.headers.get('Location')).toBe('/ja/');
  });

  test('sends a missing return to the language home', async () => {
    const response = await post({ path: '/language', form: { language: 'de' } });
    expect(response.status).toBe(SEE_OTHER_STATUS);
    expect(response.headers.get('Location')).toBe('/de/');
  });

  test.each(['xx', 'pt-br', '', '__proto__'])('refuses language %j with 400 and no cookie', async (language) => {
    const response = await post({ path: '/language', form: { language, return: '/' } });
    expect(response.status).toBe(BAD_REQUEST_STATUS);
    expect(response.headers.getSetCookie()).toEqual([]);
  });

  test('is answered on the API host too, returning to a page of that host', async () => {
    const response = await post({
      path: '/language',
      form: { language: 'ko', return: OAUTH_LINK_PATH },
      origin: API_ORIGIN,
      headers: { Origin: API_ORIGIN },
    });
    expect(response.status).toBe(SEE_OTHER_STATUS);
    expect(response.headers.get('Location')).toBe(OAUTH_LINK_PATH);
    expect(cookieOf({ response, name: LANGUAGE_COOKIE })).toContain(`${LANGUAGE_COOKIE}=ko;`);
  });

  test('returns to an admin page and keeps its path', async () => {
    const response = await post({ path: '/language', form: { language: 'ko', return: '/admin/metrics' } });
    expect(response.headers.get('Location')).toBe('/admin/metrics');
  });

  test('answers GET /language with 404', async () => {
    expect((await visit({ path: '/language' })).status).toBe(NOT_FOUND_STATUS);
  });

  test('sets no cookie on a local http origin without Secure', async () => {
    const response = await post({
      path: '/language',
      form: { language: 'ja', return: '/' },
      origin: 'http://localhost:8788',
      headers: { Origin: 'http://localhost:8788' },
      settings: { PUBLIC_ORIGIN: 'http://localhost:8787', SITE_ORIGIN: 'http://localhost:8788' },
    });
    expect(cookieOf({ response, name: LANGUAGE_COOKIE })).toBe(`${LANGUAGE_COOKIE}=ja; Path=/; SameSite=Lax; Max-Age=${ONE_YEAR_SECONDS}`);
  });
});

describe('the theme', () => {
  test('renders no data-theme and light dark for the system theme', async () => {
    const html = await (await visit({ path: '/' })).text();
    expect(html).toContain('<html lang="en" dir="ltr">');
    expect(html).toContain('<meta name="color-scheme" content="light dark">');
  });

  test.each([
    ['dark', 'dark'],
    ['light', 'light'],
  ])('renders data-theme and color-scheme %s for a cookie of %s', async (theme, scheme) => {
    const html = await (await visit({ path: '/', headers: { Cookie: `${THEME_COOKIE}=${theme}` } })).text();
    expect(html).toContain(`<html lang="en" dir="ltr" data-theme="${theme}">`);
    expect(html).toContain(`<meta name="color-scheme" content="${scheme}">`);
    expect(html).not.toContain('<meta name="color-scheme" content="light dark">');
  });

  test('sets one theme-color for an explicit theme', async () => {
    const html = await (await visit({ path: '/', headers: { Cookie: `${THEME_COOKIE}=dark` } })).text();
    expect(elementsOf({ html, pattern: /<meta name="theme-color"[^>]*>/g })).toHaveLength(1);
  });

  test.each([
    ['system', '<source data-theme-source media="(prefers-color-scheme: dark)" '],
    ['light', '<source data-theme-source media="not all" '],
    ['dark', '<source data-theme-source srcset='],
  ])('renders the dark hero source for the %s theme', async (theme, expected) => {
    const html = await (await visit({ path: '/', headers: { Cookie: `${THEME_COOKIE}=${theme}` } })).text();
    expect(html).toContain(expected);
  });

  test('ignores a cookie outside the enum', async () => {
    const html = await (await visit({ path: '/', headers: { Cookie: `${THEME_COOKIE}=sepia` } })).text();
    expect(html).toContain('<html lang="en" dir="ltr">');
  });

  test('renders it on every language and on the admin card', async () => {
    const pages = await Promise.all(
      ['/ja/', '/pt-br/cloud-queue', '/admin'].map((path) => visit({ path, headers: { Cookie: `${THEME_COOKIE}=dark` } })),
    );
    const htmls = await Promise.all(pages.map((page) => page.text()));
    htmls.forEach((html) => expect(html).toMatch(/<html lang="[^"]+" dir="(?:ltr|rtl)" data-theme="dark">/));
  });

  test('shows the three options and marks the current one', async () => {
    const html = await (await visit({ path: '/ja/', headers: { Cookie: `${THEME_COOKIE}=light` } })).text();
    expect(html).toContain('<form class="theme-form" method="post" action="/theme"');
    expect(html).toContain('<input type="hidden" name="return" value="/ja/">');
    ['system', 'light', 'dark'].forEach((theme) => expect(html).toMatch(new RegExp(`<button[^>]*name="theme"[^>]*value="${theme}"`)));
    const pressed = elementsOf({ html, pattern: /<button[^>]*name="theme"[^>]*value="([a-z]+)"[^>]*aria-pressed="true"/g });
    expect(pressed.map(([, theme]) => theme)).toEqual(['light']);
  });

  test('sets the cookie on POST /theme and answers 303 back to the page', async () => {
    const response = await post({ path: '/theme', form: { theme: 'dark', return: '/ja/' } });
    expect(response.status).toBe(SEE_OTHER_STATUS);
    expect(response.headers.get('Location')).toBe('/ja/');
    expect(cookieOf({ response, name: THEME_COOKIE })).toBe(
      `${THEME_COOKIE}=dark; Path=/; SameSite=Lax; Secure; Max-Age=${ONE_YEAR_SECONDS}`,
    );
  });

  test('clears the cookie for the system theme', async () => {
    const response = await post({ path: '/theme', form: { theme: 'system', return: '/' } });
    expect(response.status).toBe(SEE_OTHER_STATUS);
    expect(cookieOf({ response, name: THEME_COOKIE })).toBe(`${THEME_COOKIE}=; Path=/; SameSite=Lax; Secure; Max-Age=0`);
  });

  test.each(HOSTILE_RETURNS)('sends %j to the landing and never off the host', async (returned) => {
    const response = await post({ path: '/theme', form: { theme: 'light', return: returned } });
    expect(response.status).toBe(SEE_OTHER_STATUS);
    expect(response.headers.get('Location')).toBe('/');
  });

  test.each(REFUSED_HEADERS)('refuses %j and sets nothing', async (headers) => {
    const response = await post({ path: '/theme', form: { theme: 'dark', return: '/' }, headers });
    expect(response.status).toBe(FORBIDDEN_STATUS);
    expect(response.headers.getSetCookie()).toEqual([]);
  });

  test.each(['sepia', 'Dark', ''])('refuses theme %j with 400', async (theme) => {
    const response = await post({ path: '/theme', form: { theme, return: '/' } });
    expect(response.status).toBe(BAD_REQUEST_STATUS);
    expect(response.headers.getSetCookie()).toEqual([]);
  });
});

describe('the content security policy', () => {
  test.each(['/', '/ja/', '/cloud-queue', '/admin'])('%s keeps hashes only: no unsafe-inline, no unsafe-eval', async (path) => {
    const response = await visit({ path });
    const policy = required({ value: response.headers.get('Content-Security-Policy'), description: 'the policy' });
    expect(policy).not.toContain('unsafe-inline');
    expect(policy).not.toContain('unsafe-eval');
    const scriptSources = required({ value: policy.match(/script-src ([^;]+)/)?.[1], description: 'the script sources' })
      .split(' ')
      .filter((source) => source !== '');
    scriptSources.forEach((source) => expect(source).toMatch(SCRIPT_HASH_PATTERN));
    expect(policy).toMatch(/style-src 'sha256-/);
  });

  test('hashes every inline script of a page', async () => {
    const response = await visit({ path: '/ja/', headers: { Cookie: `${THEME_COOKIE}=dark` } });
    const policy = required({ value: response.headers.get('Content-Security-Policy'), description: 'the policy' });
    const html = await response.text();
    const scripts = elementsOf({ html, pattern: /<script(?: type="application\/ld\+json")?>([\s\S]*?)<\/script>/g }).map(([, source]) =>
      required({ value: source, description: 'a script source' }),
    );
    expect(scripts.length).toBeGreaterThan(0);
    for (const script of scripts) {
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(script));
      expect(policy).toContain(`'sha256-${btoa(String.fromCharCode(...new Uint8Array(digest)))}'`);
    }
  });
});

describe('the pages without a public URL', () => {
  const PRIVATE_PAGES = [
    { name: 'the admin sign-in card', path: '/admin', origin: SITE_ORIGIN },
    { name: 'the magic-link page of the admin', path: '/admin/sign-in', origin: SITE_ORIGIN },
    { name: 'the OAuth magic-link page', path: OAUTH_LINK_PATH, origin: API_ORIGIN },
    { name: 'the app sign-in page', path: SIGN_IN_PATH, origin: API_ORIGIN },
    { name: 'the day-email stop page', path: DAY_EMAIL_STOP_URL.replace(API_ORIGIN, ''), origin: API_ORIGIN },
  ];

  test.each(PRIVATE_PAGES)('$name takes the cookie, then Accept-Language, then English', async ({ path, origin }) => {
    const [cookie, negotiated, fallback, both] = await Promise.all([
      visit({ path, origin, headers: { Cookie: `${LANGUAGE_COOKIE}=de` } }),
      visit({ path, origin, headers: { 'Accept-Language': 'ja,en;q=0.5' } }),
      visit({ path, origin }),
      visit({ path, origin, headers: { Cookie: `${LANGUAGE_COOKIE}=ko`, 'Accept-Language': 'ja' } }),
    ]);
    expect(await cookie.text()).toContain('<html lang="de"');
    expect(await negotiated.text()).toContain('<html lang="ja"');
    expect(await fallback.text()).toContain('<html lang="en"');
    expect(await both.text()).toContain('<html lang="ko"');
  });

  test.each(PRIVATE_PAGES)('$name never sets a language cookie by itself', async ({ path, origin }) => {
    const response = await visit({ path, origin, headers: { 'Accept-Language': 'ja' } });
    expect(response.headers.getSetCookie().filter((cookie) => cookie.startsWith(LANGUAGE_COOKIE))).toEqual([]);
  });

  test('the magic-link pages carry no selector or theme control, because their token is spent', async () => {
    const pages = await Promise.all([
      visit({ path: OAUTH_LINK_PATH, origin: API_ORIGIN }),
      visit({ path: '/admin/sign-in', origin: SITE_ORIGIN }),
    ]);
    for (const page of pages) {
      const html = await page.text();
      expect(html).not.toContain('action="/language"');
      expect(html).not.toContain('action="/theme"');
    }
  });

  test.each(PRIVATE_PAGES)('$name takes the theme cookie too', async ({ path, origin }) => {
    const html = await (await visit({ path, origin, headers: { Cookie: `${THEME_COOKIE}=light` } })).text();
    expect(html).toMatch(/<html lang="[^"]+" dir="(?:ltr|rtl)" data-theme="light">/);
    expect(html).toContain('<meta name="color-scheme" content="light">');
  });

  test.each([
    { name: 'the app sign-in page', path: SIGN_IN_PATH },
    { name: 'the sign-in challenge page', path: '/sign-in/challenge' },
  ])('$name has no selector, because its fragment cannot be replayed', async ({ path }) => {
    const html = await (await visit({ path, origin: API_ORIGIN })).text();
    expect(html).not.toContain('action="/language"');
  });
});
