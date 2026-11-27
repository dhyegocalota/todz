import { beforeAll, describe, expect, test } from 'vitest';
import {
  CLEANUP_DURATION_MAX_MS,
  CLEANUP_RATE_MAX,
  PRODUCTION_FAILURES_CONSECUTIVE_MAX,
  PRODUCTION_FOREIGN_OPEN_TASKS_MAX,
} from './budgets';
import { fieldOf, listOf, numberOf, textOf } from './json-reader';
import { fakeMcpServer } from './fake-mcp-server';
import { type FakeTaskServer, fakeTaskServer } from './fake-task-server';
import type { LoopClock } from './open-loop';
import { type ProductionDependencies, type ProductionResult, cleanupProduction, runProduction } from './production-run';
import { ScenarioKind } from './scenario-kind';
import type { Scheduler } from './wire-guard';

const RUN = 'abcd1234';
const PREFIX = `todz-perf ${RUN} #`;
const TOKEN = 'todz-at_production_perf_token';
const PRODUCTION_MCP_URL = 'https://api.todz.app/mcp';
const FOREIGN_TITLES = ['Buy milk', 'todz-perf other999 #1'];
const LOST_ADD_TITLE = `${PREFIX}6`;
const CUTOFF_SLOT_INDEX = 5_000;
const ADDS_BEFORE_CUTOFF = 1_000;
const PREFLIGHT_LISTS = 2;
const REQUESTS_BEFORE_REVOCATION = 5;
const MILLISECONDS_PER_SECOND = 1_000;
const SLOW_REQUEST_MS = 5_000;

const yieldingClock: LoopClock = { now: () => 0, waitUntil: () => new Promise((resolve) => setImmediate(resolve)) };

const authorizedWithToken = async (): Promise<string> => TOKEN;

function virtualTime(): { clock: LoopClock; schedule: Scheduler; advanceBy: (milliseconds: number) => void; nowMs: () => number } {
  const state = { nowMs: 0, timers: [] as { atMs: number; callback: () => void }[] };
  function advanceTo(timeMs: number): void {
    state.nowMs = Math.max(state.nowMs, timeMs);
    const due = state.timers.filter((timer) => timer.atMs <= state.nowMs);
    state.timers = state.timers.filter((timer) => timer.atMs > state.nowMs);
    due.forEach((timer) => timer.callback());
  }
  return {
    clock: {
      now: () => state.nowMs,
      waitUntil: async (timeMs) => advanceTo(timeMs),
    },
    schedule: (callback, delayMs) => state.timers.push({ atMs: state.nowMs + delayMs, callback }),
    advanceBy: (milliseconds) => advanceTo(state.nowMs + milliseconds),
    nowMs: () => state.nowMs,
  };
}

function dependenciesOver({
  fetch,
  accessToken = authorizedWithToken,
  clock = yieldingClock,
  schedule = () => undefined,
  interruption = new AbortController().signal,
}: {
  fetch: typeof globalThis.fetch;
  accessToken?: () => Promise<string>;
  clock?: LoopClock;
  schedule?: Scheduler;
  interruption?: AbortSignal;
}): ProductionDependencies & { sends: string[] } {
  const sends: string[] = [];
  const epoch = { reading: 1_700_000_000_000 };
  return {
    accessToken,
    fetch,
    now: () => 0,
    epochNow: () => epoch.reading++,
    clock,
    schedule,
    interruption,
    runIdentifier: RUN,
    writeSend: (line) => sends.push(line),
    sends,
  };
}

