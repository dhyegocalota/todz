import { exports } from 'cloudflare:workers';
import { describe, expect, test } from 'vitest';
import { COMPANY } from '@todz/types';
import { LANDING_COPY } from '../src/site/landing-copy';
import { OPEN_GRAPH_IMAGE } from '../src/site/site-icons';
import { SITE_URL } from '../src/site/site-urls';

const LOCAL_SITE_ORIGIN = 'http://localhost:8788';
const SCHEMA_CONTEXT = 'https://schema.org';
const COMPANY_LOGO = 'https://www.logicbit.com.br/favicon/apple-touch-icon.png';
const STRUCTURED_DATA_PATTERN = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g;
const SCRIPT_CLOSE_PATTERN = /<\/script/i;
const REFERENCE_KEYS = ['@id'];
const ORGANIZATION_ID = `${SITE_URL}/#publisher`;
const WEBSITE_ID = `${SITE_URL}/#website`;
const APPLICATION_ID = `${SITE_URL}/#app`;
const SCHEMA_URL = 'https://schema.org';
const GOOGLE_GUIDE_URL = 'https://developers.google.com/search/docs/appearance/structured-data';

type Node = Record<string, unknown>;

type Shape = { sources: string[]; required: string[]; allowed: string[] };

const SHAPES: Record<string, Shape> = {
  Organization: {
    sources: [`${SCHEMA_URL}/Organization`, `${GOOGLE_GUIDE_URL}/organization`],
    required: ['@type', '@id', 'name', 'url'],
    allowed: ['@type', '@id', 'name', 'legalName', 'url', 'logo'],
  },
  WebSite: {
    sources: [`${SCHEMA_URL}/WebSite`],
    required: ['@type', '@id', 'name', 'url'],
    allowed: ['@type', '@id', 'name', 'url', 'inLanguage', 'publisher'],
  },
  SoftwareApplication: {
    sources: [`${SCHEMA_URL}/SoftwareApplication`, `${GOOGLE_GUIDE_URL}/software-app`],
    required: ['@type', '@id', 'name', 'offers'],
    allowed: [
      '@type',
      '@id',
      'name',
      'description',
      'url',
      'image',
      'operatingSystem',
      'applicationCategory',
      'applicationSubCategory',
      'publisher',
      'offers',
    ],
  },
  Offer: {
    sources: [`${SCHEMA_URL}/Offer`, `${GOOGLE_GUIDE_URL}/software-app`],
    required: ['@type', 'price', 'priceCurrency'],
    allowed: ['@type', 'price', 'priceCurrency', 'availability', 'url'],
  },
};

const ORGANIZATION: Node = {
  '@type': 'Organization',
  '@id': ORGANIZATION_ID,
  name: COMPANY.tradeName,
  legalName: COMPANY.legalName,
  url: COMPANY.website,
  logo: COMPANY_LOGO,
};

const WEBSITE: Node = {
  '@type': 'WebSite',
  '@id': WEBSITE_ID,
  name: 'todz',
  url: `${SITE_URL}/`,
  inLanguage: 'en',
  publisher: { '@id': ORGANIZATION_ID },
};

const APPLICATION: Node = {
  '@type': 'SoftwareApplication',
  '@id': APPLICATION_ID,
  name: 'todz',
  description: LANDING_COPY.meta.description,
  url: `${SITE_URL}/`,
  image: `${SITE_URL}${OPEN_GRAPH_IMAGE.path}`,
  operatingSystem: 'macOS 14 or later',
  applicationCategory: 'BusinessApplication',
  applicationSubCategory: 'Productivity',
  publisher: { '@id': ORGANIZATION_ID },
  offers: {
    '@type': 'Offer',
    price: 0,
    priceCurrency: 'USD',
    availability: 'https://schema.org/PreOrder',
    url: `${SITE_URL}/#join`,
  },
};

const PAGES = [
  { path: '/', graph: [ORGANIZATION, WEBSITE, APPLICATION] },
  { path: '/self-host', graph: [ORGANIZATION, WEBSITE] },
];

