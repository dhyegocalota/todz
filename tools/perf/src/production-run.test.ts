import { beforeAll, describe, expect, test } from 'vitest';
import { fieldOf, listOf, numberOf, textOf } from './json-reader';
import { fakeMcpServer } from './fake-mcp-server';
import { type FakeTaskServer, fakeTaskServer } from './fake-task-server';
import type { ExecFile } from './keychain-key';
import type { LoopClock } from './open-loop';
import { type ProductionDependencies, type ProductionResult, cleanupProduction, runProduction } from './production-run';
import { ScenarioKind } from './scenario-kind';

const RUN = 'abcd1234';
const PREFIX = `todz-perf ${RUN} #`;
const KEY = 'todz_production_perf_key';
const PRODUCTION_MCP_URL = 'https://api.todz.app/mcp';
const FOREIGN_TITLES = ['Buy milk', 'todz-perf other999 #1'];
const LOST_ADD_TITLE = `${PREFIX}6`;
const CUTOFF_SLOT_INDEX = 5_000;
const ADDS_BEFORE_CUTOFF = 1_000;

const yieldingClock: LoopClock = { now: () => 0, waitUntil: () => new Promise((resolve) => setImmediate(resolve)) };

const keychainWithKey: ExecFile = async () => ({ stdout: `${KEY}\n` });

function dependenciesOver({
  fetch,
  execFile = keychainWithKey,
}: {
  fetch: typeof globalThis.fetch;
  execFile?: ExecFile;
}): ProductionDependencies & { sends: string[] } {
  const sends: string[] = [];
  const epoch = { reading: 1_700_000_000_000 };
  return {
    execFile,
    fetch,
    now: () => 0,
    epochNow: () => epoch.reading++,
    clock: yieldingClock,
    schedule: () => undefined,
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
    const lists = state.server.toolCalls().filter((call) => call.name === 'list');
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

  test('only the three MCP scenarios are measured and the key is nowhere in the result or the sends', () => {
    expect(new Set(state.result.samples.map((sample) => sample.scenario))).toEqual(
      new Set([ScenarioKind.List, ScenarioKind.Add, ScenarioKind.Done]),
    );
    expect(JSON.stringify(state.result)).not.toContain(KEY);
    expect(state.sends.join('\n')).not.toContain(KEY);
  });
});

describe('a production run without its key', () => {
  test('a missing Keychain item stops the run before any request', async () => {
    const server = fakeMcpServer();
    const execFile: ExecFile = async () => {
      throw new Error('not found');
    };
    await expect(runProduction(dependenciesOver({ fetch: server.fetch, execFile }))).rejects.toThrow(
      'the todz-perf-key Keychain item is missing',
    );
    expect(server.requests).toEqual([]);
  });
});

describe('a production run the server refuses', () => {
  test('a 401 per call is one failed request each, never retried, and the key stays out of the result', async () => {
    const server = fakeMcpServer({ isUnauthorized: true });
    const dependencies = dependenciesOver({ fetch: server.fetch });
    const result = await runProduction(dependencies);
    const calls = server.rpcMethods().filter((method) => method === 'tools/call');
    expect(server.requests.some((request) => request.method !== 'POST')).toBe(false);
    expect(calls.length).toBe(result.samples.length);
    expect(result.failures).toBeGreaterThan(0);
    expect(result.openTasksLeft).toBeNull();
    expect(JSON.stringify(result)).not.toContain(KEY);
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
});
