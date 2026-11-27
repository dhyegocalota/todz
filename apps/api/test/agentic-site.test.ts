import { REPOSITORY } from '@todz/types';
import { exports } from 'cloudflare:workers';
import { describe, expect, test } from 'vitest';
import { LANDING_COPY } from '../src/site/landing-copy';
import { DOCS_INSTALL_URL, DOCS_MCP_URL, DOCS_URL, DOWNLOAD_URL, DiscoveryPath, MCP_URL, SITE_URL } from '../src/site/site-urls';

const LOCAL_SITE_ORIGIN = 'http://localhost:8788';
const LOCAL_API_ORIGIN = 'http://localhost:8787';
const OK_STATUS = 200;
const NOT_FOUND_STATUS = 404;
const MARKDOWN_TYPE = 'text/markdown; charset=utf-8';
const LINKSET_TYPE = 'application/linkset+json';
const CARD_TYPE = 'application/mcp-server-card+json';
const PUBLIC_CACHE_CONTROL = 'public, max-age=3600';
const OPEN_ACCESS = '*';
const MARKDOWN_ALTERNATE_LINK = '</index.md>; rel="alternate"; type="text/markdown"';
const ACCEPT_MARKDOWN = { Accept: 'text/markdown' };
const ACCEPT_HTML = { Accept: 'text/html' };
const STALE_PHRASES = [
  /waitlist/i,
  /in development/i,
  /not yet available/i,
  /coming soon/i,
  /pricing has not been announced/i,
  /joining .* is free/i,
];
const STALE_COPY_FILES = [DiscoveryPath.Llms, DiscoveryPath.LlmsFull, DiscoveryPath.LandingMarkdown, '/'];
const CONTENT_SECURITY_DIRECTIVE_NAMES = [
  'default-src',
  'script-src',
  'style-src',
  'img-src',
  'manifest-src',
  'connect-src',
  'form-action',
  'frame-ancestors',
  'base-uri',
];

type Json = Record<string, unknown>;

function siteGet({ path, headers = {} }: { path: string; headers?: Record<string, string> }): Promise<Response> {
  return exports.default.fetch(`${LOCAL_SITE_ORIGIN}${path}`, { headers });
}

async function jsonOf(response: Response): Promise<Json> {
  const parsed: unknown = JSON.parse(await response.text());
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) throw new Error('the body is one JSON object');
  return Object.fromEntries(Object.entries(parsed));
}

describe('the server card on the API host', () => {
  test('answers the well-known path with the card, the same bytes as the site', async () => {
    const onApiHost = await exports.default.fetch(`${LOCAL_API_ORIGIN}${DiscoveryPath.ServerCard}`);
    const onSite = await siteGet({ path: DiscoveryPath.ServerCard });
    expect(onApiHost.status).toBe(OK_STATUS);
    expect(onApiHost.headers.get('Content-Type')).toBe(CARD_TYPE);
    expect(onApiHost.headers.get('Access-Control-Allow-Origin')).toBe(OPEN_ACCESS);
    expect(await onApiHost.text()).toBe(await onSite.text());
  });

  test('refuses POST on the well-known path with an empty 404', async () => {
    const response = await exports.default.fetch(`${LOCAL_API_ORIGIN}${DiscoveryPath.ServerCard}`, { method: 'POST' });
    expect(response.status).toBe(NOT_FOUND_STATUS);
    expect(await response.text()).toBe('');
  });
});

describe('the markdown landing', () => {
  test('/index.md answers markdown with the public cache and headline facts', async () => {
    const response = await siteGet({ path: DiscoveryPath.LandingMarkdown });
    const body = await response.text();
    expect(response.status).toBe(OK_STATUS);
    expect(response.headers.get('Content-Type')).toBe(MARKDOWN_TYPE);
    expect(response.headers.get('Cache-Control')).toBe(PUBLIC_CACHE_CONTROL);
    expect(body.startsWith(`# ${LANDING_COPY.meta.title}`)).toBe(true);
    expect(body).toContain(`](${DOWNLOAD_URL})`);
    expect(body).toContain(`](${REPOSITORY.url})`);
    expect(body).toContain(LANDING_COPY.hero.lead);
    expect(body).toContain(LANDING_COPY.benefits.agents.title);
    expect(body).toContain(LANDING_COPY.howItWorks.step1);
  });

  test('/index.md answers 404 on the API host', async () => {
    const response = await exports.default.fetch(`${LOCAL_API_ORIGIN}${DiscoveryPath.LandingMarkdown}`);
    expect(response.status).toBe(NOT_FOUND_STATUS);
  });

  test('the landing points at it with a Link header and varies on Accept', async () => {
    const response = await siteGet({ path: '/' });
    expect(response.headers.get('Content-Type')).toBe('text/html; charset=utf-8');
    expect(response.headers.get('Link')).toBe(MARKDOWN_ALTERNATE_LINK);
    expect(response.headers.get('Vary')).toBe('Accept, Cookie, Accept-Language');
  });

  test('the landing answers markdown to Accept: text/markdown, the same body as /index.md', async () => {
    const negotiated = await siteGet({ path: '/', headers: ACCEPT_MARKDOWN });
    const alternate = await siteGet({ path: DiscoveryPath.LandingMarkdown });
    expect(negotiated.status).toBe(OK_STATUS);
    expect(negotiated.headers.get('Content-Type')).toBe(MARKDOWN_TYPE);
    expect(negotiated.headers.get('Vary')).toBe('Accept');
    expect(await negotiated.text()).toBe(await alternate.text());
  });

  test('the landing answers HTML to Accept: text/html', async () => {
    const response = await siteGet({ path: '/', headers: ACCEPT_HTML });
    expect(response.headers.get('Content-Type')).toBe('text/html; charset=utf-8');
  });
});

