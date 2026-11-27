import { describe, expect, test } from 'vitest';
import { PRODUCTION_REQUEST_MAX } from './budgets';
import { fakeMcpServer } from './fake-mcp-server';
import { McpEra, completeTasks, connectMeasuredMcp, listTasks } from './mcp-scenario';
import { ScenarioKind } from './scenario-kind';
import { type Scheduler, guardedFetch } from './wire-guard';

const PRODUCTION_MCP_URL = 'https://api.todz.app/mcp';
const REFUSAL = 'production sends only POST https://api.todz.app/mcp';
const DEADLINE_MS = 120_000;

function neverFiring(): Scheduler {
  return () => undefined;
}

function guardOver({
  fetch,
  schedule = neverFiring(),
  requestMax = PRODUCTION_REQUEST_MAX,
  interruption = new AbortController().signal,
}: {
  fetch: typeof globalThis.fetch;
  schedule?: Scheduler;
  requestMax?: number;
  interruption?: AbortSignal;
}) {
  return guardedFetch({ fetch, deadlineMs: DEADLINE_MS, schedule, requestMax, interruption });
}

function countingFetch(): { fetch: typeof globalThis.fetch; received: Request[] } {
  const received: Request[] = [];
  const fetch: typeof globalThis.fetch = async (input, init) => {
    received.push(new Request(input, init));
    return new Response('{}');
  };
  return { fetch, received };
}

describe('guardedFetch refuses before anything leaves', () => {
  const refused: [string, string, string][] = [
    ['a GET of the MCP stream', 'GET', PRODUCTION_MCP_URL],
    ['a DELETE of the session', 'DELETE', PRODUCTION_MCP_URL],
    ['an OAuth discovery path', 'POST', 'https://api.todz.app/.well-known/oauth-protected-resource'],
    ['a GET of an OAuth discovery path', 'GET', 'https://api.todz.app/.well-known/oauth-authorization-server'],
    ['another path of the same origin', 'POST', 'https://api.todz.app/owner/workspaces'],
    ['the MCP path with a query', 'POST', `${PRODUCTION_MCP_URL}?x=1`],
    ['another origin', 'POST', 'https://example.com/mcp'],
    ['the local origin', 'POST', 'http://localhost:8787/mcp'],
    ['the production origin over plain HTTP', 'POST', 'http://api.todz.app/mcp'],
  ];

  test.each(refused)('%s', async (_name, method, url) => {
    const { fetch, received } = countingFetch();
    await expect(guardOver({ fetch })(url, { method })).rejects.toThrow(REFUSAL);
    expect(received).toEqual([]);
  });

  test('a POST to the production MCP path goes through, as it was asked, with no redirect followed', async () => {
    const { fetch, received } = countingFetch();
    await guardOver({ fetch })(PRODUCTION_MCP_URL, { method: 'POST', body: '{}' });
    expect(received).toHaveLength(1);
    expect(received[0]?.redirect).toBe('error');
    expect(received[0]?.url).toBe(PRODUCTION_MCP_URL);
  });

  test('a redirect answer is a failure, never followed', async () => {
    const redirecting: typeof globalThis.fetch = async (input, init) => {
      const request = new Request(input, init);
      if (request.redirect === 'error') throw new TypeError('fetch failed');
      return new Response(null, { status: 302, headers: { Location: 'https://example.com/' } });
    };
    await expect(guardOver({ fetch: redirecting })(PRODUCTION_MCP_URL, { method: 'POST', body: '{}' })).rejects.toThrow('fetch failed');
  });
});

describe('guardedFetch and the 120 seconds', () => {
  test('one timer of 120 seconds starts at the first request only', async () => {
    const scheduled: number[] = [];
    const { fetch } = countingFetch();
    const guarded = guardOver({ fetch, schedule: (_callback, delayMs) => scheduled.push(delayMs) });
    expect(scheduled).toEqual([]);
    await guarded(PRODUCTION_MCP_URL, { method: 'POST', body: '{}' });
    await guarded(PRODUCTION_MCP_URL, { method: 'POST', body: '{}' });
    expect(scheduled).toEqual([DEADLINE_MS]);
  });

  test('a stalled transport that never answers is aborted at 120 seconds and sees nothing after', async () => {
    const callbacks: (() => void)[] = [];
    const received: Request[] = [];
    const stalled: typeof globalThis.fetch = (input, init) => {
      received.push(new Request(input, init));
      return new Promise<Response>(() => undefined);
    };
    const guarded = guardOver({ fetch: stalled, schedule: (callback) => callbacks.push(callback) });
    const inFlight = guarded(PRODUCTION_MCP_URL, { method: 'POST', body: '{}' });
    const settled = expect(inFlight).rejects.toThrow('the 120 seconds of the run are over');
    callbacks.forEach((callback) => callback());
    await settled;
    await expect(guarded(PRODUCTION_MCP_URL, { method: 'POST', body: '{}' })).rejects.toThrow('the 120 seconds of the run are over');
    expect(received).toHaveLength(1);
  });
});

