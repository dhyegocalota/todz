import { createHash, randomBytes } from 'node:crypto';
import fs from 'node:fs';
import { type Server, createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import { type APIRequestContext, type Browser, type BrowserContext, type Page, type Route, expect, test } from '@playwright/test';
import { PERSIST_FOLDER_VARIABLE } from './persist-folder';
import { OAUTH_ORIGIN, OAUTH_SERVER_LOG_FILE_NAME } from './site-environment';
import { JAVASCRIPT_CONTENT_TYPE, TURNSTILE_SCRIPT_URL, TURNSTILE_STUB } from './turnstile-stub';

const LOOPBACK_HOST = '127.0.0.1';
const ANY_FREE_PORT = 0;
const CALLBACK_PATH = '/callback';
const LANDING_PATH = '/connected';
const FOUND_STATUS = 302;
const MCP_URL = `${OAUTH_ORIGIN}/mcp`;
const DECISION_URL = `${OAUTH_ORIGIN}/oauth/authorize`;
const CLIENT_NAME = 'Claude Code';
const CLIENT_STATE = 'e2e-state';
const VERIFIER_BYTE_LENGTH = 32;
const LOGGED_MESSAGE_START = '{"to":';
const MAILED_LINK_PATTERN = /https?:\/\/[^\s"\\]+\/oauth\/sign-in#token=[A-Za-z0-9_-]{43}&request=[A-Za-z0-9%._~*'()!-]+/;
const EVENT_DATA_PREFIX = 'data: ';
const MAIL_POLL_TIMEOUT_MS = 15_000;
const MEDIA_FOLDER = '.pr-media';
const CALLBACK_PAGE = '<!doctype html><title>Back in the client</title><p>Back in the client</p>';
const OWNER_CHOICE = 'owner';
const WORKSPACE_NAME = 'Launch';

type MailedMessage = { to: string; text: string };
type Tokens = { access_token: string; refresh_token: string; scope: string };
type Pkce = { verifier: string; challenge: string };
type ToolsAnswer = { result: { tools: { name: string }[] } };
type Loopback = { redirectUri: string; server: Server };
type Connection = { page: Page; request: APIRequestContext; address: string; redirectUri: string; landingUri: string };
type ConsentField = [string, string];
type BouncingConnection = { connection: Connection; close: () => Promise<void> };
type Approval = { code: string; consentFields: ConsentField[] };

enum Press {
  Once = 'once',
  Twice = 'twice',
}

function serverLogPath(): string {
  const persistFolder = process.env[PERSIST_FOLDER_VARIABLE];
  if (persistFolder === undefined) throw new Error('the Playwright configuration did not create the persist folder');
  return path.join(persistFolder, OAUTH_SERVER_LOG_FILE_NAME);
}

function lastMailedLinkTo(address: string): string | null {
  const [message] = fs
    .readFileSync(serverLogPath(), 'utf8')
    .split('\n')
    .filter((line) => line.includes(LOGGED_MESSAGE_START))
    .map((line) => JSON.parse(line.slice(line.indexOf(LOGGED_MESSAGE_START))) as MailedMessage)
    .filter((logged) => logged.to === address)
    .reverse();
  if (message === undefined) return null;
  const link = MAILED_LINK_PATTERN.exec(message.text)?.[0];
  if (link === undefined) return null;
  return link;
}

function pkcePair(): Pkce {
  const verifier = randomBytes(VERIFIER_BYTE_LENGTH).toString('base64url');
  return { verifier, challenge: createHash('sha256').update(verifier).digest('base64url') };
}

async function listening({ server, path: routePath }: { server: Server; path: string }): Promise<Loopback> {
  await new Promise<void>((resolve) => server.listen(ANY_FREE_PORT, LOOPBACK_HOST, resolve));
  const { port } = server.address() as AddressInfo;
  return { redirectUri: `http://${LOOPBACK_HOST}:${port}${routePath}`, server };
}

function loopbackListener(routePath: string = CALLBACK_PATH): Promise<Loopback> {
  const server = createServer((_request, response) => {
    response.writeHead(200, { 'Content-Type': 'text/html' });
    response.end(CALLBACK_PAGE);
  });
  return listening({ server, path: routePath });
}

function bouncingListener(landingUri: string): Promise<Loopback> {
  const server = createServer((request, response) => {
    const { search } = new URL(request.url!, landingUri);
    response.writeHead(FOUND_STATUS, { Location: `${landingUri}${search}` });
    response.end();
  });
  return listening({ server, path: CALLBACK_PATH });
}

async function registerClient({ request, redirectUri }: { request: APIRequestContext; redirectUri: string }): Promise<string> {
  const response = await request.post(`${OAUTH_ORIGIN}/oauth/register`, {
    data: { client_name: CLIENT_NAME, redirect_uris: [redirectUri] },
  });
  expect(response.status()).toBe(201);
  return ((await response.json()) as { client_id: string }).client_id;
}

function authorizeUrlOf({ clientId, challenge, redirectUri }: { clientId: string; challenge: string; redirectUri: string }): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    state: CLIENT_STATE,
    resource: MCP_URL,
  });
  return `${OAUTH_ORIGIN}/oauth/authorize?${params}`;
}

