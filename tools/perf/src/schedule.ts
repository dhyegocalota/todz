import { ScenarioKind } from './scenario-kind';

export type ResolvedSlot = { scenario: ScenarioKind; taskNumbers: number[] };

export function plannedStarts(_: { ratePerSecond: number; durationMs: number }): number[] {
  throw new Error('plannedStarts is not implemented');
}

export function slotScenario(_: number): ScenarioKind {
  throw new Error('slotScenario is not implemented');
}

export function resolvedSlot(_: { scenario: ScenarioKind; answeredAdds: number[]; batchSize: number }): ResolvedSlot {
  throw new Error('resolvedSlot is not implemented');
}
