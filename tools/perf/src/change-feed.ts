import type { ChangePage } from './owner-scenario';
import type { Sample } from './timed-fetch';

export type ChangeSignals = { onChanged: (listener: () => void) => void; close: () => void };

export type ChangeFeed = {
  markSent: (sent: { number: number; sentAtMs: number }) => void;
  settled: () => Promise<void>;
  close: () => void;
};

export function openChangeFeed(_: {
  signals: ChangeSignals;
  pull: (cursor: number) => Promise<ChangePage>;
  cursor: number;
  now: () => number;
  record: (sample: Sample) => void;
}): ChangeFeed {
  throw new Error('openChangeFeed is not implemented');
}