async function browserContextOf(browser: Browser): Promise<BrowserContext> {
  const context = await browser.newContext();
  await context.route(TURNSTILE_SCRIPT_URL, (route) => route.fulfill({ contentType: JAVASCRIPT_CONTENT_TYPE, body: TURNSTILE_STUB }));
  return context;
}

async function snapshot({ page, name }: { page: Page; name: string }): Promise<void> {
  const projectName = test.info().project.name;
  await page.screenshot({ path: path.join(MEDIA_FOLDER, `oauth-${name}-${projectName}.png`), fullPage: true, animations: 'disabled' });
}

async function signIn({ page, address, authorizeUrl }: { page: Page; address: string; authorizeUrl: string }): Promise<void> {
  await page.goto(authorizeUrl);
  await expect(page.getByRole('heading', { level: 1, name: `Sign in to connect ${CLIENT_NAME}` })).toBeVisible();
  await snapshot({ page, name: 'email' });
  await page.getByLabel('Email address').fill(address);
  await page.getByRole('button', { name: 'Email me a link' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Check your inbox' })).toBeVisible();
  await snapshot({ page, name: 'inbox' });
  await expect.poll(() => lastMailedLinkTo(address), { timeout: MAIL_POLL_TIMEOUT_MS }).not.toBeNull();
  const link = lastMailedLinkTo(address);
  if (link === null) throw new Error('the mail should carry a link');
  await page.goto(link);
  await expect(page.getByRole('heading', { level: 1, name: `Connect ${CLIENT_NAME} to todz?` })).toBeVisible();
  expect(page.url()).not.toContain('token=');
}

async function approvedCode({
  page,
  choice,
  landingUri,
  press,
}: {
  page: Page;
  choice: string | null;
  landingUri: string;
  press: Press;
}): Promise<Approval> {
  if (choice !== null) await page.locator(`input[name="choice"][value="${choice}"]`).check();
  await snapshot({ page, name: choice === null ? 'consent-project' : 'consent-owner' });
  const consentFields = await consentFieldsOf(page);
  const heldDecisions: Route[] = [];
  await page.route(DECISION_URL, (route) => {
    heldDecisions.push(route);
  });
  const approve = page.getByRole('button', { name: 'Approve' });
  await approve.scrollIntoViewIfNeeded();
  const box = await approve.boundingBox();
  if (box === null) throw new Error('Approve should be on screen');
  const center = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  await page.mouse.click(center.x, center.y);
  await expect.poll(() => heldDecisions.length).toBe(1);
  if (press === Press.Twice) await page.mouse.click(center.x, center.y);
  const [firstDecision] = heldDecisions;
  if (firstDecision === undefined) throw new Error('Approve should post the decision');
  await firstDecision.continue();
  await page.waitForURL(`${landingUri}?**`);
  await page.unroute(DECISION_URL);
  expect(heldDecisions).toHaveLength(1);
  await expect(page.getByText('Back in the client')).toBeVisible();
  const redirected = new URL(page.url()).searchParams;
  expect(redirected.get('state')).toBe(CLIENT_STATE);
  expect(redirected.get('iss')).toBe(OAUTH_ORIGIN);
  const code = redirected.get('code');
  if (code === null) throw new Error('approving should hand the client a code');
  return { code, consentFields };
}

async function exchange({
  request,
  clientId,
  code,
  pkce,
  redirectUri,
}: {
  request: APIRequestContext;
  clientId: string;
  code: string;
  pkce: Pkce;
  redirectUri: string;
}): Promise<Tokens> {
  const response = await request.post(`${OAUTH_ORIGIN}/oauth/token`, {
    form: {
      grant_type: 'authorization_code',
      code,
      code_verifier: pkce.verifier,
      redirect_uri: redirectUri,
      client_id: clientId,
      resource: MCP_URL,
    },
  });
  expect(response.status()).toBe(200);
  expect(response.headers()['cache-control']).toBe('no-store');
  return (await response.json()) as Tokens;
}

async function connect({
  connection,
  choice,
  press = Press.Once,
}: {
  connection: Connection;
  choice: string | null;
  press?: Press;
}): Promise<{ clientId: string; tokens: Tokens; consentFields: ConsentField[] }> {
  const { page, request, address, redirectUri, landingUri } = connection;
  const clientId = await registerClient({ request, redirectUri });
  const pkce = pkcePair();
  await signIn({ page, address, authorizeUrl: authorizeUrlOf({ clientId, challenge: pkce.challenge, redirectUri }) });
  const { code, consentFields } = await approvedCode({ page, choice, landingUri, press });
  return { clientId, tokens: await exchange({ request, clientId, code, pkce, redirectUri }), consentFields };
}

function consentFieldsOf(page: Page): Promise<ConsentField[]> {
  return page
    .locator('form.consent-form')
    .evaluate((form: HTMLFormElement) => [...new FormData(form)].map(([name, value]): [string, string] => [name, String(value)]));
}

async function replayConsent({ page, fields }: { page: Page; fields: ConsentField[] }): Promise<void> {
  const replayed: ConsentField[] = [...fields, ['decision', 'approve']];
  await page.goto(DECISION_URL);
  await page.evaluate(
    ({ action, replayed }) => {
      const form = document.createElement('form');
      form.method = 'post';
      form.action = action;
      replayed.forEach(([name, value]) => {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = name;
        input.value = value;
        form.append(input);
      });
      document.body.append(form);
      form.submit();
    },
    { action: DECISION_URL, replayed },
  );
}

function mcpCall({ request, token, method, params }: { request: APIRequestContext; token: string; method: string; params: unknown }) {
  return request.post(MCP_URL, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json, text/event-stream' },
    data: { jsonrpc: '2.0', id: 1, method, params },
  });
}

function messageOf(body: string): unknown {
  const eventLine = body.split('\n').find((line) => line.startsWith(EVENT_DATA_PREFIX));
  if (eventLine === undefined) return JSON.parse(body);
  return JSON.parse(eventLine.slice(EVENT_DATA_PREFIX.length));
}

async function toolNames({ request, token }: { request: APIRequestContext; token: string }): Promise<string[]> {
  const response = await mcpCall({ request, token, method: 'tools/list', params: {} });
  expect(response.status()).toBe(200);
  return (messageOf(await response.text()) as ToolsAnswer).result.tools.map((tool) => tool.name);
}

async function createWorkspace({ request, token }: { request: APIRequestContext; token: string }): Promise<void> {
  const created = await mcpCall({
    request,
    token,
    method: 'tools/call',
    params: { name: 'create_workspace', arguments: { name: WORKSPACE_NAME } },
  });
  expect(created.status()).toBe(200);
}

test('an MCP client connects with OAuth: register, sign in by link, consent, exchange, tools, refresh, revoke', async ({
  browser,
  request,
}) => {
  const context = await browserContextOf(browser);
  const loopback = await loopbackListener();
  const connection = {
    page: await context.newPage(),
    request,
    address: `oauth-${crypto.randomUUID()}@example.com`,
    redirectUri: loopback.redirectUri,
    landingUri: loopback.redirectUri,
  };

  const unchallenged = await request.post(MCP_URL, { data: { jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} } });
  expect(unchallenged.status()).toBe(401);
  expect(unchallenged.headers()['www-authenticate']).toBe(
    `Bearer resource_metadata="${OAUTH_ORIGIN}/.well-known/oauth-protected-resource/mcp"`,
  );

  const owner = await connect({ connection, choice: OWNER_CHOICE });
  expect(owner.tokens.scope).toBe('owner');
  expect(await toolNames({ request, token: owner.tokens.access_token })).toContain('create_workspace');
  await createWorkspace({ request, token: owner.tokens.access_token });

  const project = await connect({ connection, choice: null });
  expect(project.tokens.scope).toMatch(/^project:/);
  const projectTools = await toolNames({ request, token: project.tokens.access_token });
  expect(projectTools).toContain('add');
  expect(projectTools).not.toContain('create_workspace');

  const refreshed = await request.post(`${OAUTH_ORIGIN}/oauth/token`, {
    form: { grant_type: 'refresh_token', refresh_token: project.tokens.refresh_token, client_id: project.clientId, resource: MCP_URL },
  });
  expect(refreshed.status()).toBe(200);
  const renewed = (await refreshed.json()) as Tokens;
  expect(await toolNames({ request, token: renewed.access_token })).toContain('add');

  const revoked = await request.post(`${OAUTH_ORIGIN}/oauth/revoke`, {
    form: { token: renewed.refresh_token, client_id: project.clientId },
  });
  expect(revoked.status()).toBe(200);
  expect((await mcpCall({ request, token: renewed.access_token, method: 'tools/list', params: {} })).status()).toBe(401);
  await context.close();
  loopback.server.close();
});

