import type { ExecFile } from './keychain-key';
import type { LoopClock } from './open-loop';
import type { Sample } from './timed-fetch';
import type { Scheduler } from './wire-guard';

export type ProductionDependencies = {
  execFile: ExecFile;
  fetch: typeof fetch;
  now: () => number;
  epochNow: () => number;
  clock: LoopClock;
  schedule: Scheduler;
  runIdentifier: string;
  writeSend: (line: string) => void;
};

export type ProductionResult = {
  runIdentifier: string;
  samples: Sample[];
  durationMs: number;
  dropped: number;
  failures: number;
  openTasksLeft: number | null;
};

export type CleanupResult = { samples: Sample[]; openTasksLeft: number | null };

export function runProduction(_: ProductionDependencies): Promise<ProductionResult> {
  throw new Error('runProduction is not implemented');
}

export function cleanupProduction(_: Omit<ProductionDependencies, 'writeSend'>): Promise<CleanupResult> {
  throw new Error('cleanupProduction is not implemented');
}
