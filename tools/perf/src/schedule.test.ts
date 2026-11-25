import { describe, expect, test } from 'vitest';
import { ScenarioKind } from './scenario-kind';
import { plannedStarts, resolvedSlot, slotScenario } from './schedule';

const SLOT_COUNT = 100;
const TEN_SLOT_PATTERN = [
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

function countOf({ scenarios, scenario }: { scenarios: ScenarioKind[]; scenario: ScenarioKind }): number {
  return scenarios.filter((candidate) => candidate === scenario).length;
}

describe('plannedStarts', () => {
  test('fifty a second for a second start every twenty milliseconds', () => {
    const starts = plannedStarts({ ratePerSecond: 50, durationMs: 1_000 });
    expect(starts).toHaveLength(50);
    expect(starts.slice(0, 3)).toEqual([0, 20, 40]);
    expect(starts.at(-1)).toBe(980);
  });

  test('a rate of zero throws', () => {
    expect(() => plannedStarts({ ratePerSecond: 0, durationMs: 1_000 })).toThrow('the rate must be positive');
  });
});

describe('slotScenario', () => {
  const hundredScenarios = () => Array.from({ length: SLOT_COUNT }, (_, index) => slotScenario(index));

  test('a hundred slots hold forty list, twenty add, twenty done and twenty owner', () => {
    const scenarios = hundredScenarios();
    expect(countOf({ scenarios, scenario: ScenarioKind.List })).toBe(40);
    expect(countOf({ scenarios, scenario: ScenarioKind.Add })).toBe(20);
    expect(countOf({ scenarios, scenario: ScenarioKind.Done })).toBe(20);
    expect(countOf({ scenarios, scenario: ScenarioKind.Owner })).toBe(20);
  });

  test('the ten-slot pattern is fixed and repeats', () => {
    const scenarios = hundredScenarios();
    expect(scenarios.slice(0, 10)).toEqual(TEN_SLOT_PATTERN);
    expect(scenarios.slice(10, 20)).toEqual(TEN_SLOT_PATTERN);
  });
});

describe('resolvedSlot', () => {
  test('a done slot takes the oldest answered add and leaves the rest', () => {
    const answeredAdds = [11, 12, 13];
    expect(resolvedSlot({ scenario: ScenarioKind.Done, answeredAdds, batchSize: 1 })).toEqual({
      scenario: ScenarioKind.Done,
      taskNumbers: [11],
    });
    expect(answeredAdds).toEqual([12, 13]);
  });

  test('a done slot takes up to its batch size', () => {
    const answeredAdds = [11, 12, 13];
    expect(resolvedSlot({ scenario: ScenarioKind.Done, answeredAdds, batchSize: 2 }).taskNumbers).toEqual([11, 12]);
  });

  test('a done slot with no answered add becomes a list slot, so the rate holds', () => {
    expect(resolvedSlot({ scenario: ScenarioKind.Done, answeredAdds: [], batchSize: 1 })).toEqual({
      scenario: ScenarioKind.List,
      taskNumbers: [],
    });
  });

  test('any other slot passes through untouched', () => {
    const answeredAdds = [11];
    expect(resolvedSlot({ scenario: ScenarioKind.Add, answeredAdds, batchSize: 1 })).toEqual({
      scenario: ScenarioKind.Add,
      taskNumbers: [],
    });
    expect(answeredAdds).toEqual([11]);
  });
});
