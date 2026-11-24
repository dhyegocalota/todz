import { DEFAULT_MAX_REQUEST_BODY_SIZE, INVALID_PARAMS, JSONRPC_VERSION, LATEST_PROTOCOL_VERSION } from '@modelcontextprotocol/server';
import { CLIENT_NAME_MAX_LENGTH, MILLISECONDS_PER_DAY, PROJECT_KEY_PREFIX, RuleIssue } from '@todz/types';
import { env, exports } from 'cloudflare:workers';
import { describe, expect, test } from 'vitest';
import { digestCredential } from '../src/credential-digest';
import { generateCredentialSecret } from '../src/credential-secret';
import { insertMcpSession } from '../src/directory';
import { MCP_COPY } from '../src/mcp-copy';
import { serveMcp } from '../src/mcp-endpoint';
import { MCP_SESSIONS_PER_KEY_MAX } from '../src/mcp-sessions';
import { issueProjectKey } from '../src/project-keys';
import { countingEnv } from './counting-namespace';
import { revokeKey, seedIssuedKey } from './directory-seed';
import { CLOCK_NOW } from './task-fixtures';

const MCP_URL = 'https://api.todz.test/mcp';
const WORKER_ORIGIN = 'https://api.todz.test';
const SESSION_HEADER = 'Mcp-Session-Id';
const SESSION_ID_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const SESSION_REQUIRED_CODE = -32000;
const SESSION_NOT_FOUND_CODE = -32001;
const INITIALIZE_REQUEST_ID = 7;
const TOOLS_LIST_REQUEST_ID = 8;
const CLIENT_NAME = 'Claude Code';
const MCP_SESSION_LIFETIME_MS = 30 * MILLISECONDS_PER_DAY;
const OK_STATUS = 200;
const BAD_REQUEST_STATUS = 400;
const UNAUTHORIZED_STATUS = 401;
const NOT_FOUND_STATUS = 404;
const METHOD_NOT_ALLOWED_STATUS = 405;
const PAYLOAD_TOO_LARGE_STATUS = 413;
const UNSUPPORTED_PROTOCOL_VERSION = '1999-01-01';
const JSON_RPC_ERROR_MARK = '"error"';

type SessionRow = { digest: string; key_digest: string; client_name: string; created_at: number; expires_at: number };

function initializeBody(params: unknown): unknown {
  return { jsonrpc: JSONRPC_VERSION, id: INITIALIZE_REQUEST_ID, method: 'initialize', params };
}

function initializeParams(clientInfo: unknown): unknown {
  return { protocolVersion: LATEST_PROTOCOL_VERSION, capabilities: {}, clientInfo };
}

function initializeOf(name: unknown): unknown {
  return initializeBody(initializeParams({ name, version: '1.0.0' }));
}

function initializeMessage(fields: Record<string, unknown>): unknown {
  return { ...(initializeOf(CLIENT_NAME) as Record<string, unknown>), ...fields };
}

const TOOLS_LIST_BODY = { jsonrpc: JSONRPC_VERSION, id: TOOLS_LIST_REQUEST_ID, method: 'tools/list', params: {} };

