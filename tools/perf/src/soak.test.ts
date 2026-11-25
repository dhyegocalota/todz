import { describe, expect, test } from 'vitest';
import { fakeMcpServer } from './fake-mcp-server';
import { fakeOwnerServer } from './fake-owner-server';
import type { LocalRunDependencies } from './local-run';
import type { LoopClock } from './open-loop';
import { routedFetch } from './routed-fetch';
import { runSoak } from './soak';

const yieldingClock: LoopClock = { now: () => 0, waitUntil: () => new Promise((resolve) => setImmediate(resolve)) };

describe('runSoak', () => {
  test('it updates the same fifty open tasks round-robin once a second and lists beside them', async () => {
    const openList = Array.from({ length: 50 }, (_, index) => `T-${index + 4_901} soak ${index}`).join('\n');
    const mcp = fakeMcpServer({
      toolAnswers: { list: () => `Open tasks: 50 of 100\n${openList}`, update: () => 'Updated T-4901 soak' },
    });
    const owner = fakeOwnerServer();
    const fetch = routedFetch({ mcp: mcp.fetch, owner: owner.fetch });
    const dependencies: LocalRunDependencies = {
      origin: 'http://localhost:8787',
      fetch,
      now: () => 0,
      clock: yieldingClock,
      schedule: () => undefined,
      openSignals: async () => ({ onChanged: () => undefined, close: () => undefined }),
    };
    const result = await runSoak({
      access: { connection: { origin: dependencies.origin, token: 'session-token', fetch }, hotProjectId: 'inbox-1' },
      durationMs: 51_000,
      dependencies,
    });
    const updates = mcp.toolCalls().filter((call) => call.name === 'update');
    expect(result).toEqual({ updates: 51, lists: 51, failures: 0 });
    expect(updates.slice(0, 3).map((call) => call.arguments.id)).toEqual(['T-4901', 'T-4902', 'T-4903']);
    expect(updates.at(-1)?.arguments.id).toBe('T-4901');
    expect(new Set(updates.map((call) => call.arguments.id)).size).toBe(50);
  });
});
