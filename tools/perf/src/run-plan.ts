import { ScenarioKind } from './scenario-kind';

export enum PerfTarget {
  Local = 'local',
  Production = 'production',
}

export enum RunKind {
  Load = 'load',
  Stress = 'stress',
}

export type RunPlan = { target: PerfTarget; kind: RunKind; ratePerSecond: number; durationMs: number; scenarios: ScenarioKind[] };

export const ORIGIN_OF_TARGET: Record<PerfTarget, string> = {
  [PerfTarget.Local]: 'http://localhost:8787',
  [PerfTarget.Production]: 'https://api.todz.app',
};

export function perfTargetOf(_: string): PerfTarget {
  throw new Error('perfTargetOf is not implemented');
}

export function validatedPlan(_: RunPlan): RunPlan {
  throw new Error('validatedPlan is not implemented');
}

export function scenarioAt(_: { plan: RunPlan; index: number; offsetMs: number }): ScenarioKind {
  throw new Error('scenarioAt is not implemented');
}
