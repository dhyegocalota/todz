import { exports } from 'cloudflare:workers';
import { describe, expect, test } from 'vitest';
import { LANDING_COPY } from '../src/site/landing-copy';
import { serveAdminLinkPage } from '../src/site/admin-link-page';
import { serveAdminSignInPage } from '../src/site/admin-page';
import { AdminNotice } from '../src/site/admin-waitlist';
import { OPEN_GRAPH_IMAGE, SITE_ICONS, SiteIcon } from '../src/site/site-icons';
import { DiscoveryPath, SITE_URL } from '../src/site/site-urls';

const OK_STATUS = 200;
const LOCAL_SITE_ORIGIN = 'http://localhost:8788';
const SITE_NAME = 'todz';
const LIGHT_THEME_COLOR = '#F2F4FA';
const DARK_THEME_COLOR = '#070812';
const OPEN_GRAPH_TYPE = 'website';
const TWITTER_CARD = 'summary_large_image';
const GET_METHOD = 'GET';
const HEAD_METHOD = 'HEAD';
const META_PATTERN = /<meta\s[^>]*>/g;
const LINK_PATTERN = /<link\s[^>]*>/g;
const ATTRIBUTE_PATTERN = /([a-z-]+)="([^"]*)"/g;
const TITLE_PATTERN = /<title>([^<]*)<\/title>/g;
const HEADING_ONE_PATTERN = /<h1[\s>]/g;
const HEADER_PATTERN = /<header[\s>]/g;
const NAV_PATTERN = /<nav[\s>]/g;
const MAIN_PATTERN = /<main[\s>]/g;
const FOOTER_PATTERN = /<footer[\s>]/g;
const SOCIAL_PATTERN = /^(og|twitter):/;
const LANGUAGE_PATTERN = /<html lang="en">/;
const STRUCTURED_DATA_PATTERN = /type="application\/ld\+json"/;
const PUBLIC_HEADERS = ['Content-Type', 'Cache-Control', 'Content-Security-Policy'];

type Tag = Record<string, string | undefined>;

type PublicPage = { path: string; title: string; description: string; canonical: string };

const PUBLIC_PAGES: PublicPage[] = [
  { path: '/', title: LANDING_COPY.meta.title, description: LANDING_COPY.meta.description, canonical: `${SITE_URL}/` },
];

function decoded(text: string): string {
  return text.replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&quot;', '"').replaceAll('&#39;', "'").replaceAll('&amp;', '&');
}

function groupOf({ match, index }: { match: RegExpMatchArray; index: number }): string {
  const group = match[index];
  if (group === undefined) throw new Error('the pattern always captures this group');
  return group;
}

function tagsOf({ html, pattern }: { html: string; pattern: RegExp }): Tag[] {
  return [...html.matchAll(pattern)].map(([tag]) =>
    Object.fromEntries(
      [...tag.matchAll(ATTRIBUTE_PATTERN)].map((match) => [groupOf({ match, index: 1 }), decoded(groupOf({ match, index: 2 }))]),
    ),
  );
}

function metaContents({ html, attribute, key }: { html: string; attribute: string; key: string }): (string | undefined)[] {
  return tagsOf({ html, pattern: META_PATTERN })
    .filter((tag) => tag[attribute] === key)
    .map((tag) => tag.content);
}

function linksOf({ html, relation }: { html: string; relation: string }): Tag[] {
  return tagsOf({ html, pattern: LINK_PATTERN }).filter((tag) => tag.rel === relation);
}

function countOf({ html, pattern }: { html: string; pattern: RegExp }): number {
  return [...html.matchAll(pattern)].length;
}

function siteRequest({ path, method }: { path: string; method: string }): Promise<Response> {
  return exports.default.fetch(`${LOCAL_SITE_ORIGIN}${path}`, { method });
}

async function htmlOf({ path, method }: { path: string; method: string }): Promise<string> {
  const response = await siteRequest({ path, method });
  expect(response.status).toBe(OK_STATUS);
  return response.text();
}

