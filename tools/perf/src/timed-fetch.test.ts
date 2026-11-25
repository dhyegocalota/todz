import { describe, expect, test } from 'vitest';
import { ScenarioKind } from './scenario-kind';
import { type Sample, serverTimingOf, timedFetch } from './timed-fetch';

const FIRST_READING = 1_000;
const SECOND_READING = 1_012;

function steppedClock(readings: number[]): () => number {
  const remaining = [...readings];
  return () => {
    const reading = remaining.shift();
    if (reading === undefined) throw new Error('the clock ran out of readings');
    return reading;
  };
}

function timedWith({ answer, samples }: { answer: () => Promise<Response>; samples: Sample[] }): typeof fetch {
  return timedFetch({
    fetch: answer,
    now: steppedClock([FIRST_READING, SECOND_READING]),
    scenario: ScenarioKind.List,
    record: (sample) => samples.push(sample),
  });
}

describe('timedFetch', () => {
  test('a 200 answer records its scenario, status and the time around the call', async () => {
    const samples: Sample[] = [];
    await timedWith({ answer: async () => new Response('ok', { status: 200 }), samples })('http://localhost:8787/mcp');
    expect(samples).toEqual([{ scenario: ScenarioKind.List, status: 200, durationMs: 12, serverTiming: null }]);
  });

  test('a 503 answer is recorded as it came and is the caller to count', async () => {
    const samples: Sample[] = [];
    const answer = await timedWith({ answer: async () => new Response('down', { status: 503 }), samples })('http://localhost:8787/mcp');
    expect(answer.status).toBe(503);
    expect(samples.map((sample) => sample.status)).toEqual([503]);
  });

  test('a thrown network error records status zero and is thrown again', async () => {
    const samples: Sample[] = [];
    const failing = timedWith({
      answer: async () => {
        throw new Error('socket hang up');
      },
      samples,
    });
    await expect(failing('http://localhost:8787/mcp')).rejects.toThrow('socket hang up');
    expect(samples).toEqual([{ scenario: ScenarioKind.List, status: 0, durationMs: 12, serverTiming: null }]);
  });

  test('the Server-Timing header of the answer is recorded', async () => {
    const samples: Sample[] = [];
    const headers = { 'Server-Timing': 'directory;dur=12, project;dur=30' };
    await timedWith({ answer: async () => new Response('ok', { headers }), samples })('http://localhost:8787/mcp');
    expect(samples[0]?.serverTiming).toEqual({ directory: 12, project: 30 });
  });
});

describe('serverTimingOf', () => {
  test('a header with both stores gives their durations', () => {
    expect(serverTimingOf('directory;dur=12, project;dur=30')).toEqual({ directory: 12, project: 30 });
  });

  test('fractional durations are kept', () => {
    expect(serverTimingOf('project;dur=0.5, directory;dur=1.25')).toEqual({ directory: 1.25, project: 0.5 });
  });

  test('an absent header is null', () => {
    expect(serverTimingOf(null)).toBeNull();
  });

  test('a header without both stores is null', () => {
    expect(serverTimingOf('directory;dur=12')).toBeNull();
    expect(serverTimingOf('cache;desc=hit')).toBeNull();
  });
});