describe('the MCP client behind the guard', () => {
  async function clientOver(server: ReturnType<typeof fakeMcpServer>) {
    return connectMeasuredMcp({
      origin: 'https://api.todz.app',
      token: 'todz-at_test',
      era: McpEra.Modern,
      fetch: guardOver({ fetch: server.fetch }),
      now: () => 0,
      scenario: ScenarioKind.List,
      record: () => undefined,
    });
  }

  test('the modern era connects and calls with only POST /mcp requests', async () => {
    const server = fakeMcpServer();
    const client = await clientOver(server);
    await listTasks({ client });
    expect(server.requests.map((request) => `${request.method} ${request.url}`)).toEqual([
      `POST ${PRODUCTION_MCP_URL}`,
      `POST ${PRODUCTION_MCP_URL}`,
    ]);
  });

  test('a 401 answer to a tools/call produces no second request: no discovery, no retry', async () => {
    const server = fakeMcpServer({ isUnauthorized: true });
    const client = await clientOver(server);
    await expect(completeTasks({ client, numbers: [1] })).rejects.toThrow();
    expect(server.rpcMethods()).toEqual(['server/discover', 'tools/call']);
  });
});

describe('guardedFetch and the request ceiling', () => {
  const CEILING = 3;
  const POST_INIT = { method: 'POST', body: '{}' };

  test('the request after the ceiling is refused before it leaves', async () => {
    const { fetch, received } = countingFetch();
    const guarded = guardOver({ fetch, requestMax: CEILING });
    await Promise.all(Array.from({ length: CEILING }, () => guarded(PRODUCTION_MCP_URL, POST_INIT)));
    await expect(guarded(PRODUCTION_MCP_URL, POST_INIT)).rejects.toThrow(`production sends at most ${CEILING} requests`);
    expect(received).toHaveLength(CEILING);
  });

  test('a request the guard refuses for its method does not use the ceiling', async () => {
    const { fetch, received } = countingFetch();
    const guarded = guardOver({ fetch, requestMax: CEILING });
    await expect(guarded(PRODUCTION_MCP_URL, { method: 'GET' })).rejects.toThrow(REFUSAL);
    await Promise.all(Array.from({ length: CEILING }, () => guarded(PRODUCTION_MCP_URL, POST_INIT)));
    expect(received).toHaveLength(CEILING);
  });

  test('the handshake requests a 2025-era client sends count, so a client that talks more than planned is stopped', async () => {
    const server = fakeMcpServer();
    const handshakeRequests = 2;
    const client = await connectMeasuredMcp({
      origin: 'https://api.todz.app',
      token: 'todz-at_test',
      era: McpEra.Legacy,
      fetch: guardOver({ fetch: server.fetch, requestMax: handshakeRequests }),
      now: () => 0,
      scenario: ScenarioKind.List,
      record: () => undefined,
    });
    await expect(listTasks({ client })).rejects.toThrow(`production sends at most ${handshakeRequests} requests`);
    expect(server.rpcMethods()).toEqual(['initialize', 'notifications/initialized']);
  });
});

describe('guardedFetch and an interruption', () => {
  test('what is in flight is aborted and nothing leaves afterwards', async () => {
    const received: Request[] = [];
    const stalled: typeof globalThis.fetch = (input, init) => {
      received.push(new Request(input, init));
      return new Promise<Response>(() => undefined);
    };
    const interruption = new AbortController();
    const guarded = guardOver({ fetch: stalled, interruption: interruption.signal });
    const inFlight = guarded(PRODUCTION_MCP_URL, { method: 'POST', body: '{}' });
    const settled = expect(inFlight).rejects.toThrow('the run was interrupted');
    interruption.abort();
    await settled;
    await expect(guarded(PRODUCTION_MCP_URL, { method: 'POST', body: '{}' })).rejects.toThrow('the run was interrupted');
    expect(received).toHaveLength(1);
  });
});
