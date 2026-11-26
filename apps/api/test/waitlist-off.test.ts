import { env, exports } from 'cloudflare:workers';
import { describe, expect, test } from 'vitest';
import { WEBMCP_SCRIPT, WEBMCP_TOOLS } from '../src/site/webmcp-script';

const LOCAL_SITE_ORIGIN = 'http://localhost:8788';
const GONE_STATUS = 410;
const JOIN_TOOL_NAME = 'join_waitlist';
const TURNSTILE_ORIGIN = 'https://challenges.cloudflare.com';
const WAITLIST_PATTERN = /waitlist|wait list/i;
const FORM_CONTENT_TYPE = 'application/x-www-form-urlencoded';
const JSON_ACCEPT = 'application/json';
const STRUCTURED_DATA_PATTERN = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/;
const FIRST_CAPTURE = 1;
const DISCOVERY_PATHS = ['/llms.txt', '/llms-full.txt'];

async function waitlistRowCount(): Promise<number> {
  const row = await env.DIRECTORY.prepare('SELECT COUNT(*) AS total FROM waitlist').first<{ total: number }>();
  if (row === null) throw new Error('the waitlist table answers a count');
  return row.total;
}

async function landing(): Promise<{ html: string; policy: string | null }> {
  const response = await exports.default.fetch(`${LOCAL_SITE_ORIGIN}/`);
  return { html: await response.text(), policy: response.headers.get('Content-Security-Policy') };
}

describe('POST /join once the waitlist is off', () => {
  test.each([
    ['a form post', { 'Content-Type': FORM_CONTENT_TYPE }],
    ['a JSON-accepting post', { 'Content-Type': FORM_CONTENT_TYPE, Accept: JSON_ACCEPT }],
  ])('answers 410 pointing to /download for %s and writes no row', async (_name, headers) => {
    const before = await waitlistRowCount();
    const response = await exports.default.fetch(`${LOCAL_SITE_ORIGIN}/join`, {
      method: 'POST',
      headers,
      body: new URLSearchParams({ email: 'maria@example.com' }),
    });
    expect(response.status).toBe(GONE_STATUS);
    expect(await response.text()).toContain('/download');
    expect(await waitlistRowCount()).toBe(before);
  });
});

describe('the landing once the waitlist is off', () => {
  test('has no form, no Turnstile widget and no waitlist word', async () => {
    const { html } = await landing();
    expect(html).not.toContain('<form');
    expect(html).not.toContain('cf-turnstile');
    expect(html).not.toContain(TURNSTILE_ORIGIN);
    expect(html).not.toMatch(WAITLIST_PATTERN);
  });

  test('offers the download as its call to action', async () => {
    const { html } = await landing();
    expect(html).toContain('href="/download"');
    expect(html).toContain('Download for Mac');
  });

  test('keeps the policy strict and drops the Turnstile source and frame', async () => {
    const { policy } = await landing();
    expect(policy).not.toBeNull();
    expect(policy).not.toContain(TURNSTILE_ORIGIN);
    expect(policy).not.toContain('frame-src');
    expect(policy).not.toContain('unsafe-inline');
    expect(policy).toContain("default-src 'none'");
  });

  test('describes the app without the waitlist in its structured data', async () => {
    const { html } = await landing();
    const structuredData = STRUCTURED_DATA_PATTERN.exec(html)?.[FIRST_CAPTURE];
    expect(structuredData).toBeDefined();
    expect(structuredData).not.toMatch(WAITLIST_PATTERN);
    expect(structuredData).not.toContain('PreOrder');
  });

  test.each(DISCOVERY_PATHS)('%s never mentions the waitlist', async (path) => {
    const text = await (await exports.default.fetch(`${LOCAL_SITE_ORIGIN}${path}`)).text();
    expect(text.length).toBeGreaterThan(0);
    expect(text).not.toMatch(WAITLIST_PATTERN);
  });
});

describe('the WebMCP tools once the waitlist is off', () => {
  test('hold no join_waitlist tool and no script that joins', () => {
    expect(WEBMCP_TOOLS.map((tool) => tool.name as string)).not.toContain(JOIN_TOOL_NAME);
    expect(WEBMCP_SCRIPT).not.toContain(JOIN_TOOL_NAME);
    expect(WEBMCP_SCRIPT).not.toMatch(WAITLIST_PATTERN);
  });
});
