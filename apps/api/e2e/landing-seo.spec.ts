import { type Page, expect, test } from '@playwright/test';
import { AgentClient, agentSetupOf } from '../src/site/agent-setup';
import { DISCOVERY_COPY } from '../src/site/discovery-copy';
import { DOCS_URL, MCP_URL } from '../src/site/site-urls';
import { WEBMCP_COPY, WebMcpToolName } from '../src/site/webmcp-copy';
import {
  BOTH_MODEL_CONTEXT_STUB,
  DOCUMENT_MODEL_CONTEXT_STUB,
  ModelContextOwner,
  NAVIGATOR_MODEL_CONTEXT_STUB,
  NO_MODEL_CONTEXT_STUB,
} from './model-context-stub';
import {
  JAVASCRIPT_CONTENT_TYPE,
  SLOW_TURNSTILE_STUB,
  TURNSTILE_DUMMY_TOKEN,
  TURNSTILE_RESPONSE_FIELD,
  TURNSTILE_SCRIPT_URL,
  TURNSTILE_STUB,
} from './turnstile-stub';

const LANDING_PATH = '/';
const JOIN_PATH = '/join';
const JOINED_NOTICE = "You're on the list. Check your inbox.";
const KEY_PLACEHOLDER = '<key>';
const DOCS_PAGE = 'quickstart';
const NOT_AN_ADDRESS = 'not-an-address';
const TOOL_NAMES = Object.values(WebMcpToolName);
const DOCS_PAGE_ANSWER = '<!doctype html><title>Quickstart</title>';

type RegisteredTool = { owner: ModelContextOwner; name: string };

declare global {
  interface Window {
    registeredTools: { owner: ModelContextOwner; tool: { name: string } }[];
    callTool: (name: string, input: Record<string, string>) => Promise<string>;
    reportToolAnswer: (text: string) => void;
  }
}

function uniqueAddress(): string {
  const { project, testId } = test.info();
  return `maria.${project.name}.${testId}@example.com`;
}

async function registeredTools(page: Page): Promise<RegisteredTool[]> {
  return page.evaluate(() => window.registeredTools.map(({ owner, tool }) => ({ owner, name: tool.name })));
}

function callTool({ page, name, input }: { page: Page; name: WebMcpToolName; input: Record<string, string> }): Promise<string> {
  return page.evaluate(([toolName, toolInput]) => window.callTool(String(toolName), toolInput as Record<string, string>), [name, input]);
}

function watchConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (message) => message.type() === 'error' && errors.push(message.text()));
  page.on('pageerror', (error) => errors.push(error.message));
  return errors;
}

test.beforeEach(async ({ page }) => {
  await page.route(TURNSTILE_SCRIPT_URL, (route) => route.fulfill({ contentType: JAVASCRIPT_CONTENT_TYPE, body: TURNSTILE_STUB }));
});

test.describe('WebMCP registration', () => {
  test('registers the four tools on document.modelContext', async ({ page }) => {
    await page.addInitScript(DOCUMENT_MODEL_CONTEXT_STUB);
    await page.goto(LANDING_PATH);
    expect(await registeredTools(page)).toEqual(TOOL_NAMES.map((name) => ({ owner: ModelContextOwner.Document, name })));
  });

  test('registers the four tools on navigator.modelContext when document has none', async ({ page }) => {
    await page.addInitScript(NAVIGATOR_MODEL_CONTEXT_STUB);
    await page.goto(LANDING_PATH);
    expect(await registeredTools(page)).toEqual(TOOL_NAMES.map((name) => ({ owner: ModelContextOwner.Navigator, name })));
  });

  test('registers on document only when both exist', async ({ page }) => {
    await page.addInitScript(BOTH_MODEL_CONTEXT_STUB);
    await page.goto(LANDING_PATH);
    expect((await registeredTools(page)).map(({ owner }) => owner)).toEqual(TOOL_NAMES.map(() => ModelContextOwner.Document));
  });

  test('registers nothing and logs no error when the browser has no model context', async ({ page }) => {
    const errors = watchConsoleErrors(page);
    await page.addInitScript(NO_MODEL_CONTEXT_STUB);
    await page.goto(LANDING_PATH);
    expect(await registeredTools(page)).toEqual([]);
    expect(errors).toEqual([]);
  });
});

