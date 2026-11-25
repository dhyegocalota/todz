import { describe, expect, test } from 'vitest';
import {
  PERF_PREDICATE,
  ProbeEventKind,
  arrivalCheck,
  arrivalLatencies,
  footprintCheck,
  launchCheck,
  probeEventsOf,
  scrollCheck,
} from './probe-log';
import { Verdict } from './report';

const PREFIX = '2026-11-25 10:00:00.123 Df Todz[1234:abcd] [dev.todz.Todz.debug:perf]';

function launchEvents(values: number[]) {
  return probeEventsOf(values.map((ms) => `${PREFIX} launch-ready ms=${ms}`).join('\n'));
}

function scrollEvents({ frames, overBudget, worstMs }: { frames: number; overBudget: number; worstMs: number }) {
  return probeEventsOf(`${PREFIX} scroll frames=${frames} over-budget=${overBudget} worst-ms=${worstMs} refresh-ms=16`);
}

function footprintEvents({ atFiveMinutes, atThirtyMinutes }: { atFiveMinutes: number; atThirtyMinutes: number }) {
  const mbs = Array.from({ length: 60 }, (_, index) => {
    if (index === 9) return atFiveMinutes;
    if (index === 59) return atThirtyMinutes;
    return atFiveMinutes;
  });
  return probeEventsOf(mbs.map((mb) => `${PREFIX} footprint mb=${mb}`).join('\n'));
}

describe('probeEventsOf', () => {
  test('lines outside the perf category are ignored', () => {
    const text = [
      '2026-11-25 10:00:00.123 Df Todz[1234:abcd] [dev.todz.Todz.debug:sync] launch-ready ms=1',
      '2026-11-25 10:00:00.123 Df Todz[1234:abcd] launch-ready ms=2',
      `${PREFIX} launch-ready ms=620`,
      'Timestamp  Ty Process[PID:TID]',
    ].join('\n');
    expect(probeEventsOf(text)).toEqual([{ kind: ProbeEventKind.LaunchReady, ms: 620 }]);
  });

  test('a perf line of any subsystem but the two bundle identifiers of the app is ignored', () => {
    const text = [
      '2026-11-25 10:00:00.123 Df Other[4321:abcd] [com.example.other:perf] launch-ready ms=1',
      '2026-11-25 10:00:00.123 Df Todz[1234:abcd] [dev.todz.Todz.widgets:perf] launch-ready ms=2',
      '2026-11-25 10:00:00.123 Df Todz[1234:abcd] [dev.todz.Todz.debug.extra:perf] launch-ready ms=3',
      '2026-11-25 10:00:00.123 Df Todz[1234:abcd] [dev.todz.Todz:perf] launch-ready ms=620',
      `${PREFIX} launch-ready ms=640`,
    ].join('\n');
    expect(probeEventsOf(text)).toEqual([
      { kind: ProbeEventKind.LaunchReady, ms: 620 },
      { kind: ProbeEventKind.LaunchReady, ms: 640 },
    ]);
  });

  test('the predicate asks the unified log for the two bundle identifiers of the app and the perf category only', () => {
    expect(PERF_PREDICATE).toBe('(subsystem == "dev.todz.Todz" OR subsystem == "dev.todz.Todz.debug") AND category == "perf"');
  });

  test('each probe line of the spec parses to its event', () => {
    const text = [
      `${PREFIX} launch-ready ms=640`,
      `${PREFIX} scroll frames=600 over-budget=3 worst-ms=55 refresh-ms=17`,
      `${PREFIX} footprint mb=180`,
      `${PREFIX} task-arrived number=7 at-ms=1640`,
    ].join('\n');
    expect(probeEventsOf(text)).toEqual([
      { kind: ProbeEventKind.LaunchReady, ms: 640 },
      { kind: ProbeEventKind.Scroll, frames: 600, overBudget: 3, worstMs: 55, refreshMs: 17 },
      { kind: ProbeEventKind.Footprint, mb: 180, processIdentifier: 1_234 },
      { kind: ProbeEventKind.TaskArrived, number: 7, atMs: 1_640 },
    ]);
  });

  test('a perf line the probe does not define is ignored', () => {
    expect(probeEventsOf(`${PREFIX} something-else value=1`)).toEqual([]);
  });
});

describe('launchCheck', () => {
  test('five launches of 620, 700, 710, 690 and 1600 have a median of 700, a maximum of 1600 and fail', () => {
    expect(launchCheck(launchEvents([620, 700, 710, 690, 1_600]))).toMatchObject({
      summary: 'median 700 ms, max 1600 ms over 5 launches',
      verdict: Verdict.Fail,
    });
  });

  test('five launches under the budgets pass', () => {
    expect(launchCheck(launchEvents([620, 700, 710, 690, 1_500])).verdict).toBe(Verdict.Pass);
  });

  test('a median of 1000 fails', () => {
    expect(launchCheck(launchEvents([1_000, 1_000, 1_000])).verdict).toBe(Verdict.Fail);
  });

  test('no launch line throws', () => {
    expect(() => launchCheck([])).toThrow('no launch-ready line');
  });
});

