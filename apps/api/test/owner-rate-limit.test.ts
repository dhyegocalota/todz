import { JSONRPC_VERSION, LATEST_PROTOCOL_VERSION } from '@modelcontextprotocol/server';
import { env } from 'cloudflare:workers';
import { describe, expect, test } from 'vitest';
import { digestCredential } from '../src/credential-digest';
import type { Env } from '../src/env';
import { serveMcp } from '../src/mcp-endpoint';
import { seedIssuedKey, seedOwner, seedOwnerKey } from './directory-seed';
import { recordingLimiter } from './email-sign-in-client';
import { type OwnerCall, serveOwnerCall, signInOwner, workerEnvWith } from './owner-client';
import { CLOCK_NOW } from './task-fixtures';

const PUBLIC_API_ORIGIN = 'https://api.todz.app';
const LOCAL_API_ORIGIN = 'http://localhost:8787';
const OK_STATUS = 200;
const TOO_MANY_STATUS = 429;
const RATE_LIMITED = { error: 'rate_limited' };
const RETRY_AFTER_HEADER = 'Retry-After';
const RETRY_AFTER_SECONDS = '60';
const INITIALIZE_REQUEST_ID = 1;
const CLIENT_NAME = 'Claude Code';

function throwingLimiter(): RateLimit {
  return {
    async limit() {
      throw new Error('the limiter is down');
    },
  };
}

function listWorkspacesCall({ token, origin }: { token: string; origin: string }): OwnerCall {
  return { method: 'GET', path: '/owner/workspaces', token, origin };
}

function ownerEnv(settings: Partial<Env>): Env {
  return workerEnvWith({ PUBLIC_ORIGIN: PUBLIC_API_ORIGIN, SIGN_IN_PROVIDER: 'fake', ...settings });
}

function initializeRequest(key: string): Request {
  const body = {
    jsonrpc: JSONRPC_VERSION,
    id: INITIALIZE_REQUEST_ID,
    method: 'initialize',
    params: { protocolVersion: LATEST_PROTOCOL_VERSION, capabilities: {}, clientInfo: { name: CLIENT_NAME, version: '1.0.0' } },
  };
  return new Request(`${PUBLIC_API_ORIGIN}/mcp`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
    body: JSON.stringify(body),
  });
}

describe('the owner limiter', () => {
  test('a signed-in owner route takes the owner limiter, keyed by the owner id', async () => {
    const { token, ownerId } = await signInOwner();
    const { limiter, keys } = recordingLimiter({ isAllowed: true });
    const response = await serveOwnerCall({
      call: listWorkspacesCall({ token, origin: PUBLIC_API_ORIGIN }),
      now: CLOCK_NOW,
      workerEnv: ownerEnv({ OWNER_LIMITER: limiter }),
    });
    expect(response.status).toBe(OK_STATUS);
    expect(keys).toEqual([ownerId]);
  });

  test('a refused owner route answers rate limited with Retry-After', async () => {
    const { token } = await signInOwner();
    const response = await serveOwnerCall({
      call: listWorkspacesCall({ token, origin: PUBLIC_API_ORIGIN }),
      now: CLOCK_NOW,
      workerEnv: ownerEnv({ OWNER_LIMITER: recordingLimiter({ isAllowed: false }).limiter }),
    });
    expect(response.status).toBe(TOO_MANY_STATUS);
    expect(response.headers.get(RETRY_AFTER_HEADER)).toBe(RETRY_AFTER_SECONDS);
    expect(await response.json()).toEqual(RATE_LIMITED);
  });

  test.each([
    { name: 'missing', limiter: undefined },
    { name: 'down', limiter: throwingLimiter() },
  ])('an owner limiter that is $name serves the route', async ({ limiter }) => {
    const { token } = await signInOwner();
    const response = await serveOwnerCall({
      call: listWorkspacesCall({ token, origin: PUBLIC_API_ORIGIN }),
      now: CLOCK_NOW,
      workerEnv: ownerEnv({ OWNER_LIMITER: limiter }),
    });
    expect(response.status).toBe(OK_STATUS);
  });

  test('a local host skips the owner limiter', async () => {
    const { token } = await signInOwner();
    const { limiter, keys } = recordingLimiter({ isAllowed: false });
    const response = await serveOwnerCall({
      call: listWorkspacesCall({ token, origin: LOCAL_API_ORIGIN }),
      now: CLOCK_NOW,
      workerEnv: workerEnvWith({ PUBLIC_ORIGIN: LOCAL_API_ORIGIN, SIGN_IN_PROVIDER: 'fake', OWNER_LIMITER: limiter }),
    });
    expect(response.status).toBe(OK_STATUS);
    expect(keys).toEqual([]);
  });

  test('an unknown session never reaches the owner limiter', async () => {
    const { limiter, keys } = recordingLimiter({ isAllowed: true });
    await serveOwnerCall({
      call: listWorkspacesCall({ token: 'not-a-session', origin: PUBLIC_API_ORIGIN }),
      now: CLOCK_NOW,
      workerEnv: ownerEnv({ OWNER_LIMITER: limiter }),
    });
    expect(keys).toEqual([]);
  });
});

