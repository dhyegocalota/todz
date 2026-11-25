import { type Page, expect, test } from '@playwright/test';
import { AgentClient, agentSetupOf } from '../src/site/agent-setup';
import { DISCOVERY_COPY } from '../src/site/discovery-copy';
import { LANDING_SHOTS, LandingShot } from '../src/site/landing-shots';
import { OPEN_GRAPH_IMAGE, SITE_ICONS } from '../src/site/site-icons';
import { DOCS_URL, DiscoveryPath, MCP_URL } from '../src/site/site-urls';
import { WAITLIST_FILL_HOLD_MS } from '@todz/types';
import { WEBMCP_COPY, WebMcpToolName } from '../src/site/webmcp-copy';
import { WEBMCP_CHECK_WAIT_MS } from '../src/site/webmcp-script';
import {
  BOTH_MODEL_CONTEXT_STUB,
  DOCUMENT_MODEL_CONTEXT_STUB,
  ModelContextOwner,
  NAVIGATOR_MODEL_CONTEXT_STUB,
  NO_MODEL_CONTEXT_STUB,
} from './model-context-stub';
import { ProjectName } from './project-name';
import {
  JAVASCRIPT_CONTENT_TYPE,
  NEVER_SOLVING_TURNSTILE_STUB,
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
    policyViolations: string[];
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

  test('join_waitlist waits for the check, joins through the page without navigating and answers the outcome', async ({ page }) => {
    const posts: (string | null)[] = [];
    page.on('request', (request) => request.method() === 'POST' && request.url().endsWith(JOIN_PATH) && posts.push(request.postData()));
    await page.goto(LANDING_PATH);
    const landingUrl = page.url();
    const answers: string[] = [];
    await page.exposeFunction('reportToolAnswer', (text: string) => answers.push(text));
    await page.evaluate(
      ([name, input]) => void window.callTool(String(name), input as Record<string, string>).then((text) => window.reportToolAnswer(text)),
      [WebMcpToolName.Join, { email: uniqueAddress() }],
    );
    await expect.poll(() => answers).toEqual([WEBMCP_COPY.answers.joined]);
    await expect(page.locator('#join-notice')).toHaveText(JOINED_NOTICE);
    expect(page.url()).toBe(landingUrl);
    expect(posts).toHaveLength(1);
    expect(posts[0]).toContain(`${TURNSTILE_RESPONSE_FIELD}=${encodeURIComponent(TURNSTILE_DUMMY_TOKEN)}`);
  });

  test('join_waitlist answers that the check timed out when the person never solves it, and posts nothing', async ({ page }) => {
    await page.route(TURNSTILE_SCRIPT_URL, (route) =>
      route.fulfill({ contentType: JAVASCRIPT_CONTENT_TYPE, body: NEVER_SOLVING_TURNSTILE_STUB }),
    );
    const posts: string[] = [];
    page.on('request', (request) => request.method() === 'POST' && posts.push(request.url()));
    await page.clock.install();
    await page.goto(LANDING_PATH);
    const typedAddress = uniqueAddress();
    await page.locator('#join-email').fill(typedAddress);
    const answers: string[] = [];
    await page.exposeFunction('reportToolAnswer', (text: string) => answers.push(text));
    await page.evaluate(
      ([name, input]) => void window.callTool(String(name), input as Record<string, string>).then((text) => window.reportToolAnswer(text)),
      [WebMcpToolName.Join, { email: `other.${uniqueAddress()}` }],
    );
    await page.clock.fastForward(WEBMCP_CHECK_WAIT_MS);
    await expect.poll(() => answers).toEqual([WEBMCP_COPY.answers.checkTimedOut]);
    await expect(page.locator('#join-email')).toHaveValue(typedAddress);
    expect(posts).toEqual([]);
  });

  test('join_waitlist answers try again, not the timeout, when the form is waiting out a Retry-After', async ({ page }) => {
    await page.route(`**${JOIN_PATH}`, (route) =>
      route.request().method() === 'POST'
        ? route.fulfill({ status: 429, contentType: 'application/json', headers: { 'Retry-After': '60' }, body: '{"outcome":"try-again"}' })
        : route.continue(),
    );
    await page.clock.install();
    await page.goto(LANDING_PATH);
    await page.clock.fastForward(WAITLIST_FILL_HOLD_MS);
    const answers: string[] = [];
    await page.exposeFunction('reportToolAnswer', (text: string) => answers.push(text));
    const callJoin = () =>
      page.evaluate(
        ([name, input]) =>
          void window.callTool(String(name), input as Record<string, string>).then((text) => window.reportToolAnswer(text)),
        [WebMcpToolName.Join, { email: uniqueAddress() }],
      );
    await callJoin();
    await expect.poll(() => answers).toEqual([WEBMCP_COPY.answers.tryAgain]);
    await callJoin();
    await page.clock.fastForward(WEBMCP_CHECK_WAIT_MS);
    await expect.poll(() => answers).toEqual([WEBMCP_COPY.answers.tryAgain, WEBMCP_COPY.answers.tryAgain]);
  });

  test('two overlapping join_waitlist calls on an unsolved check submit the address of the first only', async ({ page }) => {
    await page.route(TURNSTILE_SCRIPT_URL, (route) =>
      route.fulfill({ contentType: JAVASCRIPT_CONTENT_TYPE, body: NEVER_SOLVING_TURNSTILE_STUB }),
    );
    const posts: (string | null)[] = [];
    page.on('request', (request) => request.method() === 'POST' && request.url().endsWith(JOIN_PATH) && posts.push(request.postData()));
    await page.clock.install();
    await page.goto(LANDING_PATH);
    await page.clock.fastForward(WAITLIST_FILL_HOLD_MS);
    const firstAddress = `first.${uniqueAddress()}`;
    const secondAddress = `second.${uniqueAddress()}`;
    const answers: string[] = [];
    await page.exposeFunction('reportToolAnswer', (text: string) => answers.push(text));
    await page.evaluate(
      ([name, first, second]) => {
        const report = (text: string) => window.reportToolAnswer(text);
        void window.callTool(String(name), { email: String(first) }).then(report);
        void window.callTool(String(name), { email: String(second) }).then(report);
      },
      [WebMcpToolName.Join, firstAddress, secondAddress],
    );
    await page.evaluate(() => Reflect.get(window, 'solveNow')());
    await expect.poll(() => answers).toEqual([WEBMCP_COPY.answers.alreadySubmitting, WEBMCP_COPY.answers.joined]);
    expect(posts).toHaveLength(1);
    expect(posts[0]).toContain(`email=${encodeURIComponent(firstAddress)}`);
  });

  test('join_waitlist refuses an invalid address and posts nothing', async ({ page }) => {
    const posts: string[] = [];
    page.on('request', (request) => request.method() === 'POST' && posts.push(request.url()));
    await page.goto(LANDING_PATH);
    const answer = await callTool({ page, name: WebMcpToolName.Join, input: { email: NOT_AN_ADDRESS } });
    expect(answer).toBe(WEBMCP_COPY.answers.invalid);
    expect(posts).toEqual([]);
  });

  test('join_waitlist puts the previous value of the field back when the address is invalid', async ({ page }) => {
    await page.goto(LANDING_PATH);
    const typedAddress = uniqueAddress();
    await page.locator('#join-email').fill(typedAddress);
    await callTool({ page, name: WebMcpToolName.Join, input: { email: NOT_AN_ADDRESS } });
    await expect(page.locator('#join-email')).toHaveValue(typedAddress);
  });

  test('a second join_waitlist while the first is sending answers already submitting and one POST /join leaves', async ({ page }) => {
    const posts: string[] = [];
    page.on('request', (request) => request.method() === 'POST' && request.url().endsWith(JOIN_PATH) && posts.push(request.url()));
    await page.goto(LANDING_PATH);
    const answers = await page.evaluate(
      ([name, address]) =>
        Promise.all([window.callTool(String(name), { email: String(address) }), window.callTool(String(name), { email: String(address) })]),
      [WebMcpToolName.Join, uniqueAddress()],
    );
    expect(answers).toEqual([WEBMCP_COPY.answers.joined, WEBMCP_COPY.answers.alreadySubmitting]);
    await expect(page.locator('#join-notice')).toHaveText(JOINED_NOTICE);
    expect(posts).toHaveLength(1);
  });
});

