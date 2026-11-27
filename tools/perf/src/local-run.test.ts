import { describe, expect, test } from 'vitest';
import { LOCAL_DEADLINE_GRACE_MS, LOCAL_REQUEST_TIMEOUT_MS } from './budgets';
import { fakeMcpServer } from './fake-mcp-server';
import { fakeOwnerServer } from './fake-owner-server';
import { type LocalRunDependencies, runLocalLoad } from './local-run';
import type { LoopClock } from './open-loop';
import { ORIGIN_OF_TARGET, PerfTarget, RunKind, type RunPlan } from './run-plan';
import { ScenarioKind } from './scenario-kind';
import { routedFetch } from './routed-fetch';
import type { Fixture } from './seed';

const ORIGIN = ORIGIN_OF_TARGET[PerfTarget.Local];
const FIRE_ATTEMPTS_MAX = 10_000;
const PROJECT_IDS = ['inbox-1', 'project-2', 'project-3'];
const yieldingClock: LoopClock = { now: () => 0, waitUntil: () => new Promise((resolve) => setImmediate(resolve)) };

function planOf(overrides: Partial<RunPlan> = {}): RunPlan {
  return {
    target: PerfTarget.Local,
    kind: RunKind.Load,
    ratePerSecond: 50,
    durationMs: 2_000,
    scenarios: Object.values(ScenarioKind),
    ...overrides,
  };
}

type Timer = { callback: () => void; delayMs: number };

function neverAnswering({ fetch, hung }: { fetch: typeof globalThis.fetch; hung: { count: number } }): typeof globalThis.fetch {
  return async (input, init) => {
    const request = new Request(input, init);
    const { pathname } = new URL(request.url);
    const isChangeRead = request.method === 'GET' && pathname.endsWith('/changes');
    const isStreamRead = request.method === 'GET' && pathname === '/mcp';
    const isMcpHandshake = request.method === 'POST' && !(await request.clone().text()).includes('"tools/call"');
    if (isChangeRead || isStreamRead || isMcpHandshake) return fetch(request);
    hung.count += 1;
    return new Promise<Response>(() => undefined);
  };
}

function setup({ isWedged = false }: { isWedged?: boolean } = {}) {
  const mcp = fakeMcpServer();
  const owner = fakeOwnerServer();
  const hung = { count: 0 };
  const timers: Timer[] = [];
  const routed = routedFetch({ mcp: mcp.fetch, owner: owner.fetch });
  const fetch = isWedged ? neverAnswering({ fetch: routed, hung }) : routed;
  const opened: { token: string; projectId: string }[] = [];
  const dependencies: LocalRunDependencies = {
    origin: ORIGIN,
    fetch,
    now: () => 0,
    clock: yieldingClock,
    schedule: (callback, delayMs) => timers.push({ callback, delayMs }),
    openSignals: async ({ token, projectId }) => {
      opened.push({ token, projectId });
      return { onChanged: () => undefined, close: () => undefined };
    },
  };
  const fixture: Fixture = {
    connection: { origin: ORIGIN, token: 'session-token', fetch },
    hotProjectId: 'inbox-1',
    hotToken: 'todz-at_hot_token',
    projectIds: PROJECT_IDS,
    doneTasks: 4_900,
    openNumbers: [],
  };
  return { mcp, owner, dependencies, fixture, opened, hung, timers };
}

async function firedUntilSettled<Result>({
  running,
  timers,
  isFired,
}: {
  running: Promise<Result>;
  timers: Timer[];
  isFired: (timer: Timer) => boolean;
}): Promise<Result> {
  const state = { isSettled: false };
  const settled = running.finally(() => (state.isSettled = true));
  async function fire(attemptsLeft: number): Promise<void> {
    if (state.isSettled || attemptsLeft === 0) return;
    timers
      .splice(0)
      .filter(isFired)
      .forEach((timer) => timer.callback());
    await new Promise((resolve) => setImmediate(resolve));
    return fire(attemptsLeft - 1);
  }
  await fire(FIRE_ATTEMPTS_MAX);
  return settled;
}

