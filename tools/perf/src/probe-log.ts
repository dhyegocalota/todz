import {
  CHANGE_FEED_PERCENTILE_95_MAX_MS,
  FOOTPRINT_BASELINE_SAMPLE_INDEX,
  FOOTPRINT_GROWTH_RATIO_MAX,
  LAUNCH_MAX_MS,
  LAUNCH_MEDIAN_MAX_MS,
  PERCENTILE_MEDIAN,
  PERCENTILE_SLOW,
  SCROLL_FRAME_MAX_MS,
  SCROLL_OVER_BUDGET_SHARE_MAX,
} from './budgets';
import { percentileOf } from './percentiles';
import { Verdict } from './report';

export enum ProbeEventKind {
  LaunchReady = 'launch-ready',
  Scroll = 'scroll',
  Footprint = 'footprint',
  TaskArrived = 'task-arrived',
}

export type ProbeEvent =
  | { kind: ProbeEventKind.LaunchReady; ms: number }
  | { kind: ProbeEventKind.Scroll; frames: number; overBudget: number; worstMs: number; refreshMs: number }
  | { kind: ProbeEventKind.Footprint; mb: number; processIdentifier: number }
  | { kind: ProbeEventKind.TaskArrived; number: number; atMs: number };

export type AppCheck = { name: string; summary: string; verdict: Verdict };

export type Send = { number: number; sentAtMs: number };

type Values = Record<string, number>;

const APP_SUBSYSTEMS = ['dev.todz.Todz', 'dev.todz.Todz.debug'];
const SUBSYSTEM_ALTERNATIVES = APP_SUBSYSTEMS.map((subsystem) => subsystem.replaceAll('.', '\\.')).join('|');
export const PERF_PREDICATE = `(${APP_SUBSYSTEMS.map((subsystem) => `subsystem == "${subsystem}"`).join(' OR ')}) AND category == "perf"`;
const PERF_LINE_PATTERN = new RegExp(`\\[(\\d+):[0-9a-f]+\\]\\s+\\[(?:${SUBSYSTEM_ALTERNATIVES}):perf\\]\\s+(\\S+)\\s*(.*)$`);
const VALUE_PATTERN = /([a-z-]+)=(\d+)/g;
const PROCESS_GROUP = 1;
const KIND_GROUP = 2;
const PAYLOAD_GROUP = 3;
const NAME_GROUP = 1;
const NUMBER_GROUP = 2;
const FIRST_AFTER_BASELINE = 1;

function valueOf({ values, name }: { values: Values; name: string }): number {
  const value = values[name];
  if (value === undefined) throw new Error(`a probe line has no ${name}`);
  return value;
}

const PARSER_OF_KIND: Record<ProbeEventKind, (line: { values: Values; processIdentifier: number }) => ProbeEvent> = {
  [ProbeEventKind.LaunchReady]: ({ values }) => ({ kind: ProbeEventKind.LaunchReady, ms: valueOf({ values, name: 'ms' }) }),
  [ProbeEventKind.Scroll]: ({ values }) => ({
    kind: ProbeEventKind.Scroll,
    frames: valueOf({ values, name: 'frames' }),
    overBudget: valueOf({ values, name: 'over-budget' }),
    worstMs: valueOf({ values, name: 'worst-ms' }),
    refreshMs: valueOf({ values, name: 'refresh-ms' }),
  }),
  [ProbeEventKind.Footprint]: ({ values, processIdentifier }) => ({
    kind: ProbeEventKind.Footprint,
    mb: valueOf({ values, name: 'mb' }),
    processIdentifier,
  }),
  [ProbeEventKind.TaskArrived]: ({ values }) => ({
    kind: ProbeEventKind.TaskArrived,
    number: valueOf({ values, name: 'number' }),
    atMs: valueOf({ values, name: 'at-ms' }),
  }),
};

function eventOf(line: string): ProbeEvent[] {
  const match = PERF_LINE_PATTERN.exec(line);
  if (match === null) return [];
  const kind = Object.values(ProbeEventKind).find((candidate) => candidate === match[KIND_GROUP]);
  if (kind === undefined) return [];
  const values = Object.fromEntries(
    [...String(match[PAYLOAD_GROUP]).matchAll(VALUE_PATTERN)].map((pair) => [pair[NAME_GROUP], Number(pair[NUMBER_GROUP])]),
  );
  return [PARSER_OF_KIND[kind]({ values, processIdentifier: Number(match[PROCESS_GROUP]) })];
}