function mcpRequest({
  authorization,
  body,
  sessionId = null,
  method = 'POST',
}: {
  authorization: string | null;
  body: unknown;
  sessionId?: string | null;
  method?: string;
}): Request {
  const headers = new Headers({ 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' });
  if (authorization !== null) headers.set('Authorization', authorization);
  if (sessionId !== null) headers.set(SESSION_HEADER, sessionId);
  const isBodyless = method === 'GET' || method === 'DELETE';
  if (isBodyless) return new Request(MCP_URL, { method, headers });
  return new Request(MCP_URL, { method, headers, body: requestText(body) });
}

function requestText(body: unknown): string {
  if (typeof body === 'string') return body;
  return JSON.stringify(body);
}

function bearer(key: string): string {
  return `Bearer ${key}`;
}

async function sessionRowsOf(key: string): Promise<SessionRow[]> {
  const { results } = await env.DIRECTORY.prepare(
    'SELECT digest, key_digest, client_name, created_at, expires_at FROM mcp_sessions WHERE key_digest = ?',
  )
    .bind(await digestCredential(key))
    .all<SessionRow>();
  return results;
}

async function sessionCount(): Promise<number> {
  const row = await env.DIRECTORY.prepare('SELECT count(*) AS total FROM mcp_sessions').first<{ total: number }>();
  if (row === null) throw new Error('count always answers a row');
  return row.total;
}

async function openSession(key: string): Promise<string> {
  const response = await exports.default.fetch(mcpRequest({ authorization: bearer(key), body: initializeOf(CLIENT_NAME) }));
  const sessionId = response.headers.get(SESSION_HEADER);
  await response.body?.cancel();
  if (sessionId === null) throw new Error('initialize should answer a session id');
  return sessionId;
}

function toolsList({ key, sessionId }: { key: string; sessionId: string | null }): Promise<Response> {
  return exports.default.fetch(mcpRequest({ authorization: bearer(key), body: TOOLS_LIST_BODY, sessionId }));
}

function jsonRpcError({ id, code, message }: { id: number | null; code: number; message: string }): unknown {
  return { jsonrpc: JSONRPC_VERSION, id, error: { code, message } };
}

const SESSION_REQUIRED = jsonRpcError({ id: null, code: SESSION_REQUIRED_CODE, message: MCP_COPY.sessionRequired });
const SESSION_NOT_FOUND = jsonRpcError({ id: null, code: SESSION_NOT_FOUND_CODE, message: MCP_COPY.sessionNotFound });

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
    { name: 'the basic scheme', authorization: (key: string) => `Basic ${key}` },
    { name: 'a blank secret', authorization: () => 'Bearer    ' },
    { name: 'two spaces after the scheme', authorization: (key: string) => `Bearer  ${key}` },
    { name: 'a key never issued', authorization: () => bearer(`${PROJECT_KEY_PREFIX}${generateCredentialSecret()}`) },
    { name: 'the key without its prefix', authorization: (key: string) => bearer(key.slice(PROJECT_KEY_PREFIX.length)) },
  ])('$name answers 401, addresses no Durable Object and stores no session', async ({ authorization }) => {
    const { key } = await seedIssuedKey();
    const { countedEnv, addressingCalls } = countingEnv();
    const sessionsBefore = await sessionCount();
    const request = mcpRequest({ authorization: authorization(key), body: initializeOf(CLIENT_NAME) });
    const response = await serveMcp({ request, env: countedEnv, now: CLOCK_NOW });
    expect(response.status).toBe(UNAUTHORIZED_STATUS);
    expect(response.headers.get('WWW-Authenticate')).toBe('Bearer');
    expect(await response.text()).toBe('');
    expect(addressingCalls).toEqual([]);
    expect(await sessionCount()).toBe(sessionsBefore);
  });

  test('a revoked key answers 401, addresses no Durable Object and stores no session', async () => {
    const { key } = await seedIssuedKey();
    await revokeKey(key);
    const { countedEnv, addressingCalls } = countingEnv();
    const request = mcpRequest({ authorization: bearer(key), body: initializeOf(CLIENT_NAME) });
    const response = await serveMcp({ request, env: countedEnv, now: CLOCK_NOW });
    expect(response.status).toBe(UNAUTHORIZED_STATUS);
    expect(response.headers.get('WWW-Authenticate')).toBe('Bearer');
    expect(await response.text()).toBe('');
    expect(addressingCalls).toEqual([]);
    expect(await sessionRowsOf(key)).toEqual([]);
  });

  test('a legacy session whose key is revoked answers 401', async () => {
    const { key } = await seedIssuedKey();
    const sessionId = await openSession(key);
    await revokeKey(key);
    const response = await toolsList({ key, sessionId });
    expect(response.status).toBe(UNAUTHORIZED_STATUS);
  });
});

