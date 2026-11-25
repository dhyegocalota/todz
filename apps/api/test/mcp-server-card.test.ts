import { SUPPORTED_PROTOCOL_VERSIONS } from '@modelcontextprotocol/server';
import { PROJECT_KEY_PREFIX } from '@todz/types';
import { exports } from 'cloudflare:workers';
import { describe, expect, test } from 'vitest';
import { MCP_SERVER_VERSION } from '../src/mcp-server';
import { SITE_ICONS, SiteIcon } from '../src/site/site-icons';
import { DiscoveryPath, MCP_URL, SERVER_CARD_PATH, SITE_URL } from '../src/site/site-urls';

const LOCAL_API_ORIGIN = 'http://localhost:8787';
const LOCAL_SITE_ORIGIN = 'http://localhost:8788';
const OK_STATUS = 200;
const UNAUTHORIZED_STATUS = 401;
const NOT_FOUND_STATUS = 404;
const CARD_TYPE = 'application/mcp-server-card+json';
const JSON_TYPE = 'application/json';
const CARD_SCHEMA = 'https://static.modelcontextprotocol.io/schemas/v1/server-card.schema.json';
const CARD_NAME_PATTERN = /^[a-zA-Z0-9.-]+\/[a-zA-Z0-9._-]+$/;
const CATALOG_IDENTIFIER_PATTERN = /^urn:air:[^:]+:.+/;
const DESCRIPTION_MAX_LENGTH = 100;
const OPEN_ACCESS = '*';
const PUBLIC_CACHE_CONTROL = 'public, max-age=3600';
const STRICT_TRANSPORT_SECURITY = 'max-age=31536000; includeSubDomains';
const API_CARD_URL = `${LOCAL_API_ORIGIN}${SERVER_CARD_PATH}`;
const SITE_CARD_URL = `${LOCAL_SITE_ORIGIN}${DiscoveryPath.ServerCard}`;
const CARD_URLS = [API_CARD_URL, SITE_CARD_URL];
const FORBIDDEN_KEYS = ['tools', 'capabilities', 'prompts', 'resources'];
const MINIMUM_QUERIES = 2;
const MAXIMUM_QUERIES = 5;

type Json = Record<string, unknown>;

function isJson(value: unknown): value is Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function jsonOf(text: string): Json {
  const parsed: unknown = JSON.parse(text);
  if (!isJson(parsed)) throw new Error('the body is one JSON object');
  return parsed;
}

async function cardOf(url: string): Promise<Json> {
  return jsonOf(await (await exports.default.fetch(url)).text());
}

