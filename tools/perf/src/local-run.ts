import type { ChangeSignals } from './change-feed';
import type { LoopClock } from './open-loop';
import type { RunPlan } from './run-plan';
import type { Fixture } from './seed';
import type { Sample } from './timed-fetch';

export type LocalRunDependencies = {
  origin: string;
  fetch: typeof fetch;
  now: () => number;
  clock: LoopClock;
  openSignals: (access: { origin: string; token: string; projectId: string }) => Promise<ChangeSignals>;
};

export type LocalRunResult = { samples: Sample[]; durationMs: number; failures: number };

export function runLocalLoad(_: { plan: RunPlan; fixture: Fixture; dependencies: LocalRunDependencies }): Promise<LocalRunResult> {
  throw new Error('runLocalLoad is not implemented');
}
