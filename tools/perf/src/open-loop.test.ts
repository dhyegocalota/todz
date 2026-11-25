import { describe, expect, test } from 'vitest';
import { type LoopClock, type LoopSlot, runOpenLoop } from './open-loop';

function recordingClock(): { clock: LoopClock; waits: number[] } {
  const waits: number[] = [];
  const clock: LoopClock = {
    now: () => 1_000,
    waitUntil: async (timeMs) => {
      waits.push(timeMs);
    },
  };
  return { clock, waits };
}

function noop(): void {
  return undefined;
}

describe('runOpenLoop', () => {
  test('each slot starts at its planned time from the start of the loop, whatever the previous ones did', async () => {
    const { clock, waits } = recordingClock();
    const executed: LoopSlot[] = [];
    await runOpenLoop({
      starts: [0, 20, 40],
      clock,
      execute: async (slot) => {
        executed.push(slot);
      },
      onDropped: noop,
      onFailure: noop,
    });
    expect(waits).toEqual([1_000, 1_020, 1_040]);
    expect(executed).toEqual([
      { index: 0, offsetMs: 0 },
      { index: 1, offsetMs: 20 },
      { index: 2, offsetMs: 40 },
    ]);
  });

  test('a slot that finds the in-flight cap full is dropped and never executed', async () => {
    const { clock } = recordingClock();
    const executed: number[] = [];
    const dropped: number[] = [];
    await runOpenLoop({
      starts: Array.from({ length: 60 }, () => 0),
      clock,
      execute: async ({ index }) => {
        executed.push(index);
        await new Promise((resolve) => setImmediate(resolve));
      },
      onDropped: ({ index }) => dropped.push(index),
      onFailure: noop,
      inFlightMax: 50,
    });
    expect(executed).toHaveLength(50);
    expect(dropped).toEqual([50, 51, 52, 53, 54, 55, 56, 57, 58, 59]);
  });

  test('a finished request frees its place for a later slot', async () => {
    const dropped: number[] = [];
    const yielding: LoopClock = { now: () => 0, waitUntil: () => new Promise((resolve) => setImmediate(resolve)) };
    await runOpenLoop({
      starts: Array.from({ length: 10 }, () => 0),
      clock: yielding,
      execute: async () => undefined,
      onDropped: ({ index }) => dropped.push(index),
      onFailure: noop,
      inFlightMax: 1,
    });
    expect(dropped).toEqual([]);
  });

  test('a failing execution is reported and does not stop the loop', async () => {
    const { clock } = recordingClock();
    const failures: unknown[] = [];
    const executed: number[] = [];
    await runOpenLoop({
      starts: [0, 20],
      clock,
      execute: async ({ index }) => {
        executed.push(index);
        throw new Error(`slot ${index} failed`);
      },
      onDropped: noop,
      onFailure: (failure) => failures.push(failure),
    });
    expect(executed).toEqual([0, 1]);
    expect(failures).toEqual([new Error('slot 0 failed'), new Error('slot 1 failed')]);
  });
});
