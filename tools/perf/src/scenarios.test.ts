import { describe, expect, test } from 'vitest';
import { openChangeFeed } from './change-feed';
import { FAKE_PROJECT_KEY, FAKE_SESSION_TOKEN, fakeOwnerServer } from './fake-owner-server';
import { FAKE_SESSION_IDENTIFIER, fakeMcpServer } from './fake-mcp-server';
import { McpEra, addTask, completeTasks, connectMeasuredMcp, listTasks, measureInitialize } from './mcp-scenario';
import { type OwnerConnection, addOwnerTasks, completeOwnerTasks, listWorkspaces, readChanges, signInOwner } from './owner-scenario';
import { ScenarioKind } from './scenario-kind';
import { seedFixture } from './seed';
import type { Sample } from './timed-fetch';

const ORIGIN = 'http://localhost:8787';
const MCP_KEY = 'todz_test_key';
const FIXED_CLOCK = () => 0;

type CallerOptions = { era: McpEra; samples: Sample[]; scenario?: ScenarioKind };

function connectionOf({ fetch }: { fetch: typeof globalThis.fetch }): OwnerConnection {
  return { origin: ORIGIN, token: FAKE_SESSION_TOKEN, fetch };
}

async function connectedClient({ era, samples, scenario = ScenarioKind.List }: CallerOptions, server = fakeMcpServer()) {
  const client = await connectMeasuredMcp({
    origin: ORIGIN,
    key: MCP_KEY,
    era,
    fetch: server.fetch,
    now: FIXED_CLOCK,
    scenario,
    record: (sample) => samples.push(sample),
  });
  return { client, server };
}

describe('the modern era on the wire', () => {
  test('a connect is one server/discover and each tools/call is exactly one POST, with no GET, DELETE or initialize', async () => {
    const samples: Sample[] = [];
    const { client, server } = await connectedClient({ era: McpEra.Modern, samples });
    await listTasks({ client });
    await addTask({ client, title: 'one', idempotencyKey: 'key-one' });
    await completeTasks({ client, numbers: [100] });
    expect(server.rpcMethods()).toEqual(['server/discover', 'tools/call', 'tools/call', 'tools/call']);
    expect(server.requests.map((request) => request.method)).toEqual(['POST', 'POST', 'POST', 'POST']);
    expect(server.requests.every((request) => request.pathname === '/mcp')).toBe(true);
    expect(server.requests.every((request) => request.headers.get('Authorization') === `Bearer ${MCP_KEY}`)).toBe(true);
    expect(server.requests.some((request) => request.headers.has('Mcp-Session-Id'))).toBe(false);
  });

  test('only the tools/call requests are counted in the scenario row, never the connect', async () => {
    const samples: Sample[] = [];
    const { client } = await connectedClient({ era: McpEra.Modern, samples });
    expect(samples).toEqual([]);
    await listTasks({ client });
    await listTasks({ client });
    expect(samples.map((sample) => [sample.scenario, sample.status])).toEqual([
      [ScenarioKind.List, 200],
      [ScenarioKind.List, 200],
    ]);
  });
});

describe('the 2025 era on the wire', () => {
  test('the handshake is initialize, the initialized notification and the SDK stream GET, then every call carries the session', async () => {
    const samples: Sample[] = [];
    const { client, server } = await connectedClient({ era: McpEra.Legacy, samples });
    const handshake = server.requests.map((request) => `${request.method} ${request.pathname}`);
    expect(server.rpcMethods()).toEqual(['initialize', 'notifications/initialized', 'GET']);
    expect(handshake).toEqual(['POST /mcp', 'POST /mcp', 'GET /mcp']);
    await listTasks({ client });
    await addTask({ client, title: 'one', idempotencyKey: 'key-one' });
    const calls = server.requests.slice(handshake.length);
    expect(calls.map((request) => request.method)).toEqual(['POST', 'POST']);
    expect(calls.every((request) => request.headers.get('Mcp-Session-Id') === FAKE_SESSION_IDENTIFIER)).toBe(true);
    expect(server.rpcMethods().filter((method) => method === 'tools/call')).toHaveLength(2);
  });

  test('no handshake request is counted in a tools/call row', async () => {
    const samples: Sample[] = [];
    const { client } = await connectedClient({ era: McpEra.Legacy, samples });
    expect(samples).toEqual([]);
    await listTasks({ client });
    await new Promise((resolve) => setImmediate(resolve));
    expect(samples.map((sample) => [sample.scenario, sample.status])).toEqual([[ScenarioKind.List, 200]]);
  });

  test('the initialize scenario records only each client initialize request', async () => {
    const samples: Sample[] = [];
    const server = fakeMcpServer();
    await measureInitialize({
      origin: ORIGIN,
      key: MCP_KEY,
      fetch: server.fetch,
      now: FIXED_CLOCK,
      record: (sample) => samples.push(sample),
      count: 3,
    });
    expect(samples.map((sample) => sample.scenario)).toEqual([ScenarioKind.Initialize, ScenarioKind.Initialize, ScenarioKind.Initialize]);
    expect(server.rpcMethods().filter((method) => method === 'initialize')).toHaveLength(3);
  });
});

