import { createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { exports } from 'cloudflare:workers';
import { describe, expect, test } from 'vitest';
import { MCP_COPY, McpToolName } from '../src/mcp-copy';
import worker from '../src/index';
import { AgentClient, agentSetupOf } from '../src/site/agent-setup';
import { LANDING_COPY } from '../src/site/landing-copy';
import { SITE_ICONS, SiteIcon } from '../src/site/site-icons';
import { DOCS_URL, DiscoveryPath, MCP_URL, SITE_URL } from '../src/site/site-urls';
import { workerEnvWith } from './owner-client';

const LOCAL_SITE_ORIGIN = 'http://localhost:8788';
const LOCAL_API_ORIGIN = 'http://localhost:8787';
const PRODUCTION_SETTINGS = { PUBLIC_ORIGIN: 'https://api.todz.app', SITE_ORIGIN: 'https://todz.app' };
const WWW_ORIGIN = 'https://www.todz.app';
const OK_STATUS = 200;
const MOVED_PERMANENTLY_STATUS = 301;
const NOT_FOUND_STATUS = 404;
const GET_METHOD = 'GET';
const HEAD_METHOD = 'HEAD';
const POST_METHOD = 'POST';
const TEXT_TYPE = 'text/plain; charset=utf-8';
const XML_TYPE = 'application/xml; charset=utf-8';
const MANIFEST_TYPE = 'application/manifest+json';
const PUBLIC_CACHE_CONTROL = 'public, max-age=3600';
const STRICT_TRANSPORT_SECURITY = 'max-age=31536000; includeSubDomains';
const KEY_PLACEHOLDER = '<key>';
const BACKGROUND_COLOR = '#070812';
const SITEMAP_NAMESPACE = 'http://www.sitemaps.org/schemas/sitemap/0.9';
const LOCATION_PATTERN = /<loc>([^<]*)<\/loc>/g;
const HEADING_PATTERN = /^## .+$/;
const LINK_LINE_PATTERN = /^- \[[^\]]+\]\(https:\/\/[^)]+\)(: .+)?$/;
const TOOL_LINE_PATTERN = /^- `(next|add|list|update|done)`: .+$/;
const LINK_URL_PATTERN = /\]\((https:\/\/[^)]+)\)/;
const SECTIONS = ['## Connect an agent', '## MCP tools', '## Docs', '## Optional'];
const FACTS = [
  'is out for macOS 14 or later',
  'not yet notarized by Apple',
  'Downloading todz is free',
  'Pricing has not been announced',
  'Logic Bit',
];
const CRAWLERS = [
  'Googlebot',
  'Bingbot',
  'GPTBot',
  'OAI-SearchBot',
  'ChatGPT-User',
  'ClaudeBot',
  'Claude-SearchBot',
  'Claude-User',
  'PerplexityBot',
  'Perplexity-User',
  'Google-Extended',
  'Applebot-Extended',
];
const DOCS_LINKS = [
  `${DOCS_URL}/`,
  `${DOCS_URL}/quickstart`,
  `${DOCS_URL}/install-on-mac`,
  `${DOCS_URL}/connect-an-agent`,
  `${DOCS_URL}/mcp-tools`,
  `${DOCS_URL}/self-host`,
];
const ROBOTS_LINES = [
  'User-agent: *',
  'Allow: /',
  '',
  ...CRAWLERS.flatMap((crawler) => [`User-agent: ${crawler}`, 'Allow: /', '']),
  `Sitemap: ${SITE_URL}${DiscoveryPath.Sitemap}`,
  `Sitemap: ${DOCS_URL}${DiscoveryPath.Sitemap}`,
];
const ROBOTS_TEXT = `${ROBOTS_LINES.join('\n')}\n`;
const DISCOVERY_FILES = [
  { path: DiscoveryPath.Robots, contentType: TEXT_TYPE },
  { path: DiscoveryPath.Sitemap, contentType: XML_TYPE },
  { path: DiscoveryPath.Llms, contentType: TEXT_TYPE },
  { path: DiscoveryPath.LlmsFull, contentType: TEXT_TYPE },
  { path: DiscoveryPath.Manifest, contentType: MANIFEST_TYPE },
];
const MANIFEST_ICONS = [SiteIcon.Icon192, SiteIcon.Icon512, SiteIcon.Maskable192, SiteIcon.Maskable512].map((icon) => {
  const { path, size, mediaType, purpose } = SITE_ICONS[icon];
  return { src: path, sizes: `${size}x${size}`, type: mediaType, purpose };
});