describe('the key limiter', () => {
  test('/mcp takes the key limiter, keyed by the key digest and never the key', async () => {
    const { key } = await seedIssuedKey();
    const { limiter, keys } = recordingLimiter({ isAllowed: true });
    const response = await serveMcp({ request: initializeRequest(key), env: ownerEnv({ MCP_LIMITER: limiter }), now: CLOCK_NOW });
    await response.body?.cancel();
    expect(response.status).toBe(OK_STATUS);
    expect(keys).toEqual([await digestCredential(key)]);
  });

  test('every owner key of one owner takes the same limiter key, the owner id', async () => {
    const ownerId = await seedOwner();
    const { limiter, keys } = recordingLimiter({ isAllowed: true });
    const workerEnv = ownerEnv({ MCP_LIMITER: limiter });
    const secrets = await Promise.all([seedOwnerKey({ ownerId }), seedOwnerKey({ ownerId })]);
    const responses = await Promise.all(
      secrets.map((secret) => serveMcp({ request: initializeRequest(secret), env: workerEnv, now: CLOCK_NOW })),
    );
    await Promise.all(responses.map((response) => response.body?.cancel()));
    expect(keys).toEqual([ownerId, ownerId]);
  });

  test('a refused /mcp answers 429 with Retry-After', async () => {
    const { key } = await seedIssuedKey();
    const limiter = recordingLimiter({ isAllowed: false }).limiter;
    const response = await serveMcp({ request: initializeRequest(key), env: ownerEnv({ MCP_LIMITER: limiter }), now: CLOCK_NOW });
    expect(response.status).toBe(TOO_MANY_STATUS);
    expect(response.headers.get(RETRY_AFTER_HEADER)).toBe(RETRY_AFTER_SECONDS);
  });

  test('a suspended key is rate limited like any other', async () => {
    const { projectId, key } = await seedIssuedKey();
    await env.DIRECTORY.prepare(
      'UPDATE owners SET suspended_at = ? WHERE id = (SELECT workspaces.owner_id FROM projects JOIN workspaces ON workspaces.id = projects.workspace_id WHERE projects.id = ?)',
    )
      .bind(CLOCK_NOW, projectId)
      .run();
    const limiter = recordingLimiter({ isAllowed: false }).limiter;
    const response = await serveMcp({ request: initializeRequest(key), env: ownerEnv({ MCP_LIMITER: limiter }), now: CLOCK_NOW });
    expect(response.status).toBe(TOO_MANY_STATUS);
  });

  test('a key limiter that is down serves /mcp', async () => {
    const { key } = await seedIssuedKey();
    const response = await serveMcp({ request: initializeRequest(key), env: ownerEnv({ MCP_LIMITER: throwingLimiter() }), now: CLOCK_NOW });
    await response.body?.cancel();
    expect(response.status).toBe(OK_STATUS);
  });
});
