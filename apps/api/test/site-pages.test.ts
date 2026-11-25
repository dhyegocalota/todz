import { exports } from 'cloudflare:workers';
import { describe, expect, test, vi } from 'vitest';
import guide from '../../../docs/self-host.md?raw';
import { MCP_COPY } from '../src/mcp-copy';
import { LANDING_COPY } from '../src/site/landing-copy';
import { LandingNotice, serveLandingPage } from '../src/site/landing-page';
import { serveSelfHostPage } from '../src/site/self-host-page';
import { TURNSTILE_DUMMY_TOKEN } from '../src/turnstile';
import { inlineSources, onlyInlineSource, sourceHash } from './page-script';

const OK_STATUS = 200;
const TOO_MANY_STATUS = 429;
const RETRY_AFTER_SECONDS = '60';
const LOCAL_SITE_ORIGIN = 'http://localhost:8788';
const TURNSTILE_TEST_SITE_KEY = '1x00000000000000000000AA';
const TOKEN_FIELD = 'cf-turnstile-response';
const FORM_CONTENT_TYPE = 'application/x-www-form-urlencoded';
const HTML_CONTENT_TYPE = 'text/html; charset=utf-8';
const STRICT_TRANSPORT_SECURITY = 'max-age=31536000';
const SCRIPT_PATTERN = /<script>([\s\S]*?)<\/script>/g;
const STYLE_PATTERN = /<style>([\s\S]*?)<\/style>/g;
const SVG_PATTERN = /<svg[\s\S]*?<\/svg>/g;
const TAG_PATTERN = /<[^>]*>/g;
const TERMINAL_WORD_PATTERN = /<span class="terminal-word">([^<]*)<\/span>/g;
const FORM_PATTERN = /<form[\s\S]*?<\/form>/g;
const MAIN_PATTERN = /<main id="content"[^>]*>([\s\S]*?)<\/main>/;
const STYLE_ATTRIBUTE_PATTERN = /<[^>]*\sstyle=/;
const EVENT_HANDLER_PATTERN = /<[^>]*\son[a-z]+=/;
const READABLE_ATTRIBUTE_PATTERN = /\s(?:alt|aria-label|placeholder|data-submitting)="([^"]*)"/g;
const DESCRIPTION_PATTERN = /<meta name="description" content="([^"]*)">/g;
const IMAGE_SOURCE_PATTERN = /\s(?:src|srcset)="([^"]*)"/g;
const REMOTE_ASSET_PATTERNS = [/\s(?:src|srcset)="https?:/, /<link[^>]*\shref="https?:/, /url\(\s*['"]?https?:/];
const HREF_PATTERN = /\shref="([^"]*)"/g;
const SITE_HREF_PATTERN = /^(?:\/|#|https:\/\/)/;
const IMPORT_PATTERN = /from '([^']+)'/g;
const LOCAL_ORIGIN_MODULE = 'local-origin';
const LOCAL_ORIGIN_IMPORT_PATTERN = /import ([^;]+?) from '[^']*local-origin'/g;
const SITE_HOST_PREDICATE_IMPORT = '{ isLocalSiteHost }';
const LANDING_ASSET_PREFIX = '/landing/';
const SECTION_MARKERS = [
  '<section class="hero',
  '<section class="benefits',
  '<section class="how-it-works',
  '<section class="final-call',
  '<footer class="site-footer',
];
const JOIN_FORMS = [
  { id: 'join', action: '/join#join' },
  { id: 'final', action: '/join#final' },
];
const GUIDE_HEADING_PATTERN = /^## (.+)$/gm;
const GUIDE_FENCE_PATTERN = /^```[a-z]*\n([\s\S]*?)^```$/gm;
const CODE_REGION_PATTERN = /<pre class="code" tabindex="0" role="region" aria-label="Code"><code>([\s\S]*?)<\/code><\/pre>/g;
const HEADING_TWO_PATTERN = /<h2 id="[^"]+">([\s\S]*?)<\/h2>/g;
const MARKDOWN_INLINE_PATTERN = /`|\*\*/g;
const SITE_SOURCES = import.meta.glob('../src/site/**/*.ts', { query: '?raw', import: 'default', eager: true });

type SitePage = { response: Response; html: string };

async function pageOf(response: Promise<Response>): Promise<SitePage> {
  const answer = await response;
  return { response: answer, html: await answer.text() };
}

function landingPage(notice: LandingNotice): Promise<SitePage> {
  return pageOf(serveLandingPage({ notice, siteKey: null }));
}

function selfHostPage(): Promise<SitePage> {
  return pageOf(serveSelfHostPage());
}

function decoded(text: string): string {
  return text.replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&quot;', '"').replaceAll('&#39;', "'").replaceAll('&amp;', '&');
}

function copyStrings(copy: object): string[] {
  return Object.values(copy).flatMap((value) => (typeof value === 'string' ? [value] : copyStrings(value)));
}

function textNodes(html: string): string[] {
  return html
    .replace(TERMINAL_WORD_PATTERN, '$1')
    .replace(SCRIPT_PATTERN, '')
    .replace(STYLE_PATTERN, '')
    .replace(SVG_PATTERN, '')
    .split(TAG_PATTERN)
    .map((text) => decoded(text.trim()))
    .filter((text) => text.length > 0);
}

function captures({ html, pattern }: { html: string; pattern: RegExp }): string[] {
  return [...html.matchAll(pattern)].flatMap((match) => match.slice(1, 2));
}

function guideHeadingText(markdown: string): string {
  return markdown.replace(MARKDOWN_INLINE_PATTERN, '');
}

describe('the site pages', () => {
  test.each([
    ['the landing', () => landingPage(LandingNotice.None)],
    ['the landing with the notice', () => landingPage(LandingNotice.OpensSoon)],
    ['the self-host guide', selfHostPage],
  ])('%s answers HTML with HSTS for this host only, nosniff and a referrer policy', async (_name, page) => {
    const { response } = await page();
    expect(response.status).toBe(OK_STATUS);
    expect(response.headers.get('Content-Type')).toBe(HTML_CONTENT_TYPE);
    expect(response.headers.get('Strict-Transport-Security')).toBe(STRICT_TRANSPORT_SECURITY);
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(response.headers.get('Referrer-Policy')).toBeTruthy();
  });

  test.each([
    ['the landing', () => landingPage(LandingNotice.None)],
    ['the self-host guide', selfHostPage],
  ])('%s has no style attribute, no style inside an SVG, no event handler and no remote asset', async (_name, page) => {
    const { html } = await page();
    const svgs = [...html.matchAll(SVG_PATTERN)].map(([svg]) => svg);
    expect(html).not.toMatch(STYLE_ATTRIBUTE_PATTERN);
    expect(html).not.toMatch(EVENT_HANDLER_PATTERN);
    expect(svgs.filter((svg) => svg.includes('<style'))).toEqual([]);
    expect(REMOTE_ASSET_PATTERNS.filter((pattern) => pattern.test(html))).toEqual([]);
  });

  test('the site imports only the site host predicate from local-origin', () => {
    const sources = Object.values(SITE_SOURCES);
    const localOriginPaths = sources
      .flatMap((source) => captures({ html: source, pattern: IMPORT_PATTERN }))
      .filter((path) => path.endsWith(LOCAL_ORIGIN_MODULE));
    const clauses = sources.flatMap((source) => captures({ html: source, pattern: LOCAL_ORIGIN_IMPORT_PATTERN }));
    expect(sources.length).toBeGreaterThan(0);
    expect(clauses).toHaveLength(localOriginPaths.length);
    expect(clauses.filter((clause) => clause !== SITE_HOST_PREDICATE_IMPORT)).toEqual([]);
  });
});

describe('the landing', () => {
  test('the content security policy allows its one script and one style by hash, its own images and its own forms', async () => {
    const { response, html } = await landingPage(LandingNotice.None);
    const script = onlyInlineSource({ html, pattern: SCRIPT_PATTERN });
    const style = onlyInlineSource({ html, pattern: STYLE_PATTERN });
    const policy = response.headers.get('Content-Security-Policy');
    expect(policy).toBe(
      [
        "default-src 'none'",
        `script-src ${await sourceHash(script)}`,
        `style-src ${await sourceHash(style)}`,
        "img-src 'self'",
        "form-action 'self'",
        "frame-ancestors 'none'",
        "base-uri 'none'",
      ].join('; '),
    );
    expect(policy).not.toContain('unsafe-inline');
  });

  test('shows the hero, the benefits, how it works, the final call and the footer, in that order', async () => {
    const { html } = await landingPage(LandingNotice.None);
    const positions = SECTION_MARKERS.map((marker) => html.indexOf(marker));
    expect(positions.filter((position) => position < 0)).toEqual([]);
    expect(positions).toEqual([...positions].sort((first, second) => first - second));
    expect(html.match(/<h1[\s>]/g)).toHaveLength(1);
  });

  test('every word it shows or reads aloud comes from the copy module', async () => {
    const { html } = await landingPage(LandingNotice.OpensSoon);
    const copy = copyStrings(LANDING_COPY);
    const readable = [
      ...textNodes(html),
      ...captures({ html, pattern: READABLE_ATTRIBUTE_PATTERN }).map(decoded),
      ...captures({ html, pattern: DESCRIPTION_PATTERN }).map(decoded),
    ];
    expect(readable.length).toBeGreaterThan(0);
    expect(readable.filter((text) => !copy.includes(text))).toEqual([]);
  });

  test('the tool result in the terminal is the one the MCP server answers', () => {
    expect(LANDING_COPY.terminal.toolResult.startsWith(`${MCP_COPY.added} `)).toBe(true);
    expect(SITE_SOURCES['../src/site/landing-copy.ts']).toContain('MCP_COPY.added');
  });

  test('every image is served from /landing/ on this host', async () => {
    const { html } = await landingPage(LandingNotice.None);
    const sources = captures({ html, pattern: IMAGE_SOURCE_PATTERN });
    expect(sources.length).toBeGreaterThan(0);
    expect(sources.filter((source) => !source.startsWith(LANDING_ASSET_PREFIX))).toEqual([]);
  });

  test('has the two waitlist forms, each posting to /join with the fragment that returns to it', async () => {
    const { html } = await landingPage(LandingNotice.None);
    const forms = [...html.matchAll(FORM_PATTERN)].map(([form]) => form);
    expect(forms).toHaveLength(JOIN_FORMS.length);
    JOIN_FORMS.forEach(({ id, action }, index) => {
      expect(forms[index]).toMatch(new RegExp(`^<form id="${id}"[^>]* method="post" action="${action}"`));
      expect(forms[index]).toMatch(/<input [^>]*type="email"[^>]* required/);
    });
  });

  test('without a notice, each form shows its note and no notice', async () => {
    const { html } = await landingPage(LandingNotice.None);
    const forms = [...html.matchAll(FORM_PATTERN)].map(([form]) => form);
    expect(html).not.toContain(LANDING_COPY.join.opensSoon);
    expect(forms.filter((form) => !form.includes(LANDING_COPY.join.note))).toEqual([]);
  });

  test('with the opens-soon notice, each form shows the notice as a focusable status instead of its note', async () => {
    const { html } = await landingPage(LandingNotice.OpensSoon);
    const forms = [...html.matchAll(FORM_PATTERN)].map(([form]) => form);
    expect(forms).toHaveLength(JOIN_FORMS.length);
    forms.forEach((form) => {
      expect(form).toMatch(new RegExp(`<p [^>]*role="status"[^>]*tabindex="-1"[^>]*>[\\s\\S]*${LANDING_COPY.join.opensSoon}`));
      expect(form).not.toContain(LANDING_COPY.join.note);
    });
  });
});

describe('the site host through the Worker', () => {
  function keyedLandingPage(notice: LandingNotice): Promise<SitePage> {
    return pageOf(serveLandingPage({ notice, siteKey: TURNSTILE_TEST_SITE_KEY }));
  }

  function postJoin(token: string | null): Promise<Response> {
    const fields = new URLSearchParams({ email: `${crypto.randomUUID()}@example.com` });
    if (token !== null) fields.set(TOKEN_FIELD, token);
    const body = fields.toString();
    return exports.default.fetch(`${LOCAL_SITE_ORIGIN}/join`, {
      method: 'POST',
      headers: { 'Content-Type': FORM_CONTENT_TYPE, 'Content-Length': String(body.length) },
      body,
    });
  }

  async function expectPage({ response, expected, status }: { response: Response; expected: SitePage; status: number }): Promise<void> {
    expect(response.status).toBe(status);
    expect(await response.text()).toBe(expected.html);
    expect(response.headers.get('Content-Security-Policy')).toBe(expected.response.headers.get('Content-Security-Policy'));
    expect(response.headers.get('Strict-Transport-Security')).toBe(STRICT_TRANSPORT_SECURITY);
  }

  test.each([
    { method: 'GET', path: '/', page: () => keyedLandingPage(LandingNotice.None) },
    { method: 'HEAD', path: '/', page: async () => ({ ...(await keyedLandingPage(LandingNotice.None)), html: '' }) },
    { method: 'GET', path: '/self-host', page: selfHostPage },
  ])('$method $path answers the page this module renders, with the configured site key and its headers', async ({ method, path, page }) => {
    const response = await exports.default.fetch(`${LOCAL_SITE_ORIGIN}${path}`, { method });
    await expectPage({ response, expected: await page(), status: OK_STATUS });
  });

  test('POST /join with the dummy token answers the joined landing and mails the address through the console', async () => {
    const output = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const response = await postJoin(TURNSTILE_DUMMY_TOKEN);
    await expectPage({ response, expected: await keyedLandingPage(LandingNotice.Joined), status: OK_STATUS });
    expect(output).toHaveBeenCalledTimes(1);
    output.mockRestore();
  });

  test('POST /join without a token answers the try-again landing, 429 with Retry-After 60', async () => {
    const response = await postJoin(null);
    expect(response.headers.get('Retry-After')).toBe(RETRY_AFTER_SECONDS);
    await expectPage({ response, expected: await keyedLandingPage(LandingNotice.TryAgain), status: TOO_MANY_STATUS });
  });
});

describe('the self-host guide page', () => {
  test('the content security policy allows its one style by hash and no script', async () => {
    const { response, html } = await selfHostPage();
    const style = onlyInlineSource({ html, pattern: STYLE_PATTERN });
    expect(inlineSources({ html, pattern: SCRIPT_PATTERN })).toEqual([]);
    expect(html).not.toContain('<script');
    expect(response.headers.get('Content-Security-Policy')).toBe(
      [
        "default-src 'none'",
        `style-src ${await sourceHash(style)}`,
        "img-src 'self'",
        "form-action 'self'",
        "frame-ancestors 'none'",
        "base-uri 'none'",
      ].join('; '),
    );
  });

  test('holds every section heading of docs/self-host.md inside the page, in order', async () => {
    const { html } = await selfHostPage();
    const main = MAIN_PATTERN.exec(html)?.[1];
    if (main === undefined) throw new Error('the page has a main element');
    const headings = captures({ html: main, pattern: HEADING_TWO_PATTERN }).map((heading) => decoded(heading.replace(TAG_PATTERN, '')));
    expect(headings).toEqual(captures({ html: guide, pattern: GUIDE_HEADING_PATTERN }).map(guideHeadingText));
  });

  test('holds every code block of docs/self-host.md as a keyboard-scrollable code region', async () => {
    const { html } = await selfHostPage();
    const blocks = captures({ html: guide, pattern: GUIDE_FENCE_PATTERN }).map((block) => block.trimEnd());
    const regions = captures({ html, pattern: CODE_REGION_PATTERN }).map(decoded);
    expect(blocks.length).toBeGreaterThan(0);
    expect(regions).toEqual(blocks);
  });

  test('links only to this site, a fragment or an https address', async () => {
    const { html } = await selfHostPage();
    expect(captures({ html, pattern: HREF_PATTERN }).filter((href) => !SITE_HREF_PATTERN.test(href))).toEqual([]);
  });
});
