import { describe, expect, test } from 'vitest';
import { fakeMcpServer } from './fake-mcp-server';
import { fakeOwnerServer } from './fake-owner-server';
import { type LocalRunDependencies, runLocalLoad } from './local-run';
import type { LoopClock } from './open-loop';
import { ORIGIN_OF_TARGET, PerfTarget, RunKind, type RunPlan } from './run-plan';
import { ScenarioKind } from './scenario-kind';
import { routedFetch } from './routed-fetch';
import type { Fixture } from './seed';

const ORIGIN = ORIGIN_OF_TARGET[PerfTarget.Local];
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

function setup() {
  const mcp = fakeMcpServer();
  const owner = fakeOwnerServer();
  const fetch = routedFetch({ mcp: mcp.fetch, owner: owner.fetch });
  const opened: { token: string; projectId: string }[] = [];
  const dependencies: LocalRunDependencies = {
    origin: ORIGIN,
    fetch,
    now: () => 0,
    clock: yieldingClock,
    openSignals: async ({ token, projectId }) => {
      opened.push({ token, projectId });
      return { onChanged: () => undefined, close: () => undefined };
    },
  };
  const fixture: Fixture = {
    connection: { origin: ORIGIN, token: 'session-token', fetch },
    hotProjectId: 'inbox-1',
    hotKey: 'todz_hot_key',
    projectIds: PROJECT_IDS,
    doneTasks: 4_900,
    openNumbers: [],
  };
  return { mcp, owner, dependencies, fixture, opened };
}

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

  test('every MCP request carries the hot project key and every owner request the session', async () => {
    const { mcp, owner, dependencies, fixture } = setup();
    await runLocalLoad({ plan: planOf(), fixture, dependencies });
    expect(mcp.requests.every((request) => request.headers.get('Authorization') === 'Bearer todz_hot_key')).toBe(true);
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