function request({ origin, path, method }: { origin: string; path: string; method: string }): Promise<Response> {
  return exports.default.fetch(`${origin}${path}`, { method });
}

async function serveFromEdge(edgeRequest: Request): Promise<Response> {
  const executionContext = createExecutionContext();
  const response = await worker.fetch(
    edgeRequest as Request<unknown, IncomingRequestCfProperties>,
    workerEnvWith(PRODUCTION_SETTINGS),
    executionContext,
  );
  await waitOnExecutionContext(executionContext);
  return response;
}

function siteGet(path: string): Promise<Response> {
  return request({ origin: LOCAL_SITE_ORIGIN, path, method: GET_METHOD });
}

async function bodyOf(path: string): Promise<string> {
  const response = await siteGet(path);
  expect(response.status).toBe(OK_STATUS);
  return response.text();
}

function sectionOf({ body, heading }: { body: string; heading: string }): string[] {
  const lines = body.split('\n');
  const start = lines.indexOf(heading);
  const following = lines.slice(start + 1);
  const end = following.findIndex((line) => HEADING_PATTERN.test(line));
  return end < 0 ? following : following.slice(0, end);
}

function isSubsequence({ lines, whole }: { lines: string[]; whole: string[] }): boolean {
  const rest = lines.reduce<string[] | null>((remaining, line) => {
    if (remaining === null) return null;
    const index = remaining.indexOf(line);
    return index < 0 ? null : remaining.slice(index + 1);
  }, whole);
  return rest !== null;
}

describe('the discovery files', () => {
  describe.each(DISCOVERY_FILES)('$path', ({ path, contentType }) => {
    test('answers GET with its type and cache, and the security wrap keeps both', async () => {
      const response = await siteGet(path);
      expect(response.status).toBe(OK_STATUS);
      expect(response.headers.get('Content-Type')).toBe(contentType);
      expect(response.headers.get('Cache-Control')).toBe(PUBLIC_CACHE_CONTROL);
      expect(response.headers.get('Strict-Transport-Security')).toBe(STRICT_TRANSPORT_SECURITY);
      expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
      expect((await response.text()).length).toBeGreaterThan(0);
    });

    test('answers HEAD with the same headers and no body', async () => {
      const answer = await request({ origin: LOCAL_SITE_ORIGIN, path, method: HEAD_METHOD });
      const reference = await siteGet(path);
      expect(answer.status).toBe(OK_STATUS);
      ['Content-Type', 'Cache-Control'].forEach((name) => expect(answer.headers.get(name)).toBe(reference.headers.get(name)));
      expect(await answer.text()).toBe('');
    });

    test('answers 404 on the API host, to POST and with a trailing slash', async () => {
      const onApiHost = await request({ origin: LOCAL_API_ORIGIN, path, method: GET_METHOD });
      const posted = await request({ origin: LOCAL_SITE_ORIGIN, path, method: POST_METHOD });
      const slashed = await siteGet(`${path}/`);
      expect([onApiHost.status, posted.status, slashed.status]).toEqual([NOT_FOUND_STATUS, NOT_FOUND_STATUS, NOT_FOUND_STATUS]);
    });
  });

  test('robots.txt allows everyone, names the twelve crawlers and lists both sitemaps, with no Disallow', async () => {
    const body = await bodyOf(DiscoveryPath.Robots);
    expect(body).toBe(ROBOTS_TEXT);
    expect(body).not.toContain('Disallow');
  });

  test('sitemap.xml lists the landing and nothing that redirects', async () => {
    const body = await bodyOf(DiscoveryPath.Sitemap);
    expect(body).toContain(`<urlset xmlns="${SITEMAP_NAMESPACE}">`);
    expect([...body.matchAll(LOCATION_PATTERN)].map(([, location]) => location)).toEqual([`${SITE_URL}/`]);
  });

  test('site.webmanifest carries the spec members and the icons of site-icons.ts', async () => {
    const manifest: unknown = JSON.parse(await bodyOf(DiscoveryPath.Manifest));
    expect(manifest).toEqual({
      name: LANDING_COPY.meta.siteName,
      short_name: LANDING_COPY.meta.siteName,
      description: LANDING_COPY.meta.description,
      start_url: '/',
      scope: '/',
      display: 'browser',
      background_color: BACKGROUND_COLOR,
      theme_color: BACKGROUND_COLOR,
      icons: MANIFEST_ICONS,
    });
  });

  test('www redirects the files to the apex host', async () => {
    const answers = await Promise.all(
      [DiscoveryPath.Llms, DiscoveryPath.Robots].map((path) => serveFromEdge(new Request(`${WWW_ORIGIN}${path}`, { redirect: 'manual' }))),
    );
    expect(answers.map(({ status }) => status)).toEqual([MOVED_PERMANENTLY_STATUS, MOVED_PERMANENTLY_STATUS]);
    expect(answers.map((answer) => answer.headers.get('Location'))).toEqual([
      `${SITE_URL}${DiscoveryPath.Llms}`,
      `${SITE_URL}${DiscoveryPath.Robots}`,
    ]);
  });
});

