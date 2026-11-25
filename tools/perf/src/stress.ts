import {
  PERCENTILE_SLOWEST,
  STRESS_FAILURE_RATIO_MAX,
  STRESS_PERCENTILE_99_MAX_MS,
  STRESS_RATE_CEILING_PER_SECOND,
  STRESS_RATE_FACTOR,
  STRESS_START_RATE_PER_SECOND,
} from './budgets';
import { percentileOf } from './percentiles';
import { isFailure } from './report';
import type { Sample } from './timed-fetch';

export type StressOutcome = { held: number | null; broke: number | null; reachedCeiling: boolean };

export function isStressPassing(outcome: StressOutcome): boolean {
  throw new Error('isStressPassing is not implemented');
}

export function stepBroke(samples: Sample[]): boolean {
  if (samples.length === 0) return true;
  const failureRatio = samples.filter(isFailure).length / samples.length;
  const percentile99 = percentileOf({ samples: samples.map((sample) => sample.durationMs), percentile: PERCENTILE_SLOWEST });
  return failureRatio > STRESS_FAILURE_RATIO_MAX || percentile99 > STRESS_PERCENTILE_99_MAX_MS;
}

export function runStress({ runStep }: { runStep: (ratePerSecond: number) => Promise<Sample[]> }): Promise<StressOutcome> {
  async function ramp({ rate, held }: { rate: number; held: number | null }): Promise<StressOutcome> {
    if (rate > STRESS_RATE_CEILING_PER_SECOND) return { held, broke: null, reachedCeiling: true };
    if (stepBroke(await runStep(rate))) return { held, broke: rate, reachedCeiling: false };
    return ramp({ rate: rate * STRESS_RATE_FACTOR, held: rate });
  }
  return ramp({ rate: STRESS_START_RATE_PER_SECOND, held: null });
}