describe('an accepted credential', () => {
  test('the scheme in lower case opens a legacy session', async () => {
    const { key } = await seedIssuedKey();
    const response = await exports.default.fetch(mcpRequest({ authorization: `bearer ${key}`, body: initializeOf(CLIENT_NAME) }));
    await response.body?.cancel();
    expect(response.status).toBe(OK_STATUS);
  });

  test('GET answers 405 allowing POST', async () => {
    const { key } = await seedIssuedKey();
    const response = await exports.default.fetch(mcpRequest({ authorization: bearer(key), body: null, method: 'GET' }));
    expect(response.status).toBe(METHOD_NOT_ALLOWED_STATUS);
    expect(response.headers.get('Allow')).toBe('POST');
    expect(await response.text()).toBe('');
  });

  test('DELETE with a live session answers 405 allowing POST and the session stays', async () => {
    const { key } = await seedIssuedKey();
    const sessionId = await openSession(key);
    const response = await exports.default.fetch(mcpRequest({ authorization: bearer(key), body: null, sessionId, method: 'DELETE' }));
    expect(response.status).toBe(METHOD_NOT_ALLOWED_STATUS);
    expect(response.headers.get('Allow')).toBe('POST');
    expect(await response.text()).toBe('');
    expect(await sessionRowsOf(key)).toHaveLength(1);
  });
});

describe('a legacy initialize', () => {
  test('stores a session for the trimmed client name and answers its id', async () => {
    const { key } = await seedIssuedKey();
    const response = await exports.default.fetch(mcpRequest({ authorization: bearer(key), body: initializeOf(`  ${CLIENT_NAME}  `) }));
    await response.body?.cancel();
    expect(response.status).toBe(OK_STATUS);
    const sessionId = response.headers.get(SESSION_HEADER);
    expect(sessionId).toMatch(SESSION_ID_PATTERN);
    const rows = await sessionRowsOf(key);
    expect(rows.map(({ digest, key_digest, client_name }) => ({ digest, key_digest, client_name }))).toEqual([
      { digest: await digestCredential(String(sessionId)), key_digest: await digestCredential(key), client_name: CLIENT_NAME },
    ]);
    expect(rows.map((row) => row.expires_at - row.created_at)).toEqual([MCP_SESSION_LIFETIME_MS]);
  });

  test.each([
    { name: 'a blank name', body: initializeOf('   ') },
    { name: 'a name one character too long', body: initializeOf('a'.repeat(CLIENT_NAME_MAX_LENGTH + 1)) },
    { name: 'a name on two lines', body: initializeOf('Claude\nCode') },
    { name: 'a name that is a number', body: initializeOf(42) },
    { name: 'no client info', body: initializeBody({ protocolVersion: LATEST_PROTOCOL_VERSION, capabilities: {} }) },
    { name: 'no params', body: { jsonrpc: JSONRPC_VERSION, id: INITIALIZE_REQUEST_ID, method: 'initialize' } },
  ])('with $name answers 400 invalid params and stores no session', async ({ body }) => {
    const { key } = await seedIssuedKey();
    const response = await exports.default.fetch(mcpRequest({ authorization: bearer(key), body }));
    expect(response.status).toBe(BAD_REQUEST_STATUS);
    expect(await response.json()).toEqual(
      jsonRpcError({ id: INITIALIZE_REQUEST_ID, code: INVALID_PARAMS, message: MCP_COPY.ruleIssue[RuleIssue.ClientNameInvalid] }),
    );
    expect(await sessionRowsOf(key)).toEqual([]);
  });
});

