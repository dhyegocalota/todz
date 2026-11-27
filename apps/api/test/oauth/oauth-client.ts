import { createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { exports } from 'cloudflare:workers';
import { expect, vi } from 'vitest';
import { z } from 'zod';
import type { Env } from '../../src/env';
import { serveMcp } from '../../src/mcp-endpoint';
import { serveOAuth } from '../../src/oauth/oauth-endpoint';
import { TURNSTILE_DUMMY_TOKEN } from '../../src/turnstile';
import { seedEmailIdentity, seedOwner, seedProject } from '../directory-seed';
import { EMAIL_SETTINGS, freshAddress } from '../email-sign-in-client';
import { workerEnvWith } from '../owner-client';
import { CLOCK_NOW } from '../task-fixtures';

export const OAUTH_ORIGIN = 'http://localhost:8787';
export const MCP_RESOURCE = `${OAUTH_ORIGIN}/mcp`;
export const LOOPBACK_REDIRECT_URI = 'http://127.0.0.1:33418/callback';
export const HTTPS_REDIRECT_URI = 'https://client.example.com/oauth/callback';
export const CLIENT_NAME = 'Claude Code';
export const CLIENT_STATE = 'state-from-the-client';
export const TIME_ZONE = 'America/Sao_Paulo';
const TURNSTILE_TEST_SITE_KEY = '1x00000000000000000000AA';

const FORM_MEDIA_TYPE = 'application/x-www-form-urlencoded';
const JSON_MEDIA_TYPE = 'application/json';
const SAME_ORIGIN = 'same-origin';
const FETCH_SITE_HEADER = 'Sec-Fetch-Site';
const COOKIE_PAIR_SEPARATOR = '; ';
const MAIL_LINK_PATTERN = /\/oauth\/sign-in#token=([A-Za-z0-9_-]{43})&request=([A-Za-z0-9%._~*'()!-]+)/;
const HIDDEN_INPUT_PATTERN = /<input type="hidden" name="([a-z_]+)" value="([^"]*)">/g;
const RADIO_PATTERN = /<input type="radio" name="choice" value="([^"]+)"/g;
const RETURN_LINK_PATTERN = /<a class="admin-link" href="([^"]+)" data-return>/;
const MAIL_CODE_PATTERN = /(?:^|\s)([0-9]{6})(?:\s|$)/;
const CODE_GROUP = 1;
const LINK_GROUP = 1;
const TOKEN_GROUP = 1;
const REQUEST_GROUP = 2;
const NAME_GROUP = 1;
const VALUE_GROUP = 2;
const CREATED_STATUS = 201;
const OK_STATUS = 200;
const SEE_OTHER_STATUS = 303;
const VERIFIER_BYTE_LENGTH = 32;
const HTML_ENTITIES: [string, string][] = [
  ['&quot;', '"'],
  ['&#39;', "'"],
  ['&lt;', '<'],
  ['&gt;', '>'],
  ['&amp;', '&'],
];

const RegistrationSchema = z.object({ client_id: z.string() });
const TokensSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string(),
  token_type: z.string(),
  expires_in: z.number(),
  scope: z.string(),
});

export type Tokens = z.output<typeof TokensSchema>;

export type Browser = { cookies: Map<string, string> };

export type Pkce = { verifier: string; challenge: string };

export function oauthEnv(settings: Partial<Env> = {}): Env {
  return workerEnvWith({ ...EMAIL_SETTINGS, TURNSTILE_SITE_KEY: TURNSTILE_TEST_SITE_KEY, ...settings });
}

export async function serveOAuthRequest({
  request,
  workerEnv = oauthEnv(),
  now = CLOCK_NOW,
}: {
  request: Request;
  workerEnv?: Env;
  now?: number;
}): Promise<Response> {
  const executionContext = createExecutionContext();
  const response = await serveOAuth({ request, env: workerEnv, now, executionContext });
  await waitOnExecutionContext(executionContext);
  return response;
}

function base64UrlOf(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/=+$/, '')
    .replaceAll('+', '-')
    .replaceAll('/', '_');
}

