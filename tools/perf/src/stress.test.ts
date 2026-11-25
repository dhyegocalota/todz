import { describe, expect, test } from 'vitest';
import { ScenarioKind } from './scenario-kind';
import { runStress, stepBroke } from './stress';
import type { Sample } from './timed-fetch';

function samplesOf({ count, status = 200, durationMs = 10 }: { count: number; status?: number; durationMs?: number }): Sample[] {
  return Array.from({ length: count }, () => ({ scenario: ScenarioKind.List, status, durationMs, serverTiming: null }));
}

describe('stepBroke', () => {
  test('a healthy step held', () => {
    expect(stepBroke(samplesOf({ count: 100 }))).toBe(false);
  });

  test('more than one percent of failures broke it', () => {
    expect(stepBroke([...samplesOf({ count: 98 }), ...samplesOf({ count: 2, status: 503 })])).toBe(true);
  });

  test('exactly one percent of failures held', () => {
    expect(stepBroke([...samplesOf({ count: 99 }), ...samplesOf({ count: 1, status: 503 })])).toBe(false);
  });

  test('a p99 over two seconds broke it', () => {
    expect(stepBroke([...samplesOf({ count: 98 }), ...samplesOf({ count: 2, durationMs: 2_001 })])).toBe(true);
  });

  test('a p99 of exactly two seconds held', () => {
    expect(stepBroke([...samplesOf({ count: 98 }), ...samplesOf({ count: 2, durationMs: 2_000 })])).toBe(false);
  });

  test('a step with no sample broke', () => {
    expect(stepBroke([])).toBe(true);
  });
});

describe('runStress', () => {
  test('it starts at 50 a second, multiplies by 1.5 and names the last step that held and the first that broke', async () => {
    const rates: number[] = [];
    const outcome = await runStress({
      runStep: async (ratePerSecond) => {
        rates.push(ratePerSecond);
        return samplesOf({ count: 100, durationMs: ratePerSecond > 300 ? 3_000 : 10 });
      },
    });
    expect(rates).toEqual([50, 75, 112.5, 168.75, 253.125, 379.6875]);
    expect(outcome).toEqual({ held: 253.125, broke: 379.6875, reachedCeiling: false });
  });

  test('a first step that breaks has held nothing', async () => {
    const outcome = await runStress({ runStep: async () => samplesOf({ count: 100, status: 503 }) });
    expect(outcome).toEqual({ held: null, broke: 50, reachedCeiling: false });
  });

  test('a server that never breaks stops at the ceiling', async () => {
    const outcome = await runStress({ runStep: async () => samplesOf({ count: 100 }) });
    expect(outcome.broke).toBeNull();
    expect(outcome.reachedCeiling).toBe(true);
    expect(outcome.held).toBeGreaterThan(5_000);
  });
});
