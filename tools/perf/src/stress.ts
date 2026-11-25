import type { Sample } from './timed-fetch';

export type StressOutcome = { held: number | null; broke: number | null; reachedCeiling: boolean };

export function stepBroke(_: Sample[]): boolean {
  throw new Error('stepBroke is not implemented');
}

export function runStress(_: { runStep: (ratePerSecond: number) => Promise<Sample[]> }): Promise<StressOutcome> {
  throw new Error('runStress is not implemented');
}
