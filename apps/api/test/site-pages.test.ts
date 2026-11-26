import { exports } from 'cloudflare:workers';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { MCP_COPY } from '../src/mcp-copy';
import { LANDING_COPY } from '../src/site/landing-copy';
import { serveLandingPage } from '../src/site/landing-page';
import { LANDING_SHOTS, LandingShot } from '../src/site/landing-shots';
import { SITE_STYLE } from '../src/site/site-style';
import { inlineSources, onlyInlineSource, sourceHash } from './page-script';

const OK_STATUS = 200;
const STARS = 1234;
const STARS_TEXT = '1.2k';
const STAR_GLYPH = '★';
const LINK_ARROW = '→';
const SIGNATURE_DASH = '—';
const LINKED_LINE_PIECES = [
  `${LANDING_COPY.signature.line} —`,
  'Free on todz cloud — or',
  '.',
  `${LANDING_COPY.shell.creditPrefix} ${LANDING_COPY.shell.creditLead}`,
];
const TURNSTILE_ORIGIN = 'https://challenges.cloudflare.com';
const LOCAL_SITE_ORIGIN = 'http://localhost:8788';
const HTML_CONTENT_TYPE = 'text/html; charset=utf-8';
const STRICT_TRANSPORT_SECURITY = 'max-age=31536000; includeSubDomains';
const SCRIPT_PATTERN = /<script>([\s\S]*?)<\/script>/g;
const STYLE_PATTERN = /<style>([\s\S]*?)<\/style>/g;
const SVG_PATTERN = /<svg[\s\S]*?<\/svg>/g;
const TAG_PATTERN = /<[^>]*>/g;
const TERMINAL_WORD_PATTERN = /<span class="terminal-word">([^<]*)<\/span>/g;
const STYLE_ATTRIBUTE_PATTERN = /<[^>]*\sstyle=/;
const EVENT_HANDLER_PATTERN = /<[^>]*\son[a-z]+=/;
const READABLE_ATTRIBUTE_PATTERN = /\s(?:alt|aria-label)="([^"]*)"/g;
const DESCRIPTION_PATTERN = /<meta name="description" content="([^"]*)">/g;
const IMAGE_SOURCE_PATTERN = /\s(?:src|srcset)="([^"]*)"/g;
const REMOTE_ASSET_PATTERNS = [/\s(?:src|srcset)="https?:/, /<link(?![^>]*rel="canonical")[^>]*\shref="https?:/, /url\(\s*['"]?https?:/];
const HREF_PATTERN = /\shref="([^"]*)"/g;
const SITE_HREF_PATTERN = /^(?:\/|#|https:\/\/)/;
const IMPORT_PATTERN = /from '([^']+)'/g;
const LOCAL_ORIGIN_MODULE = 'local-origin';
const LOCAL_ORIGIN_IMPORT_PATTERN = /import ([^;]+?) from '[^']*local-origin'/g;
const SITE_HOST_PREDICATE_IMPORT = '{ isLocalSiteHost }';
const LANDING_ASSET_PREFIX = '/landing/';
const DOCS_SELF_HOST_URL = 'https://docs.todz.app/self-host';
const DOCS_INSTALL_URL = 'https://docs.todz.app/install-on-mac';
const GUIDE_LINK_PATTERN = /<a class="(?:nav-link|footer-link)" href="([^"]*)"/g;
const FOOTER_CREDIT =
  '<p class="footer-credit">© todz · todz is a product of <a class="footer-credit-link" href="https://logicbit.com.br" rel="noopener noreferrer">Logic Bit</a>, made in Brazil</p>';
const FOOTER_CREDIT_LINK_STYLE = '.footer-credit-link{color:var(--color-text);text-decoration:underline;text-underline-offset:0.2em}';
const SECTION_MARKERS = [
  '<section class="hero',
  '<section class="benefits',
  '<section class="how-it-works',
  '<section id="ways" class="final-call',
  '<footer class="site-footer',
];
const DOWNLOAD_BUTTON = '<a class="download-button" href="/download" download>Download for Mac — Free</a>';
const DOWNLOAD_NOTE_PATTERN =
  /<p class="download-note">Not notarized by Apple yet: the first time, open it from System Settings › Privacy &amp; Security\. <a class="download-note-link" href="https:\/\/docs\.todz\.app\/install-on-mac">Install steps<\/a><\/p>/;
const COMING_SOON_PATTERN = /coming soon/i;
const STRUCTURED_DATA_PATTERN = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g;
const MANIFEST_DIRECTIVE = "manifest-src 'self'";
const CONNECT_DIRECTIVE = "connect-src 'self'";
const UNSAFE_INLINE = "'unsafe-inline'";
const SITE_CACHE_CONTROL = 'no-cache, no-transform';
const ADMIN_PATHS = ['/admin', '/admin/sign-in'];
const SITE_SOURCES = import.meta.glob('../src/site/**/*.ts', { query: '?raw', import: 'default', eager: true });

type SitePage = { response: Response; html: string };

async function pageOf(response: Response | Promise<Response>): Promise<SitePage> {
  const answer = await response;
  return { response: answer, html: await answer.text() };
}