function isNode(value: unknown): value is Node {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function blocksOf(html: string): string[] {
  return [...html.matchAll(STRUCTURED_DATA_PATTERN)].map(([, text]) => {
    if (text === undefined) throw new Error('a block always has content');
    return text;
  });
}

async function graphOf(path: string): Promise<{ block: string; context: unknown; graph: Node[] }> {
  const html = await (await exports.default.fetch(`${LOCAL_SITE_ORIGIN}${path}`)).text();
  const [block, ...others] = blocksOf(html);
  if (block === undefined || others.length > 0) throw new Error('the page holds exactly one application/ld+json block');
  const parsed: unknown = JSON.parse(block);
  if (!isNode(parsed) || !Array.isArray(parsed['@graph'])) throw new Error('the block holds a graph');
  return { block, context: parsed['@context'], graph: parsed['@graph'].filter(isNode) };
}

function typedNodes(value: unknown): Node[] {
  if (Array.isArray(value)) return value.flatMap(typedNodes);
  if (!isNode(value)) return [];
  const isTyped = '@type' in value;
  return [...(isTyped ? [value] : []), ...Object.values(value).flatMap(typedNodes)];
}

function referenceIds(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(referenceIds);
  if (!isNode(value)) return [];
  const isReference = Object.keys(value).join() === REFERENCE_KEYS.join();
  const nested = Object.values(value).flatMap(referenceIds);
  return isReference ? [String(value['@id']), ...nested] : nested;
}

function shapeIssues(node: Node): string[] {
  const shape = SHAPES[String(node['@type'])];
  if (shape === undefined) return [`unknown type ${String(node['@type'])}`];
  const missing = shape.required.filter((property) => !(property in node)).map((property) => `${String(node['@type'])} lacks ${property}`);
  const unknown = Object.keys(node)
    .filter((property) => !shape.allowed.includes(property))
    .map((property) => `${String(node['@type'])} has unknown ${property}`);
  return [...missing, ...unknown];
}

describe('the shape table', () => {
  test('every row cites schema.org, and every required property is allowed', () => {
    Object.values(SHAPES).forEach((shape) => {
      expect(shape.sources.some((source) => source.startsWith(`${SCHEMA_URL}/`))).toBe(true);
      expect(shape.required.filter((property) => !shape.allowed.includes(property))).toEqual([]);
    });
  });

  test('a missing required property and an unknown property are both reported', () => {
    expect(shapeIssues({ '@type': 'WebSite', '@id': WEBSITE_ID, name: 'todz', colour: 'blue' })).toEqual([
      'WebSite lacks url',
      'WebSite has unknown colour',
    ]);
  });
});

describe.each(PAGES)('the structured data of $path', ({ path, graph }) => {
  test('is one parseable block in the schema.org context', async () => {
    const { block, context } = await graphOf(path);
    expect(context).toBe(SCHEMA_CONTEXT);
    expect(block).not.toMatch(SCRIPT_CLOSE_PATTERN);
    expect(block).not.toContain('<');
  });

  test('holds the types of the spec, in order', async () => {
    const found = await graphOf(path);
    expect(found.graph.map((node) => node['@type'])).toEqual(graph.map((node) => node['@type']));
  });

  test('matches the shape table: every required property, no unknown one, nested objects included', async () => {
    const found = await graphOf(path);
    expect(typedNodes(found.graph).flatMap(shapeIssues)).toEqual([]);
  });

  test('resolves every reference inside the graph', async () => {
    const found = await graphOf(path);
    const ids = found.graph.map((node) => node['@id']);
    expect(referenceIds(found.graph).filter((id) => !ids.includes(id))).toEqual([]);
  });

  test('holds exactly the values of the spec', async () => {
    const found = await graphOf(path);
    expect(found.graph).toEqual(graph);
  });
});

describe('the organization', () => {
  test('is the company, logo included', async () => {
    const { graph } = await graphOf('/');
    expect(graph[0]).toMatchObject({
      name: COMPANY.tradeName,
      legalName: COMPANY.legalName,
      url: COMPANY.website,
      logo: COMPANY_LOGO,
    });
  });
});