describe.each(PUBLIC_PAGES)('the head of $path', ({ path, title, description, canonical }) => {
  test.each([GET_METHOD, HEAD_METHOD])('%s answers the same page headers, and only GET carries the body', async (method) => {
    const answer = await siteRequest({ path, method });
    const reference = await siteRequest({ path, method: GET_METHOD });
    expect(answer.status).toBe(reference.status);
    PUBLIC_HEADERS.forEach((name) => expect(answer.headers.get(name)).toBe(reference.headers.get(name)));
    expect((await answer.text()).length > 0).toBe(method === GET_METHOD);
  });

  test('holds one title and one description, equal to the copy', async () => {
    const html = await htmlOf({ path, method: GET_METHOD });
    expect([...html.matchAll(TITLE_PATTERN)].map((match) => decoded(groupOf({ match, index: 1 })))).toEqual([title]);
    expect(metaContents({ html, attribute: 'name', key: 'description' })).toEqual([description]);
  });

  test('holds one canonical link on the production origin', async () => {
    const html = await htmlOf({ path, method: GET_METHOD });
    expect(linksOf({ html, relation: 'canonical' })).toEqual([{ rel: 'canonical', href: canonical }]);
  });

  test('holds the Open Graph and Twitter tags, each once, with the exact values', async () => {
    const html = await htmlOf({ path, method: GET_METHOD });
    const expected: Record<string, string> = {
      'og:title': title,
      'og:description': description,
      'og:url': canonical,
      'og:type': OPEN_GRAPH_TYPE,
      'og:site_name': SITE_NAME,
      'og:image': `${SITE_URL}${OPEN_GRAPH_IMAGE.path}`,
      'og:image:width': String(OPEN_GRAPH_IMAGE.width),
      'og:image:height': String(OPEN_GRAPH_IMAGE.height),
      'og:image:alt': OPEN_GRAPH_IMAGE.alt,
    };
    const found = Object.fromEntries(Object.keys(expected).map((key) => [key, metaContents({ html, attribute: 'property', key })]));
    expect(found).toEqual(Object.fromEntries(Object.entries(expected).map(([key, value]) => [key, [value]])));
    expect(metaContents({ html, attribute: 'name', key: 'twitter:card' })).toEqual([TWITTER_CARD]);
  });

  test('holds the three icon links and the manifest link', async () => {
    const html = await htmlOf({ path, method: GET_METHOD });
    const { size } = SITE_ICONS[SiteIcon.Favicon];
    expect(linksOf({ html, relation: 'icon' })).toEqual([
      { rel: 'icon', href: SITE_ICONS[SiteIcon.Favicon].path, sizes: `${size}x${size}` },
      { rel: 'icon', href: SITE_ICONS[SiteIcon.Vector].path, type: SITE_ICONS[SiteIcon.Vector].mediaType },
    ]);
    expect(linksOf({ html, relation: 'apple-touch-icon' })).toEqual([
      { rel: 'apple-touch-icon', href: SITE_ICONS[SiteIcon.AppleTouch].path },
    ]);
    expect(linksOf({ html, relation: 'manifest' })).toEqual([{ rel: 'manifest', href: DiscoveryPath.Manifest }]);
  });

  test('declares English and the two theme colours', async () => {
    const html = await htmlOf({ path, method: GET_METHOD });
    expect(html).toMatch(LANGUAGE_PATTERN);
    expect(
      tagsOf({ html, pattern: META_PATTERN })
        .filter((tag) => tag.name === 'theme-color')
        .map(({ content, media }) => ({ content, media })),
    ).toEqual([
      { content: LIGHT_THEME_COLOR, media: '(prefers-color-scheme: light)' },
      { content: DARK_THEME_COLOR, media: '(prefers-color-scheme: dark)' },
    ]);
  });

  test('holds one h1 and one each of header, nav, main and footer', async () => {
    const html = await htmlOf({ path, method: GET_METHOD });
    const counts = [HEADING_ONE_PATTERN, HEADER_PATTERN, NAV_PATTERN, MAIN_PATTERN, FOOTER_PATTERN].map((pattern) =>
      countOf({ html, pattern }),
    );
    expect(counts).toEqual([1, 1, 1, 1, 1]);
  });
});

describe('HEAD /', () => {
  test('carries the headers, not the head', async () => {
    const answer = await siteRequest({ path: '/', method: HEAD_METHOD });
    expect(answer.status).toBe(OK_STATUS);
    expect(answer.headers.get('Content-Security-Policy')).toBeTruthy();
    expect(await answer.text()).toBe('');
  });
});

describe('the head of the private pages', () => {
  const PRIVATE_PAGES: [string, () => Promise<Response>][] = [
    ['the admin sign-in page', () => serveAdminSignInPage({ notice: AdminNotice.None, siteKey: null })],
    ['the admin link page', serveAdminLinkPage],
  ];

  test.each(PRIVATE_PAGES)('%s holds the favicon links and nothing that makes it public', async (_name, page) => {
    const html = await (await page()).text();
    expect(linksOf({ html, relation: 'icon' }).map((tag) => tag.href)).toEqual([
      SITE_ICONS[SiteIcon.Favicon].path,
      SITE_ICONS[SiteIcon.Vector].path,
    ]);
    expect(linksOf({ html, relation: 'canonical' })).toEqual([]);
    expect(linksOf({ html, relation: 'apple-touch-icon' })).toEqual([]);
    expect(linksOf({ html, relation: 'manifest' })).toEqual([]);
    expect(
      tagsOf({ html, pattern: META_PATTERN }).filter((tag) =>
        [tag.property, tag.name].some((key) => key !== undefined && SOCIAL_PATTERN.test(key)),
      ),
    ).toEqual([]);
    expect(html).not.toMatch(STRUCTURED_DATA_PATTERN);
  });
});