describe('a later legacy request', () => {
  test.each([
    { name: 'no session header', sessionId: null },
    { name: 'a blank session header', sessionId: '' },
  ])('with $name answers 400 session required', async ({ sessionId }) => {
    const { key } = await seedIssuedKey();
    const response = await toolsList({ key, sessionId });
    expect(response.status).toBe(BAD_REQUEST_STATUS);
    expect(await response.json()).toEqual(SESSION_REQUIRED);
  });

  test.each([
    { name: 'a body that is not JSON', body: 'not json' },
    { name: 'a batch holding an initialize', body: [initializeOf(CLIENT_NAME)] },
  ])('with $name and no session answers 400 session required', async ({ body }) => {
    const { key } = await seedIssuedKey();
    const response = await exports.default.fetch(mcpRequest({ authorization: bearer(key), body }));
    expect(response.status).toBe(BAD_REQUEST_STATUS);
    expect(await response.json()).toEqual(SESSION_REQUIRED);
  });

  test('with a session id never issued answers 404 session not found', async () => {
    const { key } = await seedIssuedKey();
    const response = await toolsList({ key, sessionId: generateCredentialSecret() });
    expect(response.status).toBe(NOT_FOUND_STATUS);
    expect(await response.json()).toEqual(SESSION_NOT_FOUND);
  });

  test('with an expired session answers 404 session not found', async () => {
    const { key } = await seedIssuedKey();
    const sessionId = generateCredentialSecret();
    const now = Date.now();
    await insertMcpSession({
      directory: env.DIRECTORY,
      digest: await digestCredential(sessionId),
      keyDigest: await digestCredential(key),
      clientName: CLIENT_NAME,
      now: now - MCP_SESSION_LIFETIME_MS,
      expiresAt: now - 1,
    });
    const response = await toolsList({ key, sessionId });
    expect(response.status).toBe(NOT_FOUND_STATUS);
    expect(await response.json()).toEqual(SESSION_NOT_FOUND);
  });

  test('with a session of another key of the same project answers 404 session not found', async () => {
    const { projectId, key } = await seedIssuedKey();
    const otherKey = await issueProjectKey({ directory: env.DIRECTORY, projectId, now: CLOCK_NOW });
    const sessionId = await openSession(otherKey);
    const response = await toolsList({ key, sessionId });
    expect(response.status).toBe(NOT_FOUND_STATUS);
    expect(await response.json()).toEqual(SESSION_NOT_FOUND);
  });

  test('with a session of a key of another project answers 404 and names nothing of that project', async () => {
    const projectA = await seedIssuedKey();
    const projectB = await seedIssuedKey();
    const sessionId = await openSession(projectA.key);
    const response = await toolsList({ key: projectB.key, sessionId });
    expect(response.status).toBe(NOT_FOUND_STATUS);
    const text = await response.text();
    expect(JSON.parse(text)).toEqual(SESSION_NOT_FOUND);
    expect(text).not.toContain(projectA.projectId);
  });

  test('with a live session of its key is answered by the server', async () => {
    const { key } = await seedIssuedKey();
    const sessionId = await openSession(key);
    const response = await toolsList({ key, sessionId });
    await response.body?.cancel();
    expect(response.status).toBe(OK_STATUS);
  });
});