test.describe('WebMCP tools', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(DOCUMENT_MODEL_CONTEXT_STUB);
  });

  test('get_todz_overview answers with the summary and the docs address', async ({ page }) => {
    await page.goto(LANDING_PATH);
    const answer = await callTool({ page, name: WebMcpToolName.Overview, input: {} });
    expect(answer).toContain(DISCOVERY_COPY.summary);
    expect(answer).toContain(DOCS_URL);
  });

  test('get_mcp_setup answers the Codex block with the key placeholder', async ({ page }) => {
    await page.goto(LANDING_PATH);
    const answer = await callTool({ page, name: WebMcpToolName.Setup, input: { client: AgentClient.Codex } });
    expect(answer).toContain(agentSetupOf({ client: AgentClient.Codex, serverUrl: MCP_URL, key: KEY_PLACEHOLDER }));
  });

  test('open_docs navigates to the docs page', async ({ page }) => {
    await page.route(`${DOCS_URL}/**`, (route) => route.fulfill({ contentType: 'text/html', body: DOCS_PAGE_ANSWER }));
    await page.goto(LANDING_PATH);
    await page.evaluate(
      ([name, input]) => void window.callTool(String(name), input as Record<string, string>),
      [WebMcpToolName.Docs, { page: DOCS_PAGE }],
    );
    await page.waitForURL(`${DOCS_URL}/${DOCS_PAGE}`);
  });

  test('join_waitlist submits the form through the page and lands on the joined notice', async ({ page }) => {
    const posts: (string | null)[] = [];
    page.on('request', (request) => request.method() === 'POST' && request.url().endsWith(JOIN_PATH) && posts.push(request.postData()));
    await page.goto(LANDING_PATH);
    const answers: string[] = [];
    await page.exposeFunction('reportToolAnswer', (text: string) => answers.push(text));
    await page.evaluate(
      ([name, input]) => void window.callTool(String(name), input as Record<string, string>).then((text) => window.reportToolAnswer(text)),
      [WebMcpToolName.Join, { email: uniqueAddress() }],
    );
    await expect(page.locator('#join-notice')).toHaveText(JOINED_NOTICE);
    expect(answers).toEqual([WEBMCP_COPY.answers.sent]);
    expect(posts).toHaveLength(1);
    expect(posts[0]).toContain(`${TURNSTILE_RESPONSE_FIELD}=${encodeURIComponent(TURNSTILE_DUMMY_TOKEN)}`);
  });

  test('join_waitlist refuses an invalid address and posts nothing', async ({ page }) => {
    const posts: string[] = [];
    page.on('request', (request) => request.method() === 'POST' && posts.push(request.url()));
    await page.goto(LANDING_PATH);
    const answer = await callTool({ page, name: WebMcpToolName.Join, input: { email: NOT_AN_ADDRESS } });
    expect(answer).toBe(WEBMCP_COPY.answers.invalid);
    expect(posts).toEqual([]);
  });

  test.describe('while the Turnstile token is pending', () => {
    test.beforeEach(async ({ page }) => {
      await page.route(TURNSTILE_SCRIPT_URL, (route) => route.fulfill({ contentType: JAVASCRIPT_CONTENT_TYPE, body: SLOW_TURNSTILE_STUB }));
    });

    test('a second join_waitlist answers already submitting and one POST /join leaves', async ({ page }) => {
      const posts: string[] = [];
      page.on('request', (request) => request.method() === 'POST' && request.url().endsWith(JOIN_PATH) && posts.push(request.url()));
      await page.goto(LANDING_PATH);
      const answers = await page.evaluate(
        async ([name, address]) => [
          await window.callTool(String(name), { email: String(address) }),
          await window.callTool(String(name), { email: String(address) }),
        ],
        [WebMcpToolName.Join, uniqueAddress()],
      );
      expect(answers).toEqual([WEBMCP_COPY.answers.sent, WEBMCP_COPY.answers.alreadySubmitting]);
      await expect(page.locator('#join-notice')).toHaveText(JOINED_NOTICE);
      expect(posts).toHaveLength(1);
    });
  });
});
