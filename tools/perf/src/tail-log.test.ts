import { describe, expect, test } from 'vitest';
import { tailSummaryOf } from './tail-log';

function eventLine({ outcome, cpuTime }: { outcome: string; cpuTime: number }): string {
  return JSON.stringify({ outcome, cpuTime, scriptName: 'todz-api', event: { request: { url: 'https://api.todz.app/mcp' } } });
}

describe('tailSummaryOf', () => {
  test('the count per outcome and the p50 and p99 of cpuTime', () => {
    const cpuTimes = Array.from({ length: 100 }, (_, index) => index + 1);
    const text = cpuTimes.map((cpuTime) => eventLine({ outcome: cpuTime === 100 ? 'exceededCpu' : 'ok', cpuTime })).join('\n');
    expect(tailSummaryOf(text)).toEqual({ outcomes: { ok: 99, exceededCpu: 1 }, cpuTimeMedianMs: 50, cpuTimeSlowestMs: 99, events: 100 });
  });

  test('a line that is not an event is ignored', () => {
    const text = ['Successfully created tail', '{"message":"connected"}', eventLine({ outcome: 'ok', cpuTime: 4 }), ''].join('\n');
    expect(tailSummaryOf(text)).toEqual({ outcomes: { ok: 1 }, cpuTimeMedianMs: 4, cpuTimeSlowestMs: 4, events: 1 });
  });

  test('pin: the projection the runbook saves, outcome and cpuTime only, is a whole event', () => {
    expect(tailSummaryOf('{"outcome":"ok","cpuTime":4}\n')).toEqual({
      outcomes: { ok: 1 },
      cpuTimeMedianMs: 4,
      cpuTimeSlowestMs: 4,
      events: 1,
    });
  });

  test('pin: a line the projection filled with null is no event', () => {
    const text = ['{"outcome":null,"cpuTime":null}', '{"outcome":"ok","cpuTime":4}'].join('\n');
    expect(tailSummaryOf(text).events).toBe(1);
  });

  test('a window with no event throws', () => {
    expect(() => tailSummaryOf('Successfully created tail\n')).toThrow('the tail window holds no event');
  });
});
