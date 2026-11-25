import { describe, expect, test } from 'vitest';
import { type CliDependencies, runCli } from './cli';
import { fakeMcpServer } from './fake-mcp-server';
import { fakeOwnerServer } from './fake-owner-server';
import type { ExecFile } from './exec-file';
import type { LoopClock } from './open-loop';
import { routedFetch } from './routed-fetch';

const yieldingClock: LoopClock = { now: () => 0, waitUntil: () => new Promise((resolve) => setImmediate(resolve)) };
const PREFIX = '2026-11-25 10:00:00.123 Df Todz[1234:abcd] [dev.todz.Todz.debug:perf]';

type Harness = { dependencies: CliDependencies; out: string[]; err: string[]; requests: () => number };

function harness({
  now = () => 0,
  execFile = async () => ({ stdout: 'todz_perf_secret\n' }),
  files = {},
}: { now?: () => number; execFile?: ExecFile; files?: Record<string, string> } = {}): Harness {
  const mcp = fakeMcpServer();
  const owner = fakeOwnerServer();
  const out: string[] = [];
  const err: string[] = [];
  const dependencies: CliDependencies = {
    fetch: routedFetch({ mcp: mcp.fetch, owner: owner.fetch }),
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
  return { dependencies, out, err, requests: () => mcp.requests.length + owner.requests.length };
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