export function probeEventsOf(logText: string): ProbeEvent[] {
  return logText.split('\n').flatMap(eventOf);
}

function verdictOf(isPassing: boolean): Verdict {
  if (isPassing) return Verdict.Pass;
  return Verdict.Fail;
}

export function launchCheck(events: ProbeEvent[]): AppCheck {
  const launches = events.flatMap((event) => (event.kind === ProbeEventKind.LaunchReady ? [event.ms] : []));
  if (launches.length === 0) throw new Error('no launch-ready line');
  const median = percentileOf({ samples: launches, percentile: PERCENTILE_MEDIAN });
  const slowest = launches.reduce((largest, launch) => Math.max(largest, launch));
  return {
    name: 'launch',
    summary: `median ${median} ms, max ${slowest} ms over ${launches.length} launches`,
    verdict: verdictOf(median < LAUNCH_MEDIAN_MAX_MS && slowest <= LAUNCH_MAX_MS),
  };
}

export function scrollCheck(events: ProbeEvent[]): AppCheck {
  const scrolls = events.flatMap((event) => (event.kind === ProbeEventKind.Scroll ? [event] : []));
  const scroll = scrolls.at(-1);
  if (scroll === undefined) throw new Error('no scroll line');
  const overBudgetShare = scroll.overBudget / scroll.frames;
  return {
    name: 'scroll',
    summary: `${scroll.frames} frames, ${scroll.overBudget} over budget, worst ${scroll.worstMs} ms`,
    verdict: verdictOf(scroll.worstMs <= SCROLL_FRAME_MAX_MS && overBudgetShare <= SCROLL_OVER_BUDGET_SHARE_MAX),
  };
}

export function footprintCheck(events: ProbeEvent[]): AppCheck {
  const samples = events.flatMap((event) => (event.kind === ProbeEventKind.Footprint ? [event] : []));
  const processIdentifiers = [...new Set(samples.map((sample) => sample.processIdentifier))];
  const launches = processIdentifiers.map((processIdentifier) =>
    samples.filter((sample) => sample.processIdentifier === processIdentifier).map((sample) => sample.mb),
  );
  const footprints = launches.reduce<number[]>((longest, launch) => (launch.length > longest.length ? launch : longest), []);
  const baseline = footprints[FOOTPRINT_BASELINE_SAMPLE_INDEX];
  const latest = footprints.at(-1);
  const samplesNeeded = FOOTPRINT_BASELINE_SAMPLE_INDEX + FIRST_AFTER_BASELINE + 1;
  if (baseline === undefined || latest === undefined || footprints.length < samplesNeeded) {
    return {
      name: 'footprint',
      summary: `not enough samples: the longest launch has ${footprints.length} of ${samplesNeeded}`,
      verdict: Verdict.Skip,
    };
  }
  return {
    name: 'footprint',
    summary: `${baseline} MB at 5 minutes, ${latest} MB after ${footprints.length} samples`,
    verdict: verdictOf(latest <= baseline * (1 + FOOTPRINT_GROWTH_RATIO_MAX)),
  };
}

export function arrivalLatencies({ sends, events }: { sends: Send[]; events: ProbeEvent[] }): number[] {
  const arrivals = new Map(
    events.flatMap((event) => (event.kind === ProbeEventKind.TaskArrived ? [[event.number, event.atMs] as const] : [])),
  );
  return sends.flatMap(({ number, sentAtMs }) => {
    const arrivedAtMs = arrivals.get(number);
    if (arrivedAtMs === undefined) return [];
    return [arrivedAtMs - sentAtMs];
  });
}

export function arrivalCheck(latencies: number[]): AppCheck {
  if (latencies.length === 0) throw new Error('no task-arrived line joins a send');
  const percentile95 = percentileOf({ samples: latencies, percentile: PERCENTILE_SLOW });
  return {
    name: 'change feed',
    summary: `p95 ${percentile95} ms over ${latencies.length} tasks`,
    verdict: verdictOf(percentile95 < CHANGE_FEED_PERCENTILE_95_MAX_MS),
  };
}
