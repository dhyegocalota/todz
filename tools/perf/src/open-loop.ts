export type LoopClock = { now: () => number; waitUntil: (timeMs: number) => Promise<void> };

export type LoopSlot = { index: number; offsetMs: number };

export const realClock: LoopClock = {
  now: () => performance.now(),
  waitUntil: (timeMs) => new Promise((resolve) => setTimeout(resolve, Math.max(timeMs - performance.now(), 0))),
};

export function runOpenLoop(_: {
  starts: number[];
  clock: LoopClock;
  execute: (slot: LoopSlot) => Promise<void>;
  onDropped: (slot: LoopSlot) => void;
  onFailure: (failure: unknown) => void;
  inFlightMax?: number;
}): Promise<void> {
  throw new Error('runOpenLoop is not implemented');
}