describe('a full production run', () => {
  const state = {} as { server: FakeTaskServer; result: ProductionResult; sends: string[] };

  beforeAll(async () => {
    const server = fakeTaskServer({ openTitles: FOREIGN_TITLES, isLostAdd: (title) => title === LOST_ADD_TITLE });
    const dependencies = dependenciesOver({ fetch: server.fetch });
    state.server = server;
    state.result = await runProduction(dependencies);
    state.sends = dependencies.sends;
  });

  test('only POST https://api.todz.app/mcp ever leaves, and only the list, add and done tools', () => {
    expect(new Set(state.server.requests.map((request) => `${request.method} ${request.url}`))).toEqual(
      new Set([`POST ${PRODUCTION_MCP_URL}`]),
    );
    expect(new Set(state.server.toolCalls().map((call) => call.name))).toEqual(new Set(['list', 'add', 'done']));
  });

  test('every add carries the run in its title and its idempotency key', () => {
    const adds = state.server.toolCalls().filter((call) => call.name === 'add');
    const slots = adds.map((call) => {
      const draft = listOf(call.arguments.tasks)[0];
      const title = textOf(fieldOf({ value: draft, name: 'title' }));
      const slot = title.replace(PREFIX, '');
      expect(title).toBe(`${PREFIX}${slot}`);
      expect(fieldOf({ value: draft, name: 'idempotency_key' })).toBe(`todz-perf-${RUN}-${slot}`);
      return Number(slot);
    });
    expect(adds).toHaveLength(ADDS_BEFORE_CUTOFF);
    expect(Math.max(...slots)).toBeLessThan(CUTOFF_SLOT_INDEX);
  });

  test('from the first filtered list on, every list is filtered by the run prefix', () => {
    const lists = state.server
      .toolCalls()
      .filter((call) => call.name === 'list')
      .slice(PREFLIGHT_LISTS);
    const firstFilteredIndex = lists.findIndex((call) => call.arguments.text !== undefined);
    expect(firstFilteredIndex).toBeGreaterThan(-1);
    expect(lists.slice(firstFilteredIndex).map((call) => call.arguments.text)).toEqual(lists.slice(firstFilteredIndex).map(() => PREFIX));
  });

  test('the run completes its own tasks, a lost add included, and leaves every foreign task open', () => {
    expect(state.server.openTasks().map((task) => task.title)).toEqual(FOREIGN_TITLES);
  });

  test('a foreign task is never named in a done', () => {
    const doneIdentifiers = state.server
      .toolCalls()
      .filter((call) => call.name === 'done')
      .flatMap((call) => listOf(call.arguments.ids).map(textOf));
    expect(doneIdentifiers).not.toContain('T-1');
    expect(doneIdentifiers).not.toContain('T-2');
  });

  test('a done never carries more than fifty tasks', () => {
    const sizes = state.server
      .toolCalls()
      .filter((call) => call.name === 'done')
      .map((call) => listOf(call.arguments.ids).length);
    expect(Math.max(...sizes)).toBeLessThanOrEqual(50);
  });

  test('the open count is the matched count of a final filtered list, here zero', () => {
    expect(state.result.openTasksLeft).toBe(0);
  });

  test('each answered add writes one JSON line with its number and send time, the lost one none', () => {
    const lines = state.sends.map((line) => ({
      number: numberOf(fieldOf({ value: JSON.parse(line), name: 'number' })),
      sentAtMs: numberOf(fieldOf({ value: JSON.parse(line), name: 'sentAtMs' })),
    }));
    expect(lines).toHaveLength(ADDS_BEFORE_CUTOFF - 1);
    expect(lines.every((line) => line.sentAtMs >= 1_700_000_000_000)).toBe(true);
    expect(state.sends.every((line) => line === JSON.stringify(JSON.parse(line)))).toBe(true);
  });

  test('only the three MCP scenarios are measured and the token is nowhere in the result or the sends', () => {
    expect(new Set(state.result.samples.map((sample) => sample.scenario))).toEqual(
      new Set([ScenarioKind.List, ScenarioKind.Add, ScenarioKind.Done]),
    );
    expect(JSON.stringify(state.result)).not.toContain(TOKEN);
    expect(state.sends.join('\n')).not.toContain(TOKEN);
  });
});