describe('the server card', () => {
  test('fits SEP-2127: schema, name, version, description, title, website and the 512 icon', async () => {
    const card = await cardOf(API_CARD_URL);
    const icon = SITE_ICONS[SiteIcon.Icon512];
    expect(card.$schema).toBe(CARD_SCHEMA);
    expect(card.name).toBe('app.todz/todz');
    expect(String(card.name)).toMatch(CARD_NAME_PATTERN);
    expect(card.version).toBe(MCP_SERVER_VERSION);
    expect(String(card.description).length).toBeGreaterThan(0);
    expect(String(card.description).length).toBeLessThanOrEqual(DESCRIPTION_MAX_LENGTH);
    expect(card.title).toBe('todz');
    expect(card.websiteUrl).toBe(SITE_URL);
    expect(card.icons).toEqual([{ src: `${SITE_URL}${icon.path}`, mimeType: icon.mediaType, sizes: [`${icon.size}x${icon.size}`] }]);
    expect(FORBIDDEN_KEYS.filter((key) => key in card)).toEqual([]);
  });

  test('has one remote, a secret Authorization header with no value, and the SDK protocol versions', async () => {
    const card = await cardOf(API_CARD_URL);
    expect(card.remotes).toEqual([
      {
        type: 'streamable-http',
        url: MCP_URL,
        headers: [{ name: 'Authorization', isRequired: true, isSecret: true }],
        supportedProtocolVersions: [...SUPPORTED_PROTOCOL_VERSIONS],
      },
    ]);
    expect(JSON.stringify(card)).not.toContain(PROJECT_KEY_PREFIX);
  });

  test.each(CARD_URLS)('%s answers the card with the public headers, kept by the security wrap', async (url) => {
    const response = await exports.default.fetch(url);
    expect(response.status).toBe(OK_STATUS);
    expect(response.headers.get('Content-Type')).toBe(CARD_TYPE);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe(OPEN_ACCESS);
    expect(response.headers.get('Access-Control-Allow-Methods')).toBe('GET');
    expect(response.headers.get('Cache-Control')).toBe(PUBLIC_CACHE_CONTROL);
    expect(response.headers.get('Strict-Transport-Security')).toBe(STRICT_TRANSPORT_SECURITY);
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
  });

  test('both hosts answer the same bytes', async () => {
    const apiBody = await (await exports.default.fetch(API_CARD_URL)).text();
    const siteBody = await (await exports.default.fetch(SITE_CARD_URL)).text();
    expect(apiBody.length).toBeGreaterThan(0);
    expect(apiBody).toBe(siteBody);
  });

  test.each(CARD_URLS)('%s answers HEAD with the headers and no body', async (url) => {
    const answer = await exports.default.fetch(url, { method: 'HEAD' });
    expect(answer.status).toBe(OK_STATUS);
    expect(answer.headers.get('Content-Type')).toBe(CARD_TYPE);
    expect(await answer.text()).toBe('');
  });

  test.each(CARD_URLS.flatMap((url) => ['POST', 'OPTIONS'].map((method): [string, string] => [url, method])))(
    '%s answers %s with an empty 404 and no open access',
    async (url, method) => {
      const response = await exports.default.fetch(url, { method });
      expect(response.status).toBe(NOT_FOUND_STATUS);
      expect(await response.text()).toBe('');
      expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull();
    },
  );

  test('the MCP endpoint still refuses a request without a bearer', async () => {
    const response = await exports.default.fetch(`${LOCAL_API_ORIGIN}/mcp`, { method: 'POST' });
    expect(response.status).toBe(UNAUTHORIZED_STATUS);
  });
});

describe('the catalog', () => {
  test('lists the card once, by URL, with two to five representative queries', async () => {
    const response = await exports.default.fetch(`${LOCAL_SITE_ORIGIN}${DiscoveryPath.Catalog}`);
    const catalog = jsonOf(await response.text());
    expect(response.status).toBe(OK_STATUS);
    expect(response.headers.get('Content-Type')).toBe(JSON_TYPE);
    expect(response.headers.get('Cache-Control')).toBe(PUBLIC_CACHE_CONTROL);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe(OPEN_ACCESS);
    const entries: unknown[] = Array.isArray(catalog.entries) ? catalog.entries : [];
    const [entry] = entries.filter(isJson);
    expect(entries).toHaveLength(1);
    expect(entry).toMatchObject({
      identifier: 'urn:air:todz.app:mcp:todz',
      displayName: 'todz',
      type: CARD_TYPE,
      url: `${MCP_URL}/server-card`,
    });
    expect(String(entry?.identifier)).toMatch(CATALOG_IDENTIFIER_PATTERN);
    expect(entry).not.toHaveProperty('data');
    const queries: unknown[] = Array.isArray(entry?.representativeQueries) ? entry.representativeQueries : [];
    expect(queries.length).toBeGreaterThanOrEqual(MINIMUM_QUERIES);
    expect(queries.length).toBeLessThanOrEqual(MAXIMUM_QUERIES);
  });

  test.each(['POST', 'OPTIONS'])('answers %s with an empty 404', async (method) => {
    const response = await exports.default.fetch(`${LOCAL_SITE_ORIGIN}${DiscoveryPath.Catalog}`, { method });
    expect(response.status).toBe(NOT_FOUND_STATUS);
    expect(await response.text()).toBe('');
  });
});