async function bouncingConnection({ browser, request }: { browser: Browser; request: APIRequestContext }): Promise<BouncingConnection> {
  const context = await browserContextOf(browser);
  const landing = await loopbackListener(LANDING_PATH);
  const bouncing = await bouncingListener(landing.redirectUri);
  const connection: Connection = {
    page: await context.newPage(),
    request,
    address: `oauth-${crypto.randomUUID()}@example.com`,
    redirectUri: bouncing.redirectUri,
    landingUri: landing.redirectUri,
  };
  async function close(): Promise<void> {
    await context.close();
    landing.server.close();
    bouncing.server.close();
  }
  return { connection, close };
}

test('approving lands on the client even when its redirect URI redirects again to another origin', async ({ browser, request }) => {
  const { connection, close } = await bouncingConnection({ browser, request });

  const owner = await connect({ connection, choice: OWNER_CHOICE });
  await createWorkspace({ request, token: owner.tokens.access_token });
  const project = await connect({ connection, choice: null });

  expect(owner.tokens.scope).toBe('owner');
  expect(project.tokens.scope).toMatch(/^project:/);
  await close();
});

test('Approve pressed again while the first approval is on its way posts once, and a replayed approval says it was already approved', async ({
  browser,
  request,
}) => {
  const { connection, close } = await bouncingConnection({ browser, request });

  const owner = await connect({ connection, choice: OWNER_CHOICE, press: Press.Twice });
  await createWorkspace({ request, token: owner.tokens.access_token });
  const project = await connect({ connection, choice: null, press: Press.Twice });
  expect(project.tokens.scope).toMatch(/^project:/);
  await replayConsent({ page: connection.page, fields: project.consentFields });

  await expect(connection.page.getByRole('heading', { level: 1, name: 'Already approved' })).toBeVisible();
  await expect(connection.page.getByLabel('Email address')).toHaveCount(0);
  await snapshot({ page: connection.page, name: 'already-approved' });
  await close();
});

test('an unknown app gets an error page and is never redirected', async ({ browser }) => {
  const context = await browserContextOf(browser);
  const page = await context.newPage();

  const response = await page.goto(
    authorizeUrlOf({ clientId: 'A'.repeat(43), challenge: pkcePair().challenge, redirectUri: `http://${LOOPBACK_HOST}${CALLBACK_PATH}` }),
  );

  expect(response?.status()).toBe(400);
  expect(page.url().startsWith(`${OAUTH_ORIGIN}/oauth/authorize`)).toBe(true);
  await expect(page.getByRole('heading', { level: 1, name: "This link can't be used to connect an app" })).toBeVisible();
  await snapshot({ page, name: 'error' });
  await context.close();
});
