import type { ChangePage } from './owner-scenario';
import { ScenarioKind } from './scenario-kind';
import type { Sample } from './timed-fetch';

export type ChangeSignals = { onChanged: (listener: () => void) => void; close: () => void };

export type ChangeFeed = {
  markSent: (sent: { number: number; sentAtMs: number }) => void;
  settled: () => Promise<void>;
  close: () => void;
};

const SUCCESS_STATUS = 200;
const FAILED_STATUS = 0;

export function openChangeFeed({
  signals,
  pull,
  cursor,
  now,
  record,
}: {
  signals: ChangeSignals;
  pull: (cursor: number) => Promise<ChangePage>;
  cursor: number;
  now: () => number;
  record: (sample: Sample) => void;
}): ChangeFeed {
  const sentAt = new Map<number, number>();
  const arrivedAt = new Map<number, number>();
  const state = { cursor, pending: Promise.resolve() };

  function measure(number: number): void {
    const sent = sentAt.get(number);
    const arrived = arrivedAt.get(number);
    if (sent === undefined || arrived === undefined) return;
    sentAt.delete(number);
    arrivedAt.delete(number);
    record({ scenario: ScenarioKind.ChangeFeed, status: SUCCESS_STATUS, durationMs: arrived - sent, serverTiming: null });
  }

  async function pullAll(): Promise<void> {
    const page = await pull(state.cursor);
    state.cursor = page.cursor;
    page.taskNumbers.forEach((number) => {
      arrivedAt.set(number, now());
      measure(number);
    });
    if (page.hasMore) return pullAll();
  }

  function recordFailure(): void {
    record({ scenario: ScenarioKind.ChangeFeed, status: FAILED_STATUS, durationMs: 0, serverTiming: null });
  }

  signals.onChanged(() => {
    state.pending = state.pending.then(pullAll).catch(recordFailure);
  });

  return {
    markSent({ number, sentAtMs }) {
      sentAt.set(number, sentAtMs);
      measure(number);
    },
    settled: () => state.pending,
    close: signals.close,
  };
}