describe('the API catalog', () => {
  test('answers a linkset with open reads and the public cache', async () => {
    const response = await siteGet({ path: DiscoveryPath.ApiCatalog });
    expect(response.status).toBe(OK_STATUS);
    expect(response.headers.get('Content-Type')).toBe(LINKSET_TYPE);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe(OPEN_ACCESS);
    expect(response.headers.get('Cache-Control')).toBe(PUBLIC_CACHE_CONTROL);
  });

  test('points at the server card, the docs, llms.txt and the docs MCP', async () => {
    const { linkset } = await jsonOf(await siteGet({ path: DiscoveryPath.ApiCatalog }));
    expect(linkset).toEqual([
      {
        anchor: MCP_URL,
        'service-desc': [{ href: `${SITE_URL}${DiscoveryPath.ServerCard}`, type: CARD_TYPE }],
        'service-doc': [
          { href: DOCS_URL, type: 'text/html' },
          { href: `${SITE_URL}${DiscoveryPath.Llms}`, type: 'text/plain' },
        ],
      },
      { anchor: DOCS_MCP_URL, 'service-doc': [{ href: DOCS_URL, type: 'text/html' }] },
    ]);
  });

  test('answers 404 on the API host and to POST', async () => {
    const onApiHost = await exports.default.fetch(`${LOCAL_API_ORIGIN}${DiscoveryPath.ApiCatalog}`);
    const posted = await exports.default.fetch(`${LOCAL_SITE_ORIGIN}${DiscoveryPath.ApiCatalog}`, { method: 'POST' });
    expect([onApiHost.status, posted.status]).toEqual([NOT_FOUND_STATUS, NOT_FOUND_STATUS]);
  });
});

describe('llms.txt for a live product', () => {
  test('names the download, the open source licence, the docs MCP and the free plan, and links install, self-host and privacy', async () => {
    const body = await (await siteGet({ path: DiscoveryPath.Llms })).text();
    [
      DOWNLOAD_URL,
      'The app updates itself',
      REPOSITORY.url,
      REPOSITORY.licenseName,
      `claude mcp add --transport http todz-docs ${DOCS_MCP_URL}`,
      'free on todz cloud, or self-host',
      'Free todz cloud spots are extremely limited; self-hosting is always open',
      DOCS_INSTALL_URL,
      `${DOCS_URL}/self-host`,
      `${DOCS_URL}/privacy`,
    ].forEach((fact) => expect(body).toContain(fact));
  });
});

describe('the pages carry no stale phrase', () => {
  test.each(STALE_COPY_FILES)('%s', async (path) => {
    const body = await (await siteGet({ path })).text();
    STALE_PHRASES.forEach((phrase) => expect(body).not.toMatch(phrase));
  });
});

describe('llms-full.txt for a live product', () => {
  test('names the download and the open source licence', async () => {
    const body = await (await siteGet({ path: DiscoveryPath.LlmsFull })).text();
    [DOWNLOAD_URL, REPOSITORY.url, REPOSITORY.licenseName].forEach((fact) => expect(body).toContain(fact));
  });
});

describe('the landing policy', () => {
  test('keeps the same directives, hash based and with no unsafe-inline', async () => {
    const response = await siteGet({ path: '/' });
    const policy = response.headers.get('Content-Security-Policy');
    expect(policy?.split('; ').map((directive) => directive.split(' ')[0])).toEqual(CONTENT_SECURITY_DIRECTIVE_NAMES);
    expect(policy).not.toContain("'unsafe-inline'");
  });
});
