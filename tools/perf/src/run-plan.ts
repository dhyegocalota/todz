import { MILLISECONDS_PER_SECOND } from '@todz/types';
import { PRODUCTION_ADD_CUTOFF_MS, PRODUCTION_DURATION_MAX_MS, PRODUCTION_RATE_MAX } from './budgets';
import { ScenarioKind } from './scenario-kind';
import { slotScenario } from './schedule';
import { UsageError } from './usage-error';

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

const PRODUCTION_SCENARIOS = [ScenarioKind.List, ScenarioKind.Add, ScenarioKind.Done];

export function perfTargetOf(value: string): PerfTarget {
  const target = Object.values(PerfTarget).find((candidate) => candidate === value);
  if (target === undefined) throw new UsageError(`unknown target ${value}`);
  return target;
}

export function validatedPlan(plan: RunPlan): RunPlan {
  if (plan.target === PerfTarget.Local) return plan;
  const isOutsideMcp = plan.scenarios.some((scenario) => !PRODUCTION_SCENARIOS.includes(scenario));
  if (plan.kind === RunKind.Stress) throw new Error('stress runs on local only');
  if (plan.ratePerSecond > PRODUCTION_RATE_MAX) throw new Error(`production is capped at ${PRODUCTION_RATE_MAX} requests a second`);
  if (plan.durationMs > PRODUCTION_DURATION_MAX_MS) {
    throw new Error(`production is capped at ${PRODUCTION_DURATION_MAX_MS / MILLISECONDS_PER_SECOND} seconds`);
  }
  if (isOutsideMcp) throw new Error('production runs MCP only');
  return plan;
}

export function scenarioAt({ plan, index, offsetMs }: { plan: RunPlan; index: number; offsetMs: number }): ScenarioKind {
  const scenario = slotScenario(index);
  if (plan.target === PerfTarget.Local) return scenario;
  if (offsetMs >= PRODUCTION_ADD_CUTOFF_MS) return ScenarioKind.Done;
  if (scenario === ScenarioKind.Owner) return ScenarioKind.List;
  return scenario;
}
