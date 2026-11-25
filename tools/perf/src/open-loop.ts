export type LoopClock = { now: () => number; waitUntil: (timeMs: number) => Promise<void> };

export type LoopSlot = { index: number; offsetMs: number };

export const realClock: LoopClock = {
  now: () => performance.now(),
  waitUntil: (timeMs) => new Promise((resolve) => setTimeout(resolve, Math.max(timeMs - performance.now(), 0))),
};

export async function runOpenLoop({
  starts,
  clock,
  execute,
  onDropped,
  onFailure,
  inFlightMax = Number.POSITIVE_INFINITY,
}: {
  starts: number[];
  clock: LoopClock;
  execute: (slot: LoopSlot) => Promise<void>;
  onDropped: (slot: LoopSlot) => void;
  onFailure: (failure: unknown) => void;
  inFlightMax?: number;
}): Promise<void> {
  const startedAt = clock.now();
  const inFlight = { count: 0 };
  await Promise.all(
    starts.map(async (offsetMs, index) => {
      await clock.waitUntil(startedAt + offsetMs);
      const slot = { index, offsetMs };
      if (inFlight.count >= inFlightMax) return onDropped(slot);
      inFlight.count += 1;
      try {
        await execute(slot);
      } catch (failure) {
        onFailure(failure);
      } finally {
        inFlight.count -= 1;
      }
    }),
  );
}