export async function pkcePair(): Promise<Pkce> {
  const verifier = base64UrlOf(crypto.getRandomValues(new Uint8Array(VERIFIER_BYTE_LENGTH)));
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return { verifier, challenge: base64UrlOf(new Uint8Array(digest)) };
}

function bodyRequest({
  path,
  body,
  mediaType,
  headers = {},
}: {
  path: string;
  body: string;
  mediaType: string;
  headers?: Record<string, string>;
}): Request {
  const contentLength = String(new TextEncoder().encode(body).length);
  return new Request(`${OAUTH_ORIGIN}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': mediaType, 'Content-Length': contentLength, ...headers },
    body,
  });
}

export function jsonRequest({ path, body, headers }: { path: string; body: unknown; headers?: Record<string, string> }): Request {
  return bodyRequest({ path, body: JSON.stringify(body), mediaType: JSON_MEDIA_TYPE, headers });
}

export function formRequest({
  path,
  fields,
  headers,
}: {
  path: string;
  fields: Record<string, string> | [string, string][];
  headers?: Record<string, string>;
}): Request {
  return bodyRequest({ path, body: new URLSearchParams(fields).toString(), mediaType: FORM_MEDIA_TYPE, headers });
}

export function clientMetadata(fields: Record<string, unknown> = {}): Record<string, unknown> {
  return { client_name: CLIENT_NAME, redirect_uris: [LOOPBACK_REDIRECT_URI], ...fields };
}

export async function registerClient({
  metadata = clientMetadata(),
  workerEnv,
  now,
}: { metadata?: Record<string, unknown>; workerEnv?: Env; now?: number } = {}): Promise<string> {
  const response = await serveOAuthRequest({ request: jsonRequest({ path: '/oauth/register', body: metadata }), workerEnv, now });
  expect(response.status).toBe(CREATED_STATUS);
  return RegistrationSchema.parse(await response.json()).client_id;
}

export function authorizeParams({
  clientId,
  challenge,
  redirectUri = LOOPBACK_REDIRECT_URI,
  fields = {},
}: {
  clientId: string;
  challenge: string;
  redirectUri?: string;
  fields?: Record<string, string>;
}): URLSearchParams {
  return new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    state: CLIENT_STATE,
    resource: MCP_RESOURCE,
    ...fields,
  });
}

export function newBrowser(): Browser {
  return { cookies: new Map() };
}

export function rememberCookies({ browser, response }: { browser: Browser; response: Response }): void {
  response.headers.getSetCookie().forEach((header) => {
    const [pair] = header.split(';');
    if (pair === undefined) return;
    const separator = pair.indexOf('=');
    const name = pair.slice(0, separator);
    const value = pair.slice(separator + 1);
    const isCleared = value === '' || header.includes('Max-Age=0');
    if (isCleared) {
      browser.cookies.delete(name);
      return;
    }
    browser.cookies.set(name, value);
  });
}

function cookieHeaderOf(browser: Browser): Record<string, string> {
  if (browser.cookies.size === 0) return {};
  return { Cookie: [...browser.cookies].map(([name, value]) => `${name}=${value}`).join(COOKIE_PAIR_SEPARATOR) };
}

export async function browserVisit({
  browser,
  request,
  workerEnv,
  now,
}: {
  browser: Browser;
  request: Request;
  workerEnv?: Env;
  now?: number;
}): Promise<Response> {
  const headers = new Headers(request.headers);
  if (!headers.has(FETCH_SITE_HEADER)) headers.set(FETCH_SITE_HEADER, SAME_ORIGIN);
  Object.entries(cookieHeaderOf(browser)).forEach(([name, value]) => headers.set(name, value));
  const response = await serveOAuthRequest({ request: new Request(request, { headers }), workerEnv, now });
  rememberCookies({ browser, response });
  return response;
}

export function authorizeRequest(params: URLSearchParams): Request {
  return new Request(`${OAUTH_ORIGIN}/oauth/authorize?${params}`);
}

export function decodedHtml(text: string): string {
  return HTML_ENTITIES.reduce((decoded, [entity, character]) => decoded.replaceAll(entity, character), text);
}

export function hiddenFieldsOf(html: string): Record<string, string> {
  return Object.fromEntries([...html.matchAll(HIDDEN_INPUT_PATTERN)].map((match) => [match[NAME_GROUP], decodedHtml(match[VALUE_GROUP]!)]));
}

export function choicesOf(html: string): string[] {
  return [...html.matchAll(RADIO_PATTERN)].map((match) => decodedHtml(match[NAME_GROUP]!));
}

export type MailedLink = { token: string; request: string };

export function mailedLinkOf(text: string): MailedLink {
  const match = MAIL_LINK_PATTERN.exec(text);
  if (match === null) throw new Error('the mail should carry an OAuth sign-in link');
  return { token: match[TOKEN_GROUP]!, request: decodeURIComponent(match[REQUEST_GROUP]!) };
}

export function mailedCodeOf(line: string): string {
  const { text } = z.object({ text: z.string() }).parse(JSON.parse(line));
  const code = MAIL_CODE_PATTERN.exec(text)?.[CODE_GROUP];
  if (code === undefined) throw new Error('the mail should carry a sign-in code');
  return code;
}

export async function askForLink({
  browser,
  params,
  email = freshAddress(),
  workerEnv,
  now,
}: {
  browser: Browser;
  params: URLSearchParams;
  email?: string;
  workerEnv?: Env;
  now?: number;
}): Promise<{ response: Response; mails: string[] }> {
  const output = vi.spyOn(console, 'log').mockImplementation(() => undefined);
  const response = await browserVisit({
    browser,
    request: formRequest({
      path: '/oauth/sign-in-links',
      fields: { email, 'cf-turnstile-response': TURNSTILE_DUMMY_TOKEN, request: params.toString() },
    }),
    workerEnv,
    now,
  });
  const mails = output.mock.calls.map(([line]) => String(line));
  output.mockRestore();
  return { response, mails };
}

export function spendLink({
  browser,
  token,
  workerEnv,
  now,
}: {
  browser: Browser;
  token: string;
  workerEnv?: Env;
  now?: number;
}): Promise<Response> {
  return browserVisit({
    browser,
    request: jsonRequest({ path: '/oauth/sessions', body: { token, time_zone: TIME_ZONE } }),
    workerEnv,
    now,
  });
}

export async function signedInBrowser({
  params,
  email = freshAddress(),
  workerEnv,
  now,
}: {
  params: URLSearchParams;
  email?: string;
  workerEnv?: Env;
  now?: number;
}): Promise<Browser> {
  const browser = newBrowser();
  const { mails } = await askForLink({ browser, params, email, workerEnv, now });
  const [mail] = mails;
  if (mail === undefined) throw new Error('asking for a link should mail one');
  const { token } = mailedLinkOf(mail);
  const spent = await spendLink({ browser, token, workerEnv, now });
  expect(spent.status).toBe(CREATED_STATUS);
  return browser;
}

export async function consentPage({
  browser,
  params,
  workerEnv,
  now,
}: {
  browser: Browser;
  params: URLSearchParams;
  workerEnv?: Env;
  now?: number;
}): Promise<string> {
  const response = await browserVisit({ browser, request: authorizeRequest(params), workerEnv, now });
  expect(response.status).toBe(OK_STATUS);
  return response.text();
}

export async function decide({
  browser,
  params,
  fields,
  workerEnv,
  now,
  headers,
}: {
  browser: Browser;
  params: URLSearchParams;
  fields: Record<string, string>;
  workerEnv?: Env;
  now?: number;
  headers?: Record<string, string>;
}): Promise<Response> {
  const html = await consentPage({ browser, params, workerEnv, now });
  return browserVisit({
    browser,
    request: formRequest({ path: '/oauth/authorize', fields: { ...hiddenFieldsOf(html), ...fields }, headers }),
    workerEnv,
    now,
  });
}

export function redirectedParams(response: Response): URLSearchParams {
  expect(response.status).toBe(SEE_OTHER_STATUS);
  const location = response.headers.get('Location');
  if (location === null) throw new Error('the answer should redirect');
  return new URL(location).searchParams;
}

export async function returnedParams(response: Response): Promise<URLSearchParams> {
  expect(response.status).toBe(OK_STATUS);
  expect(response.headers.get('Location')).toBeNull();
  const match = RETURN_LINK_PATTERN.exec(await response.text());
  if (match === null) throw new Error('the answer should link back to the client');
  return new URL(decodedHtml(match[LINK_GROUP]!)).searchParams;
}

export async function approvedCode({
  browser,
  params,
  choice,
  workerEnv,
  now,
}: {
  browser: Browser;
  params: URLSearchParams;
  choice: string;
  workerEnv?: Env;
  now?: number;
}): Promise<string> {
  const response = await decide({ browser, params, fields: { decision: 'approve', choice }, workerEnv, now });
  const code = (await returnedParams(response)).get('code');
  if (code === null) throw new Error('approving should redirect with a code');
  return code;
}

export function tokenRequest(fields: Record<string, string>): Request {
  return formRequest({ path: '/oauth/token', fields });
}

export async function exchangeCode({
  clientId,
  code,
  verifier,
  redirectUri = LOOPBACK_REDIRECT_URI,
  workerEnv,
  now,
}: {
  clientId: string;
  code: string;
  verifier: string;
  redirectUri?: string;
  workerEnv?: Env;
  now?: number;
}): Promise<Response> {
  return serveOAuthRequest({
    request: tokenRequest({
      grant_type: 'authorization_code',
      code,
      code_verifier: verifier,
      redirect_uri: redirectUri,
      client_id: clientId,
      resource: MCP_RESOURCE,
    }),
    workerEnv,
    now,
  });
}

export async function tokensOf(response: Response): Promise<Tokens> {
  expect(response.status).toBe(OK_STATUS);
  return TokensSchema.parse(await response.json());
}

export function refreshRequest({ clientId, refreshToken }: { clientId: string; refreshToken: string }): Request {
  return tokenRequest({ grant_type: 'refresh_token', refresh_token: refreshToken, client_id: clientId, resource: MCP_RESOURCE });
}

export type ConnectedClient = { clientId: string; tokens: Tokens; pkce: Pkce; params: URLSearchParams; browser: Browser };

export async function connectedClient({
  choiceOf,
  email = freshAddress(),
  now = CLOCK_NOW,
}: {
  choiceOf: (html: string) => string;
  email?: string;
  now?: number;
}): Promise<ConnectedClient> {
  const clientId = await registerClient({ now });
  const pkce = await pkcePair();
  const params = authorizeParams({ clientId, challenge: pkce.challenge });
  const browser = await signedInBrowser({ params, email, now });
  const choice = choiceOf(await consentPage({ browser, params, now }));
  const code = await approvedCode({ browser, params, choice, now });
  const tokens = await tokensOf(await exchangeCode({ clientId, code, verifier: pkce.verifier, now }));
  return { clientId, tokens, pkce, params, browser };
}

export function firstChoice(html: string): string {
  const [choice] = choicesOf(html);
  if (choice === undefined) throw new Error('the consent page should offer a choice');
  return choice;
}

export function mcpRequest({ token, body }: { token: string | null; body: unknown }): Request {
  const authorization: Record<string, string> = token === null ? {} : { Authorization: `Bearer ${token}` };
  return new Request(MCP_RESOURCE, {
    method: 'POST',
    headers: { 'Content-Type': JSON_MEDIA_TYPE, Accept: 'application/json, text/event-stream', ...authorization },
    body: JSON.stringify(body),
  });
}

export function serveMcpCall({ token, body, now = CLOCK_NOW }: { token: string | null; body: unknown; now?: number }): Promise<Response> {
  return serveMcp({ request: mcpRequest({ token, body }), env: oauthEnv(), now });
}

export function workerFetch(request: Request): Promise<Response> {
  return exports.default.fetch(request);
}

export type SeededOwner = { ownerId: string; email: string; projectId: string };

export async function seededOwner(): Promise<SeededOwner> {
  const ownerId = await seedOwner();
  const email = freshAddress();
  await seedEmailIdentity({ ownerId, email });
  const projectId = await seedProject({ ownerId });
  return { ownerId, email, projectId };
}