describe('llms.txt', () => {
  const claudeCodeLine = agentSetupOf({ client: AgentClient.ClaudeCode, serverUrl: MCP_URL, key: KEY_PLACEHOLDER });

  test('starts with the name and a blockquote, then holds the facts', async () => {
    const body = await bodyOf(DiscoveryPath.Llms);
    expect(body.startsWith('# todz\n\n> ')).toBe(true);
    FACTS.forEach((fact) => expect(body).toContain(fact));
  });

  test('never says the app is a download: the file is static and a release may not be staged', async () => {
    expect(await bodyOf(DiscoveryPath.Llms)).not.toContain('is a download');
  });

  test('holds the four sections in order', async () => {
    const body = await bodyOf(DiscoveryPath.Llms);
    expect(body.split('\n').filter((line) => HEADING_PATTERN.test(line))).toEqual(SECTIONS);
  });

  test('every list line is a link or a tool line', async () => {
    const lines = (await bodyOf(DiscoveryPath.Llms)).split('\n').filter((line) => line.startsWith('- '));
    expect(lines.length).toBeGreaterThan(0);
    expect(lines.filter((line) => !LINK_LINE_PATTERN.test(line) && !TOOL_LINE_PATTERN.test(line))).toEqual([]);
  });

  test('holds the exact Claude Code line and one line per tool with its copy', async () => {
    const body = await bodyOf(DiscoveryPath.Llms);
    expect(body).toContain(claudeCodeLine);
    expect(sectionOf({ body, heading: '## MCP tools' }).filter((line) => line.startsWith('- '))).toEqual(
      Object.values(McpToolName).map((name) => `- \`${name}\`: ${MCP_COPY.tools[name]}`),
    );
  });

  test('links every docs page, the self-host guide on docs.todz.app included, and never todz.app/self-host', async () => {
    const body = await bodyOf(DiscoveryPath.Llms);
    const docsLinks = sectionOf({ body, heading: '## Docs' })
      .filter((line) => line.startsWith('- '))
      .map((line) => LINK_URL_PATTERN.exec(line)?.[1]);
    expect(docsLinks).toEqual(DOCS_LINKS);
    expect(body).not.toContain(`${SITE_URL}/self-host`);
  });
});

describe('llms-full.txt', () => {
  test('holds every line of llms.txt in order', async () => {
    const lines = (await bodyOf(DiscoveryPath.Llms)).split('\n');
    const whole = (await bodyOf(DiscoveryPath.LlmsFull)).split('\n');
    expect(isSubsequence({ lines, whole })).toBe(true);
  });

  test('holds the three setups in full and every tool parameter text', async () => {
    const body = await bodyOf(DiscoveryPath.LlmsFull);
    Object.values(AgentClient).forEach((client) =>
      expect(body).toContain(agentSetupOf({ client, serverUrl: MCP_URL, key: KEY_PLACEHOLDER })),
    );
    Object.values(MCP_COPY.fields).forEach((text) => expect(body).toContain(text));
  });
});