function landingPage(): Promise<SitePage> {
  return pageOf(serveLandingPage({ stars: STARS }));
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
    .replace(STRUCTURED_DATA_PATTERN, '')
    .replace(STYLE_PATTERN, '')
    .replace(SVG_PATTERN, '')
    .split(TAG_PATTERN)
    .map((text) => decoded(text.trim()))
    .filter((text) => text.length > 0);
}

function captures({ html, pattern }: { html: string; pattern: RegExp }): string[] {
  return [...html.matchAll(pattern)].flatMap((match) => match.slice(1, 2));
}

function scriptSources(policy: string | null): string[] {
  const directive = policy?.split('; ').find((entry) => entry.startsWith('script-src '));
  if (directive === undefined) return [];
  return directive.split(' ').slice(1);
}

async function landingPolicy(html: string): Promise<string> {
  const structuredDataHash = await sourceHash(onlyInlineSource({ html, pattern: STRUCTURED_DATA_PATTERN }));
  const scriptHashes = await Promise.all(inlineSources({ html, pattern: SCRIPT_PATTERN }).map((script) => sourceHash(script)));
  const styleHash = await sourceHash(onlyInlineSource({ html, pattern: STYLE_PATTERN }));
  return [
    "default-src 'none'",
    ['script-src', structuredDataHash, ...scriptHashes].join(' '),
    `style-src ${styleHash}`,
    "img-src 'self'",
    MANIFEST_DIRECTIVE,
    CONNECT_DIRECTIVE,
    "form-action 'self'",
    "frame-ancestors 'none'",
    "base-uri 'none'",
  ].join('; ');
}

describe('the landing download', () => {
  test('puts the download button and its note in the hero, once', async () => {
    const { html } = await landingPage();
    expect(html).toContain(DOWNLOAD_BUTTON);
    expect(html).toMatch(DOWNLOAD_NOTE_PATTERN);
    expect(html.match(/<a class="download-button" href="\/download"/g)?.length).toBeGreaterThanOrEqual(1);
  });

  test('the eyebrow names the macOS version and nothing says coming soon', async () => {
    const { html } = await landingPage();
    expect(textNodes(html)).toContain(LANDING_COPY.hero.eyebrow);
    expect(html).not.toMatch(COMING_SOON_PATTERN);
  });

  test('the style sheet carries the three download rules', () => {
    expect(SITE_STYLE).toContain('.download{');
    expect(SITE_STYLE).toContain('.download-button{');
    expect(SITE_STYLE).toContain('.download-note{');
  });
});