enum ColorScheme {
  Light = 'light',
  Dark = 'dark',
}

const OK_STATUS = 200;
const ICON_MEDIA_TYPE = 'image/x-icon';
const ALTERNATE_ICON_MEDIA_TYPE = 'image/vnd.microsoft.icon';
const MANIFEST_MEDIA_TYPE = 'application/manifest+json';
const PNG_WIDTH_OFFSET = 16;
const PNG_HEIGHT_OFFSET = 20;
const RATIO_TOLERANCE = 0.01;
const PERCENT_MULTIPLIER = 100;
const COLOR_SCHEMES = [ColorScheme.Light, ColorScheme.Dark];
const ASSET_FILES = [
  ...Object.values(SITE_ICONS).map(({ path, mediaType }) => ({
    path,
    mediaTypes: mediaType === ICON_MEDIA_TYPE ? [ICON_MEDIA_TYPE, ALTERNATE_ICON_MEDIA_TYPE] : [mediaType],
  })),
  { path: DiscoveryPath.Manifest, mediaTypes: [MANIFEST_MEDIA_TYPE] },
  { path: OPEN_GRAPH_IMAGE.path, mediaTypes: [OPEN_GRAPH_IMAGE.mediaType] },
];

test.describe('the files a browser asks for', () => {
  ASSET_FILES.forEach(({ path, mediaTypes }) => {
    test(`${path} answers 200 with its type`, async ({ request }) => {
      const response = await request.get(path);
      expect(response.status()).toBe(OK_STATUS);
      expect(mediaTypes).toContain(response.headers()['content-type']?.split(';')[0]);
    });
  });

  test('the share image is 1200 by 630', async ({ request }) => {
    const body = await (await request.get(OPEN_GRAPH_IMAGE.path)).body();
    expect([body.readUInt32BE(PNG_WIDTH_OFFSET), body.readUInt32BE(PNG_HEIGHT_OFFSET)]).toEqual([
      OPEN_GRAPH_IMAGE.width,
      OPEN_GRAPH_IMAGE.height,
    ]);
  });
});