describe('scrollCheck', () => {
  test('six hundred frames with five over budget and a worst of 42 pass', () => {
    expect(scrollCheck(scrollEvents({ frames: 600, overBudget: 5, worstMs: 42 })).verdict).toBe(Verdict.Pass);
  });

  test('seven over budget out of six hundred fail', () => {
    expect(scrollCheck(scrollEvents({ frames: 600, overBudget: 7, worstMs: 42 })).verdict).toBe(Verdict.Fail);
  });

  test('a worst frame of 51 ms fails', () => {
    expect(scrollCheck(scrollEvents({ frames: 600, overBudget: 5, worstMs: 51 })).verdict).toBe(Verdict.Fail);
  });

  test('no scroll line throws', () => {
    expect(() => scrollCheck([])).toThrow('no scroll line');
  });
});

describe('footprintCheck', () => {
  test('180 MB at five minutes and 199 MB at thirty fail', () => {
    expect(footprintCheck(footprintEvents({ atFiveMinutes: 180, atThirtyMinutes: 199 })).verdict).toBe(Verdict.Fail);
  });

  test('180 MB at five minutes and 197 MB at thirty pass', () => {
    expect(footprintCheck(footprintEvents({ atFiveMinutes: 180, atThirtyMinutes: 197 })).verdict).toBe(Verdict.Pass);
  });

  test('a log with no soak long enough says so and skips the verdict, never throws', () => {
    expect(footprintCheck(probeEventsOf(`${PREFIX} footprint mb=180`))).toEqual({
      name: 'footprint',
      summary: 'not enough samples: the longest launch has 1 of 11',
      verdict: Verdict.Skip,
    });
  });

  test('each launch is its own series: a short launch after a soak does not change the soak verdict', () => {
    const soak = Array.from({ length: 60 }, () => `${PREFIX} footprint mb=100`);
    const shortLaunch = Array.from(
      { length: 3 },
      () => '2026-11-25 10:30:00.123 Df Todz[5678:abcd] [dev.todz.Todz.debug:perf] footprint mb=500',
    );
    expect(footprintCheck(probeEventsOf([...soak, ...shortLaunch].join('\n')))).toEqual({
      name: 'footprint',
      summary: '100 MB at 5 minutes, 100 MB after 60 samples',
      verdict: Verdict.Pass,
    });
  });

  test('two launches whose lines are interleaved are read apart', () => {
    const other = '2026-11-25 10:00:00.456 Df Todz[5678:abcd] [dev.todz.Todz.debug:perf] footprint mb=900';
    const lines = Array.from({ length: 60 }, (_, index) => {
      if (index < 20) return [`${PREFIX} footprint mb=100`, other];
      return [`${PREFIX} footprint mb=100`];
    }).flat();
    expect(footprintCheck(probeEventsOf(lines.join('\n')))).toEqual({
      name: 'footprint',
      summary: '100 MB at 5 minutes, 100 MB after 60 samples',
      verdict: Verdict.Pass,
    });
  });

  test('the launch with the most samples is the one that is judged', () => {
    const grown = Array.from({ length: 12 }, (_, index) => `${PREFIX} footprint mb=${index === 11 ? 130 : 100}`);
    const steady = Array.from(
      { length: 11 },
      () => '2026-11-25 10:30:00.123 Df Todz[5678:abcd] [dev.todz.Todz.debug:perf] footprint mb=100',
    );
    expect(footprintCheck(probeEventsOf([...steady, ...grown].join('\n'))).verdict).toBe(Verdict.Fail);
  });
});

describe('arrivals', () => {
  test('a send at 1000 and the arrival line at 1640 is 640 ms', () => {
    const arrivals = probeEventsOf(`${PREFIX} task-arrived number=7 at-ms=1640`);
    expect(arrivalLatencies({ sends: [{ number: 7, sentAtMs: 1_000 }], events: arrivals })).toEqual([640]);
  });

  test('a send nobody saw arrive and an arrival nobody sent are left out', () => {
    const arrivals = probeEventsOf(`${PREFIX} task-arrived number=8 at-ms=1640`);
    expect(arrivalLatencies({ sends: [{ number: 7, sentAtMs: 1_000 }], events: arrivals })).toEqual([]);
  });

  test('the check holds the 95th percentile under a second', () => {
    expect(arrivalCheck([640, 700, 999]).verdict).toBe(Verdict.Pass);
    expect(arrivalCheck([640, 700, 1_000]).verdict).toBe(Verdict.Fail);
  });

  test('no arrival throws', () => {
    expect(() => arrivalCheck([])).toThrow('no task-arrived line joins a send');
  });
});