describe('a production run without its token', () => {
  test('a refused authorization stops the run before any request', async () => {
    const server = fakeMcpServer();
    const accessToken = async (): Promise<string> => {
      throw new Error('the authorization was not approved');
    };
    await expect(runProduction(dependenciesOver({ fetch: server.fetch, accessToken }))).rejects.toThrow(
      'the authorization was not approved',
    );
    expect(server.requests).toEqual([]);
  });
});

describe('a production run the server refuses', () => {
  test('a 401 before the run starts refuses it after one request, never retried, with the token out of the message', async () => {
    const server = fakeMcpServer({ isUnauthorized: true });
    const failure = await runProduction(dependenciesOver({ fetch: server.fetch })).catch((error: Error) => error);
    expect(failure).toBeInstanceOf(Error);
    expect(String(failure)).not.toContain(TOKEN);
    expect(server.requests.some((request) => request.method !== 'POST')).toBe(false);
    expect(server.rpcMethods().filter((method) => method === 'tools/call')).toHaveLength(1);
  });

  test('the first 401 in the middle of the run stops it: one more request, then nothing leaves', async () => {
    const server = fakeTaskServer();
    const answered = { toolCalls: 0 };
    const revokedAfterFive: typeof globalThis.fetch = async (input, init) => {
      const request = new Request(input, init);
      const isToolCall = (await request.clone().text()).includes('"tools/call"');
      if (isToolCall) answered.toolCalls += 1;
      if (isToolCall && answered.toolCalls > REQUESTS_BEFORE_REVOCATION) return new Response(null, { status: 401 });
      return server.fetch(request);
    };
    const result = await runProduction(dependenciesOver({ fetch: revokedAfterFive }));
    expect(answered.toolCalls).toBe(REQUESTS_BEFORE_REVOCATION + 1);
    expect(result.failures).toBeGreaterThan(0);
    expect(result.openTasksLeft).toBeNull();
    expect(JSON.stringify(result)).not.toContain(TOKEN);
  });

  test('consecutive failures stop the run after the named number of them', async () => {
    const calls = { count: 0 };
    const down = () => {
      calls.count += 1;
      if (calls.count > PREFLIGHT_LISTS) throw new Error('the server is down');
      return 'Open tasks: 0 of 0';
    };
    const server = fakeMcpServer({ toolAnswers: { list: down, add: down, done: down } });
    const result = await runProduction(dependenciesOver({ fetch: server.fetch }));
    expect(server.toolCalls()).toHaveLength(PREFLIGHT_LISTS + PRODUCTION_FAILURES_CONSECUTIVE_MAX);
    expect(result.failures).toBeGreaterThanOrEqual(PRODUCTION_FAILURES_CONSECUTIVE_MAX);
  });

  test('failures with a success between them never reach the stop', async () => {
    const calls = { count: 0 };
    const server = fakeMcpServer({
      toolAnswers: {
        list: () => {
          calls.count += 1;
          if (calls.count > PREFLIGHT_LISTS && calls.count % 2 === 0) throw new Error('a blip');
          return 'Open tasks: 0 of 0';
        },
      },
    });
    await runProduction(dependenciesOver({ fetch: server.fetch }));
    expect(server.toolCalls().length).toBeGreaterThan(PREFLIGHT_LISTS + PRODUCTION_FAILURES_CONSECUTIVE_MAX * 100);
  });
});