describe('edge cases found during execution', () => {
  test.each(['/constructor', '/__proto__', '/toString', '/mcp/', '/MCP'])(
    'POST %s with a valid key and an initialize answers 404 and stores no session',
    async (path) => {
      const { key } = await seedIssuedKey();
      const headers = { Authorization: bearer(key), 'Content-Type': 'application/json' };
      const response = await exports.default.fetch(`${WORKER_ORIGIN}${path}`, {
        method: 'POST',
        headers,
        body: requestText(initializeOf(CLIENT_NAME)),
      });
      expect(response.status).toBe(NOT_FOUND_STATUS);
      expect(await response.text()).toBe('');
      expect(await sessionRowsOf(key)).toEqual([]);
    },
  );

  test('a tab after the scheme answers 401 and addresses no Durable Object', async () => {
    const { key } = await seedIssuedKey();
    const { countedEnv, addressingCalls } = countingEnv();
    const request = mcpRequest({ authorization: `Bearer\t${key}`, body: initializeOf(CLIENT_NAME) });
    const response = await serveMcp({ request, env: countedEnv, now: CLOCK_NOW });
    expect(response.status).toBe(UNAUTHORIZED_STATUS);
    expect(addressingCalls).toEqual([]);
    expect(await sessionRowsOf(key)).toEqual([]);
  });

  test('a trailing space after the key is dropped by the platform and the key opens a session', async () => {
    const { key } = await seedIssuedKey();
    const response = await exports.default.fetch(mcpRequest({ authorization: `${bearer(key)} `, body: initializeOf(CLIENT_NAME) }));
    await response.body?.cancel();
    expect(response.status).toBe(OK_STATUS);
    expect(await sessionRowsOf(key)).toHaveLength(1);
  });

  test.each(['PUT', 'PATCH', 'OPTIONS', 'HEAD'])('%s with a valid key answers 405 allowing POST', async (method) => {
    const { key } = await seedIssuedKey();
    const response = await exports.default.fetch(new Request(MCP_URL, { method, headers: { Authorization: bearer(key) } }));
    expect(response.status).toBe(METHOD_NOT_ALLOWED_STATUS);
    expect(response.headers.get('Allow')).toBe('POST');
  });

  test('an initialize with a protocol version the server does not know opens a session on the version it answers', async () => {
    const { key } = await seedIssuedKey();
    const params = { protocolVersion: UNSUPPORTED_PROTOCOL_VERSION, capabilities: {}, clientInfo: { name: CLIENT_NAME, version: '1.0.0' } };
    const response = await exports.default.fetch(mcpRequest({ authorization: bearer(key), body: initializeBody(params) }));
    const text = await response.text();
    expect(response.status).toBe(OK_STATUS);
    expect(text).toContain(`"protocolVersion":"${LATEST_PROTOCOL_VERSION}"`);
    expect(response.headers.get(SESSION_HEADER)).toMatch(SESSION_ID_PATTERN);
    expect(await sessionRowsOf(key)).toHaveLength(1);
  });

  test.each([
    { name: 'a protocol version that is not a string', params: { protocolVersion: 5, capabilities: {} } },
    { name: 'no capabilities', params: { protocolVersion: LATEST_PROTOCOL_VERSION } },
  ])('an initialize with $name that the SDK answers with an error opens no session', async ({ params }) => {
    const { key } = await seedIssuedKey();
    const body = initializeBody({ ...params, clientInfo: { name: CLIENT_NAME, version: '1.0.0' } });
    const response = await exports.default.fetch(mcpRequest({ authorization: bearer(key), body }));
    expect(await response.text()).toContain(JSON_RPC_ERROR_MARK);
    expect(response.headers.get(SESSION_HEADER)).toBeNull();
    expect(await sessionRowsOf(key)).toEqual([]);
  });

  test.each([
    { name: 'an initialize without an id', body: initializeMessage({ id: undefined }) },
    { name: 'an initialize whose id is null', body: initializeMessage({ id: null }) },
    { name: 'an initialize whose id is an object', body: initializeMessage({ id: {} }) },
    { name: 'a batch of two initializes', body: [initializeOf(CLIENT_NAME), initializeOf(CLIENT_NAME)] },
    { name: 'a body of null', body: 'null' },
    { name: 'an empty body', body: '' },
  ])('$name answers 400 and opens no session', async ({ body }) => {
    const { key } = await seedIssuedKey();
    const response = await exports.default.fetch(mcpRequest({ authorization: bearer(key), body }));
    await response.body?.cancel();
    expect(response.status).toBe(BAD_REQUEST_STATUS);
    expect(response.headers.get(SESSION_HEADER)).toBeNull();
    expect(await sessionRowsOf(key)).toEqual([]);
  });

  test('a batch with a live session of its key is served, and with a session of another project is not found', async () => {
    const projectA = await seedIssuedKey();
    const projectB = await seedIssuedKey();
    const sessionId = await openSession(projectA.key);
    const body = [TOOLS_LIST_BODY, { ...TOOLS_LIST_BODY, id: TOOLS_LIST_REQUEST_ID + 1 }];
    const served = await exports.default.fetch(mcpRequest({ authorization: bearer(projectA.key), body, sessionId }));
    await served.body?.cancel();
    expect(served.status).toBe(OK_STATUS);
    const foreign = await exports.default.fetch(mcpRequest({ authorization: bearer(projectB.key), body, sessionId }));
    expect(foreign.status).toBe(NOT_FOUND_STATUS);
    expect(await foreign.json()).toEqual(SESSION_NOT_FOUND);
  });

  test('a session id with surrounding spaces is trimmed by the platform, and two session ids are not found', async () => {
    const { key } = await seedIssuedKey();
    const sessionId = await openSession(key);
    const padded = await toolsList({ key, sessionId: `  ${sessionId}  ` });
    await padded.body?.cancel();
    expect(padded.status).toBe(OK_STATUS);
    const doubled = mcpRequest({ authorization: bearer(key), body: TOOLS_LIST_BODY, sessionId });
    doubled.headers.append(SESSION_HEADER, sessionId);
    const response = await exports.default.fetch(doubled);
    expect(response.status).toBe(NOT_FOUND_STATUS);
    expect(await response.json()).toEqual(SESSION_NOT_FOUND);
  });

  test('a session is served one millisecond before its expiry and not found at it', async () => {
    const { key } = await seedIssuedKey();
    const sessionId = generateCredentialSecret();
    const expiresAt = CLOCK_NOW + MCP_SESSION_LIFETIME_MS;
    await insertMcpSession({
      directory: env.DIRECTORY,
      digest: await digestCredential(sessionId),
      keyDigest: await digestCredential(key),
      clientName: CLIENT_NAME,
      now: CLOCK_NOW,
      expiresAt,
    });
    const request = () => mcpRequest({ authorization: bearer(key), body: TOOLS_LIST_BODY, sessionId });
    const beforeExpiry = await serveMcp({ request: request(), env, now: expiresAt - 1 });
    await beforeExpiry.body?.cancel();
    expect(beforeExpiry.status).toBe(OK_STATUS);
    const atExpiry = await serveMcp({ request: request(), env, now: expiresAt });
    expect(atExpiry.status).toBe(NOT_FOUND_STATUS);
    expect(await atExpiry.json()).toEqual(SESSION_NOT_FOUND);
  });

  test('a body over the size limit answers 413 with a key, opens no session, and 401 without a key', async () => {
    const { key } = await seedIssuedKey();
    const sessionId = await openSession(key);
    const padding = 'x'.repeat(DEFAULT_MAX_REQUEST_BODY_SIZE);
    const hugeList = await exports.default.fetch(
      mcpRequest({ authorization: bearer(key), body: { ...TOOLS_LIST_BODY, padding }, sessionId }),
    );
    await hugeList.body?.cancel();
    expect(hugeList.status).toBe(PAYLOAD_TOO_LARGE_STATUS);
    const hugeInitialize = await exports.default.fetch(mcpRequest({ authorization: bearer(key), body: initializeMessage({ padding }) }));
    await hugeInitialize.body?.cancel();
    expect(hugeInitialize.status).toBe(PAYLOAD_TOO_LARGE_STATUS);
    expect(await sessionRowsOf(key)).toHaveLength(1);
    const withoutKey = await exports.default.fetch(mcpRequest({ authorization: null, body: padding }));
    expect(withoutKey.status).toBe(UNAUTHORIZED_STATUS);
  });
});