describe('the MCP answers', () => {
  test('a list answer gives the matched count and each task number and title', async () => {
    const { client } = await connectedClient({ era: McpEra.Modern, samples: [] });
    expect(await listTasks({ client })).toEqual({
      totalMatched: 7,
      tasks: [
        { number: 1, title: 'first' },
        { number: 2, title: 'second' },
      ],
    });
  });

  test('a list with a text and a limit sends both', async () => {
    const { client, server } = await connectedClient({ era: McpEra.Modern, samples: [] });
    await listTasks({ client, text: 'todz-perf abc #', limit: 100 });
    expect(server.toolCalls().at(-1)).toEqual({ name: 'list', arguments: { text: 'todz-perf abc #', limit: 100 } });
  });

  test('an add gives the number of the task the server made and sends the idempotency key', async () => {
    const { client, server } = await connectedClient({ era: McpEra.Modern, samples: [] });
    expect(await addTask({ client, title: 'one', idempotencyKey: 'key-one' })).toBe(100);
    expect(server.toolCalls().at(-1)).toEqual({ name: 'add', arguments: { tasks: [{ title: 'one', idempotency_key: 'key-one' }] } });
  });

  test('a done sends the short ids', async () => {
    const { client, server } = await connectedClient({ era: McpEra.Modern, samples: [] });
    await completeTasks({ client, numbers: [5, 6] });
    expect(server.toolCalls().at(-1)).toEqual({ name: 'done', arguments: { ids: ['T-5', 'T-6'] } });
  });

  test('a tool error throws its text', async () => {
    const server = fakeMcpServer({ toolAnswers: { done: () => 'T-5 not found.' }, failingTools: ['done'] });
    const { client } = await connectedClient({ era: McpEra.Modern, samples: [] }, server);
    await expect(completeTasks({ client, numbers: [5] })).rejects.toThrow('T-5 not found.');
  });
});

describe('the owner scenario on the wire', () => {
  test('sign-in posts the identity and keeps the session', async () => {
    const server = fakeOwnerServer();
    const connection = await signInOwner({ origin: ORIGIN, fetch: server.fetch, identity: 'perf-owner' });
    expect(connection.token).toBe(FAKE_SESSION_TOKEN);
    expect(server.requests[0]).toMatchObject({
      method: 'POST',
      pathname: '/owner/sessions',
      body: { identity_token: 'perf-owner', time_zone: 'UTC' },
    });
  });

  test('each owner call is the route it names, with the session as a bearer', async () => {
    const server = fakeOwnerServer();
    const connection = connectionOf({ fetch: server.fetch });
    await listWorkspaces(connection);
    await readChanges({ connection, projectId: 'project-1', cursor: 7 });
    await addOwnerTasks({ connection, projectId: 'project-1', titles: ['one'] });
    await completeOwnerTasks({ connection, projectId: 'project-1', numbers: [1] });
    expect(server.requests.map((request) => `${request.method} ${request.pathname}${request.search}`)).toEqual([
      'GET /owner/workspaces',
      'GET /owner/projects/project-1/changes?cursor=7',
      'POST /owner/projects/project-1/tasks',
      'POST /owner/projects/project-1/tasks/complete',
    ]);
    expect(server.requests.every((request) => request.headers.get('Authorization') === `Bearer ${FAKE_SESSION_TOKEN}`)).toBe(true);
  });

  test('an owner answer that is not a success throws its status', async () => {
    const connection = connectionOf({ fetch: async () => new Response(null, { status: 503 }) });
    await expect(listWorkspaces(connection)).rejects.toThrow('GET /owner/workspaces answered 503');
  });
});

