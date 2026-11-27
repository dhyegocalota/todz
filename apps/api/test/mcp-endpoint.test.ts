import { DEFAULT_MAX_REQUEST_BODY_SIZE, JSONRPC_VERSION, LATEST_PROTOCOL_VERSION } from '@modelcontextprotocol/server';
import { env, exports } from 'cloudflare:workers';
import { describe, expect, test } from 'vitest';
import { serveMcp } from '../src/mcp-endpoint';
import { countingEnv } from './counting-namespace';
import { accessSecret, revokeToken, seedOwner, seedProject, seedProjectToken, seedProjectWithToken } from './directory-seed';
import { CLOCK_NOW } from './task-fixtures';

const MCP_URL = 'http://localhost:8787/mcp';
const WORKER_ORIGIN = 'http://localhost:8787';
const SESSION_HEADER = 'Mcp-Session-Id';
const INITIALIZE_REQUEST_ID = 7;
const TOOLS_LIST_REQUEST_ID = 8;
const CLIENT_NAME = 'Claude Code';
const OK_STATUS = 200;
const UNAUTHORIZED_STATUS = 401;
const NOT_FOUND_STATUS = 404;
const METHOD_NOT_ALLOWED_STATUS = 405;
const PAYLOAD_TOO_LARGE_STATUS = 413;
const UNSUPPORTED_PROTOCOL_VERSION = '1999-01-01';
const JSON_RPC_ERROR_MARK = '"error"';
const BEARER_CHALLENGE = 'Bearer';

function initializeBody(params: unknown): unknown {
  return { jsonrpc: JSONRPC_VERSION, id: INITIALIZE_REQUEST_ID, method: 'initialize', params };
}

function initializeParams(clientInfo: unknown): unknown {
  return { protocolVersion: LATEST_PROTOCOL_VERSION, capabilities: {}, clientInfo };
}

function initializeOf(name: unknown): unknown {
  return initializeBody(initializeParams({ name, version: '1.0.0' }));
}

const TOOLS_LIST_BODY = { jsonrpc: JSONRPC_VERSION, id: TOOLS_LIST_REQUEST_ID, method: 'tools/list', params: {} };

