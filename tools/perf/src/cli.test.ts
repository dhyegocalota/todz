import { describe, expect, test } from 'vitest';
import { type CliDependencies, runCli } from './cli';
import { type FakeMcpServer, fakeMcpServer } from './fake-mcp-server';
import { fakeOwnerServer } from './fake-owner-server';
import { fakeTaskServer } from './fake-task-server';
import type { ExecFile } from './exec-file';
import type { LoopClock } from './open-loop';
import { routedFetch } from './routed-fetch';

const yieldingClock: LoopClock = { now: () => 0, waitUntil: () => new Promise((resolve) => setImmediate(resolve)) };
const INTERRUPT_AT_REQUEST = 40;
const PREFIX = '2026-11-25 10:00:00.123 Df Todz[1234:abcd] [dev.todz.Todz.debug:perf]';

type Logs = { out: string[]; err: string[] };

type Harness = {
  dependencies: CliDependencies;
  out: string[];
  err: string[];
  requests: () => number;
  urls: () => string[];
  interrupt: () => Promise<number>;
};

function harness({
  now = () => 0,
  execFile = async () => ({ stdout: 'todz_perf_secret\n' }),
  files = {},
  mcp = fakeMcpServer(),
  onRequest = () => undefined,
}: {
  now?: () => number;
  execFile?: ExecFile;
  files?: Record<string, string>;
  mcp?: FakeMcpServer;
  onRequest?: (context: { logs: Logs; interrupt: () => Promise<number>; input: Parameters<typeof fetch>[0] }) => void;
} = {}): Harness {
  const owner = fakeOwnerServer();
  const out: string[] = [];
  const err: string[] = [];
  const interruption: { handler: (() => Promise<number>) | null } = { handler: null };
  const interrupt = () => {
    if (interruption.handler === null) throw new Error('no interrupt handler was registered');
    return interruption.handler();
  };
  const routed = routedFetch({ mcp: mcp.fetch, owner: owner.fetch });
  const dependencies: CliDependencies = {
    fetch: (input, init) => {
      onRequest({ logs: { out, err }, interrupt, input });
      return routed(input, init);
    },
    onInterrupt: (handler) => {
      interruption.handler = handler;
    },
    now,
    epochNow: () => 1_700_000_000_000,
    clock: yieldingClock,
    schedule: () => undefined,
    execFile,
    readFile: async (path) => {
      const text = files[path];
      if (text === undefined) throw new Error(`no file ${path}`);
      return text;
    },
    openSignals: async () => ({ onChanged: () => undefined, close: () => undefined }),
    randomIdentifier: () => 'abcd1234',
    out: (text) => out.push(text),
    err: (text) => err.push(text),
  };
  return {
    dependencies,
    out,
    err,
    requests: () => mcp.requests.length + owner.requests.length,
    urls: () => [...mcp.requests, ...owner.requests].map((request) => request.url),
    interrupt,
  };
}

function slowClock(): () => number {
  const reading = { value: 0 };
  return () => (reading.value += 200);
}