describe('a project that is not the todz-perf Inbox', () => {
  test('more open tasks than the limit without the prefix refuse the run before an add or a done', async () => {
    const foreignCount = PRODUCTION_FOREIGN_OPEN_TASKS_MAX + 1;
    const server = fakeTaskServer({ openTitles: Array.from({ length: foreignCount }, (_, index) => `Buy milk ${index}`) });
    await expect(runProduction(dependenciesOver({ fetch: server.fetch }))).rejects.toThrow(
      `the project holds ${foreignCount} open tasks that are not todz-perf tasks`,
    );
    expect(new Set(server.toolCalls().map((call) => call.name))).toEqual(new Set(['list']));
    expect(server.openTasks()).toHaveLength(foreignCount);
  });

  test('the limit itself passes, and the open tasks of earlier runs do not count', async () => {
    const foreign = Array.from({ length: PRODUCTION_FOREIGN_OPEN_TASKS_MAX }, (_, index) => `Buy milk ${index}`);
    const earlierRun = Array.from({ length: 30 }, (_, index) => `todz-perf old999 #${index}`);
    const server = fakeTaskServer({ openTitles: [...foreign, ...earlierRun] });
    const result = await runProduction(dependenciesOver({ fetch: server.fetch }));
    expect(result.dropped).toBe(0);
    expect(server.openTasks().map((task) => task.title)).toEqual([...foreign, ...earlierRun]);
  });
});

describe('the cleanup of a run', () => {
  test('only a filtered list and done are sent, in batches of fifty, and the foreign tasks stay open', async () => {
    const own = Array.from({ length: 120 }, (_, index) => `${PREFIX}${index}`);
    const lookalike = `Remember ${PREFIX}9 later`;
    const server = fakeTaskServer({ openTitles: [...FOREIGN_TITLES, lookalike, ...own] });
    const { openTasksLeft } = await cleanupProduction(dependenciesOver({ fetch: server.fetch }));
    const calls = server.toolCalls();
    expect(new Set(calls.map((call) => call.name))).toEqual(new Set(['list', 'done']));
    expect(calls.filter((call) => call.name === 'list').every((call) => call.arguments.text === PREFIX)).toBe(true);
    expect(calls.filter((call) => call.name === 'done').every((call) => listOf(call.arguments.ids).length <= 50)).toBe(true);
    expect(server.openTasks().map((task) => task.title)).toEqual([...FOREIGN_TITLES, lookalike]);
    expect(openTasksLeft).toBe(1);
  });

  async function cleanupTimed({ ownCount, slowRequestMs }: { ownCount: number; slowRequestMs: number }) {
    const server = fakeTaskServer({ openTitles: Array.from({ length: ownCount }, (_, index) => `${PREFIX}${index}`) });
    const time = virtualTime();
    const sentAtMs: number[] = [];
    const timed: typeof globalThis.fetch = async (input, init) => {
      const request = new Request(input, init);
      const isToolCall = (await request.clone().text()).includes('"tools/call"');
      if (!isToolCall) return server.fetch(request);
      sentAtMs.push(time.nowMs());
      time.advanceBy(slowRequestMs);
      return server.fetch(request);
    };
    const result = await cleanupProduction(dependenciesOver({ fetch: timed, clock: time.clock, schedule: time.schedule }));
    return { sentAtMs, result, server };
  }

  test('pin: no window of one second holds more than fifty requests', async () => {
    const { sentAtMs, result } = await cleanupTimed({ ownCount: 5_000, slowRequestMs: 0 });
    expect(result.openTasksLeft).toBe(0);
    expect(sentAtMs.length).toBeGreaterThan(CLEANUP_RATE_MAX * 2);
    const windows = sentAtMs.flatMap((sentAt, index) => {
      const fiftyOneth = sentAtMs[index + CLEANUP_RATE_MAX];
      if (fiftyOneth === undefined) return [];
      return [fiftyOneth - sentAt];
    });
    expect(windows.every((window) => window >= MILLISECONDS_PER_SECOND)).toBe(true);
  });

  test('pin: nothing leaves at or after sixty seconds, and the count it could not read is null', async () => {
    const { sentAtMs, result } = await cleanupTimed({ ownCount: 1_000, slowRequestMs: SLOW_REQUEST_MS });
    expect(sentAtMs.length).toBeGreaterThan(1);
    expect(sentAtMs.every((sentAt) => sentAt < CLEANUP_DURATION_MAX_MS)).toBe(true);
    expect(result.openTasksLeft).toBeNull();
  });
});