function mcpRequest({ authorization, body, method = 'POST' }: { authorization: string | null; body: unknown; method?: string }): Request {
  const headers = new Headers({ 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' });
  if (authorization !== null) headers.set('Authorization', authorization);
  const isBodyless = method === 'GET' || method === 'DELETE';
  if (isBodyless) return new Request(MCP_URL, { method, headers });
  return new Request(MCP_URL, { method, headers, body: requestText(body) });
}

function requestText(body: unknown): string {
  if (typeof body === 'string') return body;
  return JSON.stringify(body);
}

function bearer(token: string): string {
  return `Bearer ${token}`;
}

describe('paths other than /mcp', () => {
  test.each([
    { method: 'GET', path: '/' },
    { method: 'POST', path: '/other' },
  ])('$method $path answers 404 with an empty body', async ({ method, path }) => {
    const response = await exports.default.fetch(`${WORKER_ORIGIN}${path}`, { method });
    expect(response.status).toBe(NOT_FOUND_STATUS);
    expect(await response.text()).toBe('');
  });
});

describe('a refused credential', () => {
  test.each([
    { name: 'no authorization header', authorization: () => null },
    { name: 'the basic scheme', authorization: (token: string) => `Basic ${token}` },
    { name: 'a blank secret', authorization: () => 'Bearer    ' },
    { name: 'two spaces after the scheme', authorization: (token: string) => `Bearer  ${token}` },
    { name: 'an access token never issued', authorization: () => bearer(accessSecret()) },
    { name: 'the token without its prefix', authorization: (token: string) => bearer(token.slice(token.indexOf('_') + 1)) },
  ])('$name answers 401 and addresses no Durable Object', async ({ authorization }) => {
    const { token } = await seedProjectWithToken();
    const { countedEnv, addressingCalls } = countingEnv();
    const request = mcpRequest({ authorization: authorization(token), body: initializeOf(CLIENT_NAME) });
    const response = await serveMcp({ request, env: countedEnv, now: CLOCK_NOW });
    expect(response.status).toBe(UNAUTHORIZED_STATUS);
    expect(response.headers.get('WWW-Authenticate')).toContain(BEARER_CHALLENGE);
    expect(addressingCalls).toEqual([]);
  });

  test('a revoked token answers 401, addresses no Durable Object and keeps the empty body', async () => {
    const { token } = await seedProjectWithToken();
    await revokeToken(token);
    const { countedEnv, addressingCalls } = countingEnv();
    const request = mcpRequest({ authorization: bearer(token), body: initializeOf(CLIENT_NAME) });
    const response = await serveMcp({ request, env: countedEnv, now: CLOCK_NOW });
    expect(response.status).toBe(UNAUTHORIZED_STATUS);
    expect(await response.text()).toBe('');
    expect(addressingCalls).toEqual([]);
  });

  test('an expired token answers 401 with the empty body so the client refreshes it', async () => {
    const projectId = await seedProject({ ownerId: await seedOwner() });
    const token = await seedProjectToken({ projectId, expiresAt: CLOCK_NOW });
    const response = await serveMcp({
      request: mcpRequest({ authorization: bearer(token), body: initializeOf(CLIENT_NAME) }),
      env,
      now: CLOCK_NOW,
    });
    expect(response.status).toBe(UNAUTHORIZED_STATUS);
    expect(await response.text()).toBe('');
  });
});

describe('an accepted credential', () => {
  test('the scheme in lower case is accepted', async () => {
    const { token } = await seedProjectWithToken();
    const response = await exports.default.fetch(mcpRequest({ authorization: `bearer ${token}`, body: initializeOf(CLIENT_NAME) }));
    await response.body?.cancel();
    expect(response.status).toBe(OK_STATUS);
  });

  test('an initialize opens no session: the app is named by its registration', async () => {
    const { token } = await seedProjectWithToken();
    const response = await exports.default.fetch(mcpRequest({ authorization: bearer(token), body: initializeOf(CLIENT_NAME) }));
    await response.body?.cancel();
    expect(response.status).toBe(OK_STATUS);
    expect(response.headers.get(SESSION_HEADER)).toBeNull();
  });

  test.each(['GET', 'DELETE'])('%s answers 405 allowing POST', async (method) => {
    const { token } = await seedProjectWithToken();
    const response = await exports.default.fetch(mcpRequest({ authorization: bearer(token), body: null, method }));
    expect(response.status).toBe(METHOD_NOT_ALLOWED_STATUS);
    expect(response.headers.get('Allow')).toBe('POST');
    expect(await response.text()).toBe('');
  });
});

describe('edge cases found during execution', () => {
  test.each(['/constructor', '/__proto__', '/toString', '/mcp/', '/MCP'])(
    'POST %s with a valid token and an initialize answers 404',
    async (path) => {
      const { token } = await seedProjectWithToken();
      const headers = { Authorization: bearer(token), 'Content-Type': 'application/json' };
      const response = await exports.default.fetch(`${WORKER_ORIGIN}${path}`, {
        method: 'POST',
        headers,
        body: requestText(initializeOf(CLIENT_NAME)),
      });
      expect(response.status).toBe(NOT_FOUND_STATUS);
      expect(await response.text()).toBe('');
    },
  );

  test('a tab after the scheme answers 401 and addresses no Durable Object', async () => {
    const { token } = await seedProjectWithToken();
    const { countedEnv, addressingCalls } = countingEnv();
    const request = mcpRequest({ authorization: `Bearer\t${token}`, body: initializeOf(CLIENT_NAME) });
    const response = await serveMcp({ request, env: countedEnv, now: CLOCK_NOW });
    expect(response.status).toBe(UNAUTHORIZED_STATUS);
    expect(addressingCalls).toEqual([]);
  });

  test('a trailing space after the token is dropped by the platform and the token is accepted', async () => {
    const { token } = await seedProjectWithToken();
    const response = await exports.default.fetch(mcpRequest({ authorization: `${bearer(token)} `, body: initializeOf(CLIENT_NAME) }));
    await response.body?.cancel();
    expect(response.status).toBe(OK_STATUS);
  });

  test.each(['PUT', 'PATCH', 'OPTIONS', 'HEAD'])('%s with a valid token answers 405 allowing POST', async (method) => {
    const { token } = await seedProjectWithToken();
    const response = await exports.default.fetch(new Request(MCP_URL, { method, headers: { Authorization: bearer(token) } }));
    expect(response.status).toBe(METHOD_NOT_ALLOWED_STATUS);
    expect(response.headers.get('Allow')).toBe('POST');
  });

  test('an initialize with a protocol version the server does not know is answered on the version it speaks', async () => {
    const { token } = await seedProjectWithToken();
    const params = { protocolVersion: UNSUPPORTED_PROTOCOL_VERSION, capabilities: {}, clientInfo: { name: CLIENT_NAME, version: '1.0.0' } };
    const response = await exports.default.fetch(mcpRequest({ authorization: bearer(token), body: initializeBody(params) }));
    const text = await response.text();
    expect(response.status).toBe(OK_STATUS);
    expect(text).toContain(`"protocolVersion":"${LATEST_PROTOCOL_VERSION}"`);
  });

  test.each([
    { name: 'a protocol version that is not a string', params: { protocolVersion: 5, capabilities: {} } },
    { name: 'no capabilities', params: { protocolVersion: LATEST_PROTOCOL_VERSION } },
  ])('an initialize with $name is answered with an error by the SDK', async ({ params }) => {
    const { token } = await seedProjectWithToken();
    const body = initializeBody({ ...params, clientInfo: { name: CLIENT_NAME, version: '1.0.0' } });
    const response = await exports.default.fetch(mcpRequest({ authorization: bearer(token), body }));
    expect(await response.text()).toContain(JSON_RPC_ERROR_MARK);
  });

  test('a body over the size limit answers 413 with a token and 401 without one', async () => {
    const { token } = await seedProjectWithToken();
    const padding = 'x'.repeat(DEFAULT_MAX_REQUEST_BODY_SIZE);
    const hugeList = await exports.default.fetch(mcpRequest({ authorization: bearer(token), body: { ...TOOLS_LIST_BODY, padding } }));
    await hugeList.body?.cancel();
    expect(hugeList.status).toBe(PAYLOAD_TOO_LARGE_STATUS);
    const withoutToken = await exports.default.fetch(mcpRequest({ authorization: null, body: padding }));
    expect(withoutToken.status).toBe(UNAUTHORIZED_STATUS);
  });
});