describe('runCli usage', () => {
  test('an unknown command prints the usage and exits 2', async () => {
    const { dependencies, err } = harness();
    expect(await runCli({ argv: ['bogus'], dependencies })).toBe(2);
    expect(err.join('\n')).toContain('usage: pnpm perf <command>');
  });

  test('no command prints the usage and exits 2', async () => {
    const { dependencies, err } = harness();
    expect(await runCli({ argv: [], dependencies })).toBe(2);
    expect(err.join('\n')).toContain('usage: pnpm perf <command>');
  });

  test('stress on production exits 2 before any request', async () => {
    const { dependencies, err, requests } = harness();
    expect(await runCli({ argv: ['stress', '--target', 'production'], dependencies })).toBe(2);
    expect(err.join('\n')).toContain('stress runs on local only');
    expect(requests()).toBe(0);
  });

  test('load on production exits 2 before any request', async () => {
    const { dependencies, requests } = harness();
    expect(await runCli({ argv: ['load', '--target', 'production'], dependencies })).toBe(2);
    expect(requests()).toBe(0);
  });

  test('a local port moves only the port of localhost', async () => {
    const { dependencies, urls } = harness();
    expect(await runCli({ argv: ['seed', '--tasks', '100', '--projects', '10', '--port', '8799'], dependencies })).toBe(0);
    expect(urls().every((url) => url.startsWith('http://localhost:8799/'))).toBe(true);
  });

  test('a port that is not a port exits 2 before any request', async () => {
    const { dependencies, requests } = harness();
    expect(await runCli({ argv: ['seed', '--tasks', '100', '--projects', '10', '--port', '99999'], dependencies })).toBe(2);
    expect(await runCli({ argv: ['load', '--port', 'eighty'], dependencies })).toBe(2);
    expect(requests()).toBe(0);
  });

  test('a target that is not one of the two exits 2', async () => {
    const { dependencies, err, requests } = harness();
    expect(await runCli({ argv: ['load', '--target', 'https://example.com'], dependencies })).toBe(2);
    expect(err.join('\n')).toContain('unknown target https://example.com');
    expect(requests()).toBe(0);
  });
});

describe('runCli load', () => {
  test('it exits 0 and prints one PASS row per scenario when every scenario holds its budget', async () => {
    const { dependencies, out } = harness();
    expect(await runCli({ argv: ['load'], dependencies })).toBe(0);
    const text = out.join('\n');
    expect(text).toContain('scenario | requests | rate/s | p50 ms | p95 ms | p99 ms | max ms | 5xx | directory ms | project ms | verdict');
    expect(text).toContain('done tasks at the start: 4900');
    expect(text).not.toContain('FAIL');
    expect(text.match(/PASS/g)?.length).toBeGreaterThanOrEqual(6);
  });

  test('it exits 1 when a scenario misses its budget', async () => {
    const { dependencies, out } = harness({ now: slowClock() });
    expect(await runCli({ argv: ['load'], dependencies })).toBe(1);
    expect(out.join('\n')).toContain('FAIL');
  });
});

describe('runCli load seed line', () => {
  test('the seed counts are printed before the first timed request', async () => {
    const state = { outBeforeFirstMcpRequest: null as string | null };
    const { dependencies } = harness({
      onRequest: ({ logs, input }) => {
        const isMcpRequest = new Request(input).url.endsWith('/mcp');
        if (isMcpRequest && state.outBeforeFirstMcpRequest === null) state.outBeforeFirstMcpRequest = logs.out.join('');
      },
    });
    await runCli({ argv: ['load'], dependencies });
    expect(state.outBeforeFirstMcpRequest).toContain('seeded: 5000 tasks in the hot project (4900 done)');
  });
});

describe('runCli seed', () => {
  test('it prints the identity to sign the app in with and the hot project', async () => {
    const { dependencies, out } = harness();
    expect(await runCli({ argv: ['seed', '--tasks', '5000', '--projects', '200'], dependencies })).toBe(0);
    expect(out.join('\n')).toContain('identity: todz-perf-seed');
    expect(out.join('\n')).toContain('hot project: inbox-1');
  });

  test('it refuses a task count that is not a number', async () => {
    const { dependencies, requests } = harness();
    expect(await runCli({ argv: ['seed', '--tasks', 'many', '--projects', '200'], dependencies })).toBe(2);
    expect(requests()).toBe(0);
  });
});