describe('the site pages', () => {
  test('the landing answers HTML with HSTS for this host only, nosniff and a referrer policy', async () => {
    const { response } = await landingPage();
    expect(response.status).toBe(OK_STATUS);
    expect(response.headers.get('Content-Type')).toBe(HTML_CONTENT_TYPE);
    expect(response.headers.get('Strict-Transport-Security')).toBe(STRICT_TRANSPORT_SECURITY);
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(response.headers.get('Referrer-Policy')).toBeTruthy();
  });

  test('the landing has no style attribute, no style inside an SVG, no event handler and no remote asset', async () => {
    const { html } = await landingPage();
    const svgs = [...html.matchAll(SVG_PATTERN)].map(([svg]) => svg);
    expect(html).not.toMatch(STYLE_ATTRIBUTE_PATTERN);
    expect(html).not.toMatch(EVENT_HANDLER_PATTERN);
    expect(svgs.filter((svg) => svg.includes('<style'))).toEqual([]);
    expect(REMOTE_ASSET_PATTERNS.filter((pattern) => pattern.test(html))).toEqual([]);
  });

  test('the landing credits Logic Bit in the footer with a link to its website', async () => {
    const { html } = await landingPage();
    expect(html.slice(html.indexOf('<footer class="site-footer'))).toContain(FOOTER_CREDIT);
  });

  test('the credit link is underlined, so it reads as a link without relying on colour', () => {
    expect(SITE_STYLE).toContain(FOOTER_CREDIT_LINK_STYLE);
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
  test('the content security policy allows its scripts and one style by hash, its own images and nothing remote', async () => {
    const { response, html } = await landingPage();
    const policy = response.headers.get('Content-Security-Policy');
    expect(policy).toBe(await landingPolicy(html));
    expect(policy).not.toContain(UNSAFE_INLINE);
    expect(policy).not.toContain(TURNSTILE_ORIGIN);
  });

  test('shows the hero, the benefits, how it works, the final call and the footer, in that order', async () => {
    const { html } = await landingPage();
    const positions = SECTION_MARKERS.map((marker) => html.indexOf(marker));
    expect(positions.filter((position) => position < 0)).toEqual([]);
    expect(positions).toEqual([...positions].sort((first, second) => first - second));
    expect(html.match(/<h1[\s>]/g)).toHaveLength(1);
  });

  test('every word it shows or reads aloud comes from the copy module', async () => {
    const { html } = await landingPage();
    const copy = [...copyStrings(LANDING_COPY), STARS_TEXT, STAR_GLYPH, LINK_ARROW, SIGNATURE_DASH, ...LINKED_LINE_PIECES];
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

  test('the header and footer open the guide and the Mac install page on the docs', async () => {
    const { html } = await landingPage();
    expect(captures({ html, pattern: GUIDE_LINK_PATTERN })).toEqual([
      DOCS_SELF_HOST_URL,
      DOCS_INSTALL_URL,
      DOCS_SELF_HOST_URL,
      DOCS_INSTALL_URL,
    ]);
  });

  test('links only to this site, a fragment or an https address', async () => {
    const { html } = await landingPage();
    expect(captures({ html, pattern: HREF_PATTERN }).filter((href) => !SITE_HREF_PATTERN.test(href))).toEqual([]);
  });

  test('every image is served from /landing/ on this host', async () => {
    const { html } = await landingPage();
    const sources = captures({ html, pattern: IMAGE_SOURCE_PATTERN });
    expect(sources.length).toBeGreaterThan(0);
    expect(sources.filter((source) => !source.startsWith(LANDING_ASSET_PREFIX))).toEqual([]);
  });

  test('serves every shot as WebP copies with sizes, and keeps the PNG as the fallback source', async () => {
    const { html } = await landingPage();
    const shots = Object.entries(LANDING_SHOTS).filter(([shot]) => shot !== LandingShot.WidgetRing);
    shots.forEach(([, { webp }]) => {
      const srcset = webp.map(({ path, width }) => `${path} ${width}w`).join(', ');
      const sizes = `${Math.min(...webp.map(({ width }) => width))}px`;
      expect(html).toContain(`srcset="${srcset}" sizes="${sizes}"`);
    });
    const fallbackShots = shots.filter(([shot]) => shot !== LandingShot.WindowDark);
    fallbackShots.forEach(([, { path }]) => expect(html).toContain(`src="${path}" srcset="`));
  });

  test('keeps the window shot, which a phone never shows, from loading there: lazy and display none below the desktop breakpoint', async () => {
    const { html } = await landingPage();
    const windowShot = html.match(/<div class="shot shot-window[^"]*">([\s\S]*?)<\/div>/)?.[1];
    expect(windowShot).toContain('loading="lazy"');
    expect(windowShot).not.toContain('fetchpriority');
    expect(SITE_STYLE).toContain('.shot-window{display:none;');
    expect(SITE_STYLE).not.toContain('.shot-window{visibility');
  });
});

describe('the site host through the Worker', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test.each(['GET', 'HEAD'])('%s / answers the page this module renders, with its headers', async (method) => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => Response.json({ stargazers_count: STARS }));
    const response = await exports.default.fetch(`${LOCAL_SITE_ORIGIN}/`, { method });
    const expected = await landingPage();
    expect(response.status).toBe(OK_STATUS);
    expect(await response.text()).toBe(method === 'HEAD' ? '' : expected.html);
    expect(response.headers.get('Content-Security-Policy')).toBe(expected.response.headers.get('Content-Security-Policy'));
    expect(response.headers.get('Strict-Transport-Security')).toBe(STRICT_TRANSPORT_SECURITY);
  });
});

describe('the structured data and the policy of the public pages', () => {
  test('the landing allows its JSON-LD block by hash', async () => {
    const { response, html } = await landingPage();
    const block = onlyInlineSource({ html, pattern: STRUCTURED_DATA_PATTERN });
    expect(scriptSources(response.headers.get('Content-Security-Policy'))).toContain(await sourceHash(block));
  });

  test('the landing allows its scripts by hash beside the JSON-LD block', async () => {
    const { response, html } = await landingPage();
    const policy = scriptSources(response.headers.get('Content-Security-Policy'));
    const hashes = await Promise.all(inlineSources({ html, pattern: SCRIPT_PATTERN }).map((script) => sourceHash(script)));
    expect(hashes.length).toBeGreaterThan(0);
    hashes.forEach((hash) => expect(policy).toContain(hash));
  });

  test('the landing allows the manifest from this origin only and is cached without transforms', async () => {
    const { response } = await landingPage();
    expect(response.headers.get('Content-Security-Policy')?.split('; ')).toContain(MANIFEST_DIRECTIVE);
    expect(response.headers.get('Cache-Control')).toBe(SITE_CACHE_CONTROL);
  });

  test('the landing lets Lighthouse read its discovery files: connections to this origin only', async () => {
    const { response } = await landingPage();
    const directives = response.headers.get('Content-Security-Policy')?.split('; ');
    expect(directives?.filter((directive) => directive.startsWith('connect-src '))).toEqual([CONNECT_DIRECTIVE]);
  });

  test('no site page widens its policy with unsafe-inline or carries an inline handler attribute', async () => {
    const adminAnswers = await Promise.all(ADMIN_PATHS.map((path) => pageOf(exports.default.fetch(`${LOCAL_SITE_ORIGIN}${path}`))));
    const answers = [await landingPage(), ...adminAnswers];
    answers.forEach(({ response, html }) => {
      expect(response.headers.get('Content-Security-Policy')).not.toContain(UNSAFE_INLINE);
      expect(html).not.toMatch(EVENT_HANDLER_PATTERN);
    });
  });
});