describe('the sessions of one key', () => {
  async function seedExpiredSession(key: string): Promise<string> {
    const sessionId = generateCredentialSecret();
    const now = Date.now();
    await insertMcpSession({
      directory: env.DIRECTORY,
      digest: await digestCredential(sessionId),
      keyDigest: await digestCredential(key),
      clientName: CLIENT_NAME,
      now: now - MCP_SESSION_LIFETIME_MS,
      expiresAt: now - 1,
    });
    return digestCredential(sessionId);
  }

  test('keep only the newest sessions up to the cap: the first of one more is not found and the last is served', async () => {
    const { key } = await seedIssuedKey();
    const sessionIds = await Array.from({ length: MCP_SESSIONS_PER_KEY_MAX + 1 }).reduce<Promise<string[]>>(
      async (opened) => [...(await opened), await openSession(key)],
      Promise.resolve([]),
    );
    expect(await sessionRowsOf(key)).toHaveLength(MCP_SESSIONS_PER_KEY_MAX);
    const first = await toolsList({ key, sessionId: String(sessionIds.at(0)) });
    expect(first.status).toBe(NOT_FOUND_STATUS);
    expect(await first.json()).toEqual(SESSION_NOT_FOUND);
    const last = await toolsList({ key, sessionId: String(sessionIds.at(-1)) });
    await last.body?.cancel();
    expect(last.status).toBe(OK_STATUS);
  });

  test('a new session deletes the expired rows of its key and leaves the expired rows of another key', async () => {
    const { key } = await seedIssuedKey();
    const other = await seedIssuedKey();
    const expiredDigest = await seedExpiredSession(key);
    const otherExpiredDigest = await seedExpiredSession(other.key);
    await openSession(key);
    const digests = (await sessionRowsOf(key)).map((row) => row.digest);
    expect(digests).toHaveLength(1);
    expect(digests).not.toContain(expiredDigest);
    expect((await sessionRowsOf(other.key)).map((row) => row.digest)).toEqual([otherExpiredDigest]);
  });
});