describe('runCli production', () => {
  test('a missing Keychain item exits 1 before any request and names the item', async () => {
    const execFile: ExecFile = async () => {
      throw new Error('not found');
    };
    const { dependencies, err, requests } = harness({ execFile });
    expect(await runCli({ argv: ['production'], dependencies })).toBe(1);
    expect(err.join('\n')).toContain('the todz-perf-key Keychain item is missing');
    expect(requests()).toBe(0);
  });

  test('a cleanup without its run identifier exits 2', async () => {
    const { dependencies, requests } = harness();
    expect(await runCli({ argv: ['production', '--cleanup'], dependencies })).toBe(2);
    expect(requests()).toBe(0);
  });

  test('the run identifier reaches the error output before the first request', async () => {
    const state = { errBeforeFirstRequest: null as string | null };
    const { dependencies } = harness({
      onRequest: ({ logs }) => {
        if (state.errBeforeFirstRequest === null) state.errBeforeFirstRequest = logs.err.join('');
      },
    });
    await runCli({ argv: ['production'], dependencies });
    expect(state.errBeforeFirstRequest).toBe('run: abcd1234\n');
  });

  test('an interrupt stops the traffic, completes the run own tasks, prints the open count and exits 1', async () => {
    const mcp = fakeTaskServer();
    const addsMade = () => mcp.toolCalls().filter((call) => call.name === 'add').length;
    const state = { requests: 0, addsAtInterrupt: 0, exit: null as Promise<number> | null };
    const { dependencies, err } = harness({
      mcp,
      onRequest: ({ interrupt }) => {
        state.requests += 1;
        if (state.requests !== INTERRUPT_AT_REQUEST) return;
        state.addsAtInterrupt = addsMade();
        state.exit = interrupt();
      },
    });
    await runCli({ argv: ['production'], dependencies });
    expect(await state.exit).toBe(1);
    expect(state.addsAtInterrupt).toBeGreaterThan(0);
    expect(addsMade()).toBeLessThanOrEqual(state.addsAtInterrupt + 1);
    expect(err.join('')).toContain('open tasks left: 0');
    expect(mcp.openTasks()).toEqual([]);
  });

  test('pin: a cleanup that leaves three open tasks of the prefix prints the count and exits 1', async () => {
    const mcp = fakeTaskServer({ openTitles: ['a todz-perf r1 # b', 'c todz-perf r1 # d', 'e todz-perf r1 # f'] });
    const { dependencies, err } = harness({ mcp });
    expect(await runCli({ argv: ['production', '--cleanup', 'r1'], dependencies })).toBe(1);
    expect(err.join('')).toContain('open tasks left: 3');
  });

  test('pin: a cleanup that completes everything prints zero and exits 0', async () => {
    const mcp = fakeTaskServer({ openTitles: ['todz-perf r1 #1', 'todz-perf r1 #2'] });
    const { dependencies, err } = harness({ mcp });
    expect(await runCli({ argv: ['production', '--cleanup', 'r1'], dependencies })).toBe(0);
    expect(err.join('')).toContain('open tasks left: 0');
  });
});

describe('runCli tail and app', () => {
  test('tail prints the outcomes and the cpuTime percentiles of a saved window', async () => {
    const line = JSON.stringify({ outcome: 'ok', cpuTime: 4 });
    const { dependencies, out } = harness({ files: { '/scratch/tail.json': `${line}\n` } });
    expect(await runCli({ argv: ['tail', '/scratch/tail.json'], dependencies })).toBe(0);
    expect(out.join('\n')).toContain('ok: 1');
    expect(out.join('\n')).toContain('cpuTime p50 4 ms, p99 4 ms');
  });

  test('tail without a file exits 2', async () => {
    const { dependencies } = harness();
    expect(await runCli({ argv: ['tail'], dependencies })).toBe(2);
  });

  test('app exits 1 when a check fails and prints it', async () => {
    const lines = [1_600, 1_700, 1_800].map((ms) => `${PREFIX} launch-ready ms=${ms}`).join('\n');
    const { dependencies, out } = harness({ execFile: async () => ({ stdout: lines }) });
    expect(await runCli({ argv: ['app'], dependencies })).toBe(1);
    expect(out.join('\n')).toContain('launch: median 1700 ms, max 1800 ms over 3 launches FAIL');
  });

  test('app exits 0 when every check passes', async () => {
    const lines = [600, 700, 650].map((ms) => `${PREFIX} launch-ready ms=${ms}`).join('\n');
    const { dependencies } = harness({ execFile: async () => ({ stdout: lines }) });
    expect(await runCli({ argv: ['app'], dependencies })).toBe(0);
  });
});
