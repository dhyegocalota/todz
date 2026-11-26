import { exports } from 'cloudflare:workers';
import { describe, expect, test } from 'vitest';
import { AgentClient } from '../src/site/agent-setup';
import { DOCS_PAGES } from '../src/site/discovery-copy';
import { WEBMCP_COPY, WebMcpToolName } from '../src/site/webmcp-copy';
import { WEBMCP_SCRIPT, WEBMCP_TOOLS, type WebMcpTool } from '../src/site/webmcp-script';
import { inlineSources, sourceHash } from './page-script';

const LOCAL_SITE_ORIGIN = 'http://localhost:8788';
const PLAIN_SCRIPT_PATTERN = /<script>([\s\S]*?)<\/script>/g;
const NETWORK_CALLS = ['fetch(', 'XMLHttpRequest', 'sendBeacon'];
const READ_ONLY_TOOLS = [WebMcpToolName.Overview, WebMcpToolName.Setup, WebMcpToolName.Docs];

function toolNamed(name: WebMcpToolName): WebMcpTool {
  const tool = WEBMCP_TOOLS.find((candidate) => candidate.name === name);
  if (tool === undefined) throw new Error(`the tool ${name} is defined`);
  return tool;
}

function enumOf({ name, property }: { name: WebMcpToolName; property: string }): string[] | undefined {
  return toolNamed(name).inputSchema.properties[property]?.enum;
}

async function pageOf(path: string): Promise<{ html: string; policy: string | null }> {
  const response = await exports.default.fetch(`${LOCAL_SITE_ORIGIN}${path}`);
  return { html: await response.text(), policy: response.headers.get('Content-Security-Policy') };
}

describe('the WebMCP tool definitions', () => {
  test('hold the three tools, each described by the copy', () => {
    expect(WEBMCP_TOOLS.map((tool) => tool.name)).toEqual(Object.values(WebMcpToolName));
    WEBMCP_TOOLS.forEach((tool) => {
      expect(tool.description.length).toBeGreaterThan(0);
      expect(tool.description).toBe(WEBMCP_COPY.descriptions[tool.name as WebMcpToolName]);
    });
  });

  test('take an object schema with no extra property and a required list inside the declared ones', () => {
    expect(WEBMCP_TOOLS.length).toBeGreaterThan(0);
    WEBMCP_TOOLS.forEach(({ inputSchema }) => {
      expect(inputSchema.type).toBe('object');
      expect(inputSchema.additionalProperties).toBe(false);
      expect(inputSchema.required.filter((property) => !(property in inputSchema.properties))).toEqual([]);
    });
  });

  test('offer the agent clients and the docs pages the rest of the site knows', () => {
    expect(enumOf({ name: WebMcpToolName.Setup, property: 'client' })).toEqual(Object.values(AgentClient));
    expect(enumOf({ name: WebMcpToolName.Docs, property: 'page' })).toEqual(DOCS_PAGES.map(({ slug }) => slug));
  });

  test('mark every tool read-only', () => {
    expect(READ_ONLY_TOOLS.map((name) => toolNamed(name).annotations)).toEqual(READ_ONLY_TOOLS.map(() => ({ readOnlyHint: true })));
  });
});

describe('the WebMCP copy', () => {
  test('answers only for the unknown client and the unknown page', () => {
    expect(Object.keys(WEBMCP_COPY.answers).sort()).toEqual(['unknownClient', 'unknownPage']);
  });
});

describe('the scripts the landing ships', () => {
  test('WEBMCP_SCRIPT makes no network call of its own, which connect-src self would permit (pin: green when it landed)', () => {
    expect(WEBMCP_SCRIPT.length).toBeGreaterThan(0);
    NETWORK_CALLS.forEach((call) => expect(WEBMCP_SCRIPT).not.toContain(call));
  });
});

describe('the WebMCP script on the pages', () => {
  test('the landing writes it once and allows it by hash', async () => {
    const { html, policy } = await pageOf('/');
    const matches = inlineSources({ html, pattern: PLAIN_SCRIPT_PATTERN }).filter((source) => source === WEBMCP_SCRIPT);
    expect(WEBMCP_SCRIPT.length).toBeGreaterThan(0);
    expect(matches).toHaveLength(1);
    expect(policy).toContain(await sourceHash(WEBMCP_SCRIPT));
  });

  test('the self-host guide holds none (pin: green when it landed)', async () => {
    const { html } = await pageOf('/self-host');
    expect(inlineSources({ html, pattern: PLAIN_SCRIPT_PATTERN }).filter((source) => source.includes('registerTool'))).toEqual([]);
  });
});
