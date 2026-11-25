import { MILLISECONDS_PER_SECOND } from '@todz/types';
import { ScenarioKind } from './scenario-kind';

export type ResolvedSlot = { scenario: ScenarioKind; taskNumbers: number[] };

const SLOT_PATTERN: ScenarioKind[] = [
  ScenarioKind.List,
  ScenarioKind.Add,
  ScenarioKind.List,
  ScenarioKind.Done,
  ScenarioKind.Owner,
  ScenarioKind.List,
  ScenarioKind.Add,
  ScenarioKind.List,
  ScenarioKind.Done,
  ScenarioKind.Owner,
];

export function plannedStarts({ ratePerSecond, durationMs }: { ratePerSecond: number; durationMs: number }): number[] {
  if (ratePerSecond <= 0) throw new Error('the rate must be positive');
  const count = Math.floor((ratePerSecond * durationMs) / MILLISECONDS_PER_SECOND);
  return Array.from({ length: count }, (_, index) => (index * MILLISECONDS_PER_SECOND) / ratePerSecond);
}

export function slotScenario(index: number): ScenarioKind {
  const scenario = SLOT_PATTERN[index % SLOT_PATTERN.length];
  if (scenario === undefined) throw new Error(`no scenario for slot ${index}`);
  return scenario;
}

export function resolvedSlot({
  scenario,
  answeredAdds,
  batchSize,
}: {
  scenario: ScenarioKind;
  answeredAdds: number[];
  batchSize: number;
}): ResolvedSlot {
  if (scenario !== ScenarioKind.Done) return { scenario, taskNumbers: [] };
  const taskNumbers = answeredAdds.splice(0, batchSize);
  if (taskNumbers.length === 0) return { scenario: ScenarioKind.List, taskNumbers };
  return { scenario, taskNumbers };
}
