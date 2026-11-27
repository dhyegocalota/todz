import { type Page, expect, test } from '@playwright/test';
import { AgentClient, agentSetupOf } from '../src/site/agent-setup';
import { DISCOVERY_COPY } from '../src/site/discovery-copy';
import { LANDING_SHOTS, LandingShot } from '../src/site/landing-shots';
import { OPEN_GRAPH_IMAGE, SITE_ICONS } from '../src/site/site-icons';
import { DOCS_URL, DiscoveryPath, MCP_URL } from '../src/site/site-urls';
import { WEBMCP_COPY, WebMcpToolName } from '../src/site/webmcp-copy';
import {
  BOTH_MODEL_CONTEXT_STUB,
  DOCUMENT_MODEL_CONTEXT_STUB,
  ModelContextOwner,
  NAVIGATOR_MODEL_CONTEXT_STUB,
  NO_MODEL_CONTEXT_STUB,
} from './model-context-stub';
import { ProjectName } from './project-name';

const LANDING_PATH = '/';
const DOCS_PAGE = 'quickstart';
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

test.describe('WebMCP registration', () => {
  test('registers the three tools on document.modelContext', async ({ page }) => {
    await page.addInitScript(DOCUMENT_MODEL_CONTEXT_STUB);
    await page.goto(LANDING_PATH);
    expect(await registeredTools(page)).toEqual(TOOL_NAMES.map((name) => ({ owner: ModelContextOwner.Document, name })));
  });

  test('registers the three tools on navigator.modelContext when document has none', async ({ page }) => {
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

  test('get_mcp_setup answers the Codex block and says the client signs in with OAuth', async ({ page }) => {
    await page.goto(LANDING_PATH);
    const answer = await callTool({ page, name: WebMcpToolName.Setup, input: { client: AgentClient.Codex } });
    expect(answer).toContain(agentSetupOf({ client: AgentClient.Codex, serverUrl: MCP_URL }));
    expect(answer).toContain(WEBMCP_COPY.signInNote);
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
