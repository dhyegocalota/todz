import type { ScenarioKind } from './scenario-kind';
import type { Sample } from './timed-fetch';

export enum Verdict {
  Pass = 'PASS',
  Fail = 'FAIL',
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

export const REPORT_HEADER = '';

export function reportRows(_: { samples: Sample[]; durationMs: number }): ReportRow[] {
  throw new Error('reportRows is not implemented');
}

export function rowText(_: ReportRow): string {
  throw new Error('rowText is not implemented');
}