COLOR_SCHEMES.forEach((colorScheme) => {
  test.describe(`the landing in the ${colorScheme} scheme`, () => {
    test.use({ colorScheme });

    test('logs no console error and no policy violation', async ({ page }) => {
      const errors = watchConsoleErrors(page);
      await page.addInitScript(() => {
        window.policyViolations = [];
        document.addEventListener('securitypolicyviolation', (event) => window.policyViolations.push(event.violatedDirective));
      });
      await page.goto(LANDING_PATH);
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      await page.waitForLoadState('networkidle');
      expect(errors).toEqual([]);
      expect(await page.evaluate(() => window.policyViolations)).toEqual([]);
    });

    test('downloads no window shot on a phone, which does not show it', async ({ page }) => {
      test.skip(test.info().project.name !== ProjectName.Mobile, 'runs on mobile only');
      const windowShotPaths = [LandingShot.Window, LandingShot.WindowDark].flatMap((shot) => [
        LANDING_SHOTS[shot].path,
        ...LANDING_SHOTS[shot].webp.map(({ path }) => path),
      ]);
      const requestedPaths: string[] = [];
      page.on('request', (request) => requestedPaths.push(new URL(request.url()).pathname));
      await page.goto(LANDING_PATH);
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      await page.waitForLoadState('networkidle');
      expect(requestedPaths.filter((path) => windowShotPaths.includes(path))).toEqual([]);
    });

    test('gives every image the ratio of its file, from its box or, when hidden, from its width and height attributes', async ({
      page,
    }) => {
      await page.goto(LANDING_PATH);
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      await page.waitForLoadState('networkidle');
      const distorted = await page.locator('img').evaluateAll(
        (images: HTMLImageElement[], tolerance) =>
          images
            .filter((image) => image.naturalWidth > 0)
            .map((image) => {
              const box = image.getBoundingClientRect();
              const hasBox = box.width > 0 && box.height > 0;
              const displayedWidth = hasBox ? box.width : Number(image.getAttribute('width'));
              const displayedHeight = hasBox ? box.height : Number(image.getAttribute('height'));
              return {
                source: image.currentSrc,
                displayed: displayedWidth / displayedHeight,
                expected: image.naturalWidth / image.naturalHeight,
              };
            })
            .filter(({ displayed, expected }) => Math.abs(displayed - expected) / expected > tolerance),
        RATIO_TOLERANCE,
      );
      expect(distorted, `images off by more than ${RATIO_TOLERANCE * PERCENT_MULTIPLIER} %`).toEqual([]);
    });
  });
});
