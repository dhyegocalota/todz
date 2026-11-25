import { PERCENTILE_MEDIAN, PERCENTILE_SLOWEST } from './budgets';
import { fieldOf, numberOf, textOf } from './json-reader';
import { percentileOf } from './percentiles';

export type TailSummary = { outcomes: Record<string, number>; cpuTimeMedianMs: number; cpuTimeSlowestMs: number; events: number };

type TailEvent = { outcome: string; cpuTime: number };

function eventOf(line: string): TailEvent[] {
  try {
    const value: unknown = JSON.parse(line);
    return [{ outcome: textOf(fieldOf({ value, name: 'outcome' })), cpuTime: numberOf(fieldOf({ value, name: 'cpuTime' })) }];
  } catch {
    return [];
  }
}

export function tailSummaryOf(tailText: string): TailSummary {
  const events = tailText.split('\n').flatMap(eventOf);
  if (events.length === 0) throw new Error('the tail window holds no event');
  const cpuTimes = events.map((event) => event.cpuTime);
  const outcomes = Object.fromEntries(
    [...new Set(events.map((event) => event.outcome))].map((outcome) => [
      outcome,
      events.filter((event) => event.outcome === outcome).length,
    ]),
  );
  return {
    outcomes,
    cpuTimeMedianMs: percentileOf({ samples: cpuTimes, percentile: PERCENTILE_MEDIAN }),
    cpuTimeSlowestMs: percentileOf({ samples: cpuTimes, percentile: PERCENTILE_SLOWEST }),
    events: events.length,
  };
}
