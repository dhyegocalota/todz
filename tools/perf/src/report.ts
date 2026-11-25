import { MILLISECONDS_PER_SECOND } from '@todz/types';
import {
  CHANGE_FEED_PERCENTILE_95_MAX_MS,
  INITIALIZE_PERCENTILE_95_MAX_MS,
  LATENCY_PERCENTILE_95_MAX_MS,
  LATENCY_PERCENTILE_99_MAX_MS,
  PERCENTILE_MEDIAN,
  PERCENTILE_SLOW,
  PERCENTILE_SLOWEST,
} from './budgets';
import { percentileOf } from './percentiles';
import { ScenarioKind } from './scenario-kind';
import type { Sample } from './timed-fetch';

export enum Verdict {
  Pass = 'PASS',
  Fail = 'FAIL',
  Skip = 'SKIP',
}

export type ReportRow = {
  scenario: ScenarioKind;
  requests: number;
  ratePerSecond: number;
  percentile50: number;
  percentile95: number;
  percentile99: number;
  maxMs: number;
  failures: number;
  directoryMs: number | null;
  projectMs: number | null;
  verdict: Verdict;
};

type LatencyBudget = { percentile95MaxMs: number; percentile99MaxMs: number | null };

export const REPORT_HEADER = 'scenario | requests | rate/s | p50 ms | p95 ms | p99 ms | max ms | 5xx | directory ms | project ms | verdict';

const REQUEST_BUDGET: LatencyBudget = { percentile95MaxMs: LATENCY_PERCENTILE_95_MAX_MS, percentile99MaxMs: LATENCY_PERCENTILE_99_MAX_MS };

const BUDGET_OF_SCENARIO: Record<ScenarioKind, LatencyBudget> = {
  [ScenarioKind.List]: REQUEST_BUDGET,
  [ScenarioKind.Add]: REQUEST_BUDGET,
  [ScenarioKind.Done]: REQUEST_BUDGET,
  [ScenarioKind.Owner]: REQUEST_BUDGET,
  [ScenarioKind.Workspaces]: REQUEST_BUDGET,
  [ScenarioKind.Initialize]: { percentile95MaxMs: INITIALIZE_PERCENTILE_95_MAX_MS, percentile99MaxMs: null },
  [ScenarioKind.ChangeFeed]: { percentile95MaxMs: CHANGE_FEED_PERCENTILE_95_MAX_MS, percentile99MaxMs: null },
};

const SUCCESS_STATUS_MIN = 200;
const REDIRECT_STATUS_MIN = 300;

export function isFailure({ status }: Sample): boolean {
  return status < SUCCESS_STATUS_MIN || status >= REDIRECT_STATUS_MIN;
}

function medianOf(values: number[]): number | null {
  if (values.length === 0) return null;
  return percentileOf({ samples: values, percentile: PERCENTILE_MEDIAN });
}

function rowOf({ scenario, samples, durationMs }: { scenario: ScenarioKind; samples: Sample[]; durationMs: number }): ReportRow {
  const durations = samples.map((sample) => sample.durationMs);
  const timings = samples.flatMap((sample) => (sample.serverTiming === null ? [] : [sample.serverTiming]));
  const percentile95 = percentileOf({ samples: durations, percentile: PERCENTILE_SLOW });
  const percentile99 = percentileOf({ samples: durations, percentile: PERCENTILE_SLOWEST });
  const failures = samples.filter(isFailure).length;
  const budget = BUDGET_OF_SCENARIO[scenario];
  const isSlowAtPercentile99 = budget.percentile99MaxMs !== null && percentile99 >= budget.percentile99MaxMs;
  const isFailed = failures > 0 || percentile95 >= budget.percentile95MaxMs || isSlowAtPercentile99;
  return {
    scenario,
    requests: samples.length,
    ratePerSecond: samples.length / (durationMs / MILLISECONDS_PER_SECOND),
    percentile50: percentileOf({ samples: durations, percentile: PERCENTILE_MEDIAN }),
    percentile95,
    percentile99,
    maxMs: durations.reduce((largest, duration) => Math.max(largest, duration)),
    failures,
    directoryMs: medianOf(timings.map((timing) => timing.directory)),
    projectMs: medianOf(timings.map((timing) => timing.project)),
    verdict: isFailed ? Verdict.Fail : Verdict.Pass,
  };
}

export function reportRows({ samples, durationMs }: { samples: Sample[]; durationMs: number }): ReportRow[] {
  return Object.values(ScenarioKind)
    .map((scenario) => ({ scenario, samples: samples.filter((sample) => sample.scenario === scenario) }))
    .filter((group) => group.samples.length > 0)
    .map((group) => rowOf({ ...group, durationMs }));
}

function cellOf(value: number | null): string {
  if (value === null) return '';
  return String(Math.round(value));
}

export function rowText(row: ReportRow): string {
  return [
    row.scenario,
    row.requests,
    cellOf(row.ratePerSecond),
    cellOf(row.percentile50),
    cellOf(row.percentile95),
    cellOf(row.percentile99),
    cellOf(row.maxMs),
    row.failures,
    cellOf(row.directoryMs),
    cellOf(row.projectMs),
    row.verdict,
  ].join(' | ');
}