describe('the change feed', () => {
  function controlledFeed({
    readings,
    pulls,
  }: {
    readings: number[];
    pulls: { taskNumbers: number[]; cursor: number; hasMore: boolean }[];
  }) {
    const samples: Sample[] = [];
    const listeners: (() => void)[] = [];
    const remainingReadings = [...readings];
    const remainingPulls = [...pulls];
    const requestedCursors: number[] = [];
    const feed = openChangeFeed({
      signals: { onChanged: (listener) => listeners.push(listener), close: () => undefined },
      pull: async (cursor) => {
        requestedCursors.push(cursor);
        const page = remainingPulls.shift();
        if (page === undefined) throw new Error('no page left');
        return page;
      },
      cursor: 40,
      now: () => {
        const reading = remainingReadings.shift();
        if (reading === undefined) throw new Error('no reading left');
        return reading;
      },
      record: (sample) => samples.push(sample),
    });
    return { feed, samples, requestedCursors, signal: () => listeners.forEach((listener) => listener()) };
  }

  test('a send at 100 ms, changed at 150 ms and the task in the pull at 180 ms is 80 ms', async () => {
    const { feed, samples, signal, requestedCursors } = controlledFeed({
      readings: [180],
      pulls: [{ taskNumbers: [7], cursor: 41, hasMore: false }],
    });
    feed.markSent({ number: 7, sentAtMs: 100 });
    signal();
    await feed.settled();
    expect(samples).toEqual([{ scenario: ScenarioKind.ChangeFeed, status: 200, durationMs: 80, serverTiming: null }]);
    expect(requestedCursors).toEqual([40]);
  });

  test('a pull that has more pages reads the next from the cursor it was given', async () => {
    const { feed, samples, signal, requestedCursors } = controlledFeed({
      readings: [200, 210],
      pulls: [
        { taskNumbers: [8], cursor: 41, hasMore: true },
        { taskNumbers: [9], cursor: 42, hasMore: false },
      ],
    });
    feed.markSent({ number: 8, sentAtMs: 100 });
    feed.markSent({ number: 9, sentAtMs: 100 });
    signal();
    await feed.settled();
    expect(requestedCursors).toEqual([40, 41]);
    expect(samples.map((sample) => sample.durationMs)).toEqual([100, 110]);
  });

  test('a task that arrives before its send is marked is measured once the send is known', async () => {
    const { feed, samples, signal } = controlledFeed({ readings: [150], pulls: [{ taskNumbers: [7], cursor: 41, hasMore: false }] });
    signal();
    await feed.settled();
    feed.markSent({ number: 7, sentAtMs: 100 });
    expect(samples.map((sample) => sample.durationMs)).toEqual([50]);
  });

  test('a task nobody sent is ignored', async () => {
    const { feed, samples, signal } = controlledFeed({ readings: [150], pulls: [{ taskNumbers: [7], cursor: 41, hasMore: false }] });
    signal();
    await feed.settled();
    expect(samples).toEqual([]);
  });

  test('a failed pull is recorded as status zero', async () => {
    const samples: Sample[] = [];
    const listeners: (() => void)[] = [];
    const feed = openChangeFeed({
      signals: { onChanged: (listener) => listeners.push(listener), close: () => undefined },
      pull: async () => {
        throw new Error('network down');
      },
      cursor: 0,
      now: () => 5,
      record: (sample) => samples.push(sample),
    });
    listeners.forEach((listener) => listener());
    await feed.settled();
    expect(samples).toEqual([{ scenario: ScenarioKind.ChangeFeed, status: 0, durationMs: 0, serverTiming: null }]);
  });
});

describe('the seed', () => {
  const COUNTS = { taskCount: 5_000, projectCount: 200 };

  async function seeded() {
    const server = fakeOwnerServer();
    const fixture = await seedFixture({ origin: ORIGIN, fetch: server.fetch, identity: 'perf-owner', ...COUNTS });
    return { server, fixture };
  }

  test('five thousand tasks are posted as a hundred batches of fifty', async () => {
    const { server } = await seeded();
    const batches = server.requests.filter(
      (request) => request.method === 'POST' && /^\/owner\/projects\/[^/]+\/tasks$/.test(request.pathname),
    );
    expect(batches).toHaveLength(100);
    expect(batches.every((request) => (request.body as { tasks: unknown[] }).tasks.length === 50)).toBe(true);
  });

  test('all but a hundred are completed, in batches of fifty, and the fixture names the open ones', async () => {
    const { server, fixture } = await seeded();
    const completions = server.requests.filter((request) => request.pathname.endsWith('/tasks/complete'));
    expect(completions).toHaveLength(98);
    expect(fixture.doneTasks).toBe(4_900);
    expect(fixture.openNumbers).toHaveLength(100);
    expect(fixture.openNumbers[0]).toBe(4_901);
  });

  test('twenty workspaces of ten projects each make two hundred projects, the Inbox included', async () => {
    const { server, fixture } = await seeded();
    const workspaces = server.requests.filter((request) => request.method === 'POST' && request.pathname === '/owner/workspaces');
    const projects = server.requests.filter((request) => request.pathname.endsWith('/projects'));
    expect(workspaces).toHaveLength(20);
    expect(projects).toHaveLength(180);
    expect(fixture.projectIds).toHaveLength(200);
  });

  test('the hot project is the first Inbox and its key is issued for it', async () => {
    const { server, fixture } = await seeded();
    expect(fixture.hotProjectId).toBe('inbox-1');
    expect(fixture.hotKey).toBe(FAKE_PROJECT_KEY);
    expect(server.requests.some((request) => request.pathname === '/owner/projects/inbox-1/keys')).toBe(true);
  });
});