describe('runLocalLoad against a server that accepts and never answers', () => {
  test('the timer of a request ends it with status 0 and the run counts the failure', { timeout: 3_000 }, async () => {
    const { dependencies, fixture, hung, timers } = setup({ isWedged: true });
    const running = runLocalLoad({ plan: planOf({ durationMs: 1_000 }), fixture, dependencies });
    const result = await firedUntilSettled({ running, timers, isFired: (timer) => timer.delayMs === LOCAL_REQUEST_TIMEOUT_MS });
    expect(hung.count).toBeGreaterThan(0);
    expect(result.failures).toBe(hung.count);
    expect(result.samples.filter((sample) => sample.status === 0).length).toBeGreaterThanOrEqual(hung.count);
  });

  test('the deadline of the run ends every request still waiting, ten seconds after the duration', { timeout: 3_000 }, async () => {
    const { dependencies, fixture, hung, timers } = setup({ isWedged: true });
    const durationMs = 1_000;
    const running = runLocalLoad({ plan: planOf({ durationMs }), fixture, dependencies });
    const isDeadline = (timer: Timer) => timer.delayMs === durationMs + LOCAL_DEADLINE_GRACE_MS;
    const result = await firedUntilSettled({ running, timers, isFired: isDeadline });
    expect(hung.count).toBeGreaterThan(0);
    expect(result.failures).toBeGreaterThanOrEqual(hung.count);
  });
});

describe('runLocalLoad', () => {
  test('it measures every scenario of the mix and runs the planned number of slots', async () => {
    const { dependencies, fixture } = setup();
    const result = await runLocalLoad({ plan: planOf(), fixture, dependencies });
    const scenarios = new Set(result.samples.map((sample) => sample.scenario));
    expect(scenarios).toEqual(
      new Set([ScenarioKind.List, ScenarioKind.Add, ScenarioKind.Done, ScenarioKind.Owner, ScenarioKind.Workspaces]),
    );
    expect(result.durationMs).toBe(2_000);
    expect(result.failures).toBe(0);
  });

  test('both MCP eras are used, half and half', async () => {
    const { mcp, dependencies, fixture } = setup();
    await runLocalLoad({ plan: planOf(), fixture, dependencies });
    const methods = mcp.rpcMethods();
    expect(methods).toContain('initialize');
    expect(methods).toContain('server/discover');
    const calls = mcp.requests.filter((request) => request.headers.has('Mcp-Session-Id'));
    expect(calls.length).toBeGreaterThan(0);
  });

  test('every MCP request carries the hot project token and every owner request the session', async () => {
    const { mcp, owner, dependencies, fixture } = setup();
    await runLocalLoad({ plan: planOf(), fixture, dependencies });
    expect(mcp.requests.every((request) => request.headers.get('Authorization') === 'Bearer todz-at_hot_token')).toBe(true);
    expect(owner.requests.every((request) => request.headers.get('Authorization') === 'Bearer session-token')).toBe(true);
  });

  test('the owner scenario spreads over the many projects and completes only what it added', async () => {
    const { owner, dependencies, fixture } = setup();
    await runLocalLoad({ plan: planOf({ durationMs: 4_000 }), fixture, dependencies });
    const projectsTouched = new Set(
      owner.requests.flatMap((request) => PROJECT_IDS.filter((id) => request.pathname.startsWith(`/owner/projects/${id}`))),
    );
    expect(projectsTouched.size).toBeGreaterThan(1);
    const added = owner.requests.filter((request) => request.method === 'POST' && request.pathname.endsWith('/tasks')).length;
    const completed = owner.requests.filter((request) => request.pathname.endsWith('/tasks/complete')).length;
    expect(added).toBeGreaterThan(0);
    expect(completed).toBeLessThanOrEqual(added);
  });

  test('a done slot with no answered add becomes a list, so the scenario counts hold the rate', async () => {
    const { dependencies, fixture } = setup();
    const result = await runLocalLoad({ plan: planOf({ durationMs: 1_000 }), fixture, dependencies });
    const mcpSamples = result.samples.filter((sample) =>
      [ScenarioKind.List, ScenarioKind.Add, ScenarioKind.Done].includes(sample.scenario),
    );
    expect(mcpSamples).toHaveLength(40);
  });

  test('the change feed watches the hot project with the owner session', async () => {
    const { dependencies, fixture, opened } = setup();
    await runLocalLoad({ plan: planOf({ durationMs: 1_000 }), fixture, dependencies });
    expect(opened).toEqual([{ token: 'session-token', projectId: 'inbox-1' }]);
  });
});
