import { describe, expect, test } from 'vitest';
import { REPORT_HEADER, Verdict, reportRows, rowText } from './report';
import { ScenarioKind } from './scenario-kind';
import type { Sample } from './timed-fetch';

const HUNDRED = 100;

function sampleOf({
  scenario = ScenarioKind.List,
  status = 200,
  durationMs,
  serverTiming = null,
}: Partial<Sample> & { durationMs: number }): Sample {
  return { scenario, status, durationMs, serverTiming };
}

function hundredSamples({ percentile95, percentile99 }: { percentile95: number; percentile99: number }): Sample[] {
  const durations = [...Array.from({ length: 94 }, () => 10), ...Array.from({ length: 4 }, () => percentile95), percentile99, percentile99];
  return durations.map((durationMs) => sampleOf({ durationMs }));
}

describe('reportRows', () => {
  test('a scenario with p95 149, p99 399 and no 5xx passes', () => {
    const [row] = reportRows({ samples: hundredSamples({ percentile95: 149, percentile99: 399 }), durationMs: 2_000 });
    expect(row).toMatchObject({
      scenario: ScenarioKind.List,
      requests: HUNDRED,
      percentile95: 149,
      percentile99: 399,
      failures: 0,
      verdict: Verdict.Pass,
    });
  });

  test('a scenario with p95 150 fails', () => {
    const [row] = reportRows({ samples: hundredSamples({ percentile95: 150, percentile99: 300 }), durationMs: 2_000 });
    expect(row?.verdict).toBe(Verdict.Fail);
  });

  test('a scenario with p99 400 fails', () => {
    const [row] = reportRows({ samples: hundredSamples({ percentile95: 100, percentile99: 400 }), durationMs: 2_000 });
    expect(row?.verdict).toBe(Verdict.Fail);
  });

  test('one 5xx fails a fast scenario and is counted', () => {
    const samples = [...hundredSamples({ percentile95: 20, percentile99: 30 }).slice(1), sampleOf({ durationMs: 5, status: 503 })];
    const [row] = reportRows({ samples, durationMs: 2_000 });
    expect(row).toMatchObject({ failures: 1, verdict: Verdict.Fail });
  });

  test('a network error, a 429 and a redirect are failures too', () => {
    const statuses = [0, 429, 302];
    const rows = statuses.map((status) => reportRows({ samples: [sampleOf({ durationMs: 5, status })], durationMs: 1_000 })[0]);
    expect(rows.map((row) => row?.failures)).toEqual([1, 1, 1]);
    expect(rows.map((row) => row?.verdict)).toEqual([Verdict.Fail, Verdict.Fail, Verdict.Fail]);
  });

  test('the achieved rate is the count over the run seconds', () => {
    const [row] = reportRows({ samples: hundredSamples({ percentile95: 20, percentile99: 30 }), durationMs: 2_000 });
    expect(row?.ratePerSecond).toBe(50);
  });

  test('the median directory and project durations come from the answers that carried them', () => {
    const timed = [10, 20, 30].map((directory) => sampleOf({ durationMs: 5, serverTiming: { directory, project: directory * 2 } }));
    const [row] = reportRows({ samples: [...timed, sampleOf({ durationMs: 5 })], durationMs: 1_000 });
    expect(row).toMatchObject({ directoryMs: 20, projectMs: 40 });
  });

  test('without any Server-Timing the split is empty', () => {
    const [row] = reportRows({ samples: [sampleOf({ durationMs: 5 })], durationMs: 1_000 });
    expect(row).toMatchObject({ directoryMs: null, projectMs: null });
  });

  test('a 2025-era initialize is held to 400 ms at p95 and the change feed to 1000 ms', () => {
    const initialize = [sampleOf({ scenario: ScenarioKind.Initialize, durationMs: 399 })];
    const slowInitialize = [sampleOf({ scenario: ScenarioKind.Initialize, durationMs: 400 })];
    const feed = [sampleOf({ scenario: ScenarioKind.ChangeFeed, durationMs: 999 })];
    const slowFeed = [sampleOf({ scenario: ScenarioKind.ChangeFeed, durationMs: 1_000 })];
    const verdictOf = (samples: Sample[]) => reportRows({ samples, durationMs: 1_000 })[0]?.verdict;
    expect([verdictOf(initialize), verdictOf(slowInitialize), verdictOf(feed), verdictOf(slowFeed)]).toEqual([
      Verdict.Pass,
      Verdict.Fail,
      Verdict.Pass,
      Verdict.Fail,
    ]);
  });

  test('one row per scenario, in the order of the scenarios', () => {
    const samples = [ScenarioKind.Done, ScenarioKind.List].map((scenario) => sampleOf({ scenario, durationMs: 5 }));
    expect(reportRows({ samples, durationMs: 1_000 }).map((row) => row.scenario)).toEqual([ScenarioKind.List, ScenarioKind.Done]);
  });
});

describe('rowText', () => {
  test('the header names the columns in the order of the spec', () => {
    expect(REPORT_HEADER).toBe(
      'scenario | requests | rate/s | p50 ms | p95 ms | p99 ms | max ms | 5xx | directory ms | project ms | verdict',
    );
  });

  test('a row prints its cells in that order, the split empty when absent', () => {
    const [row] = reportRows({ samples: hundredSamples({ percentile95: 149, percentile99: 399 }), durationMs: 2_000 });
    expect(row).toBeDefined();
    expect(rowText(row!)).toBe('list | 100 | 50 | 10 | 149 | 399 | 399 | 0 |  |  | PASS');
  });
});
