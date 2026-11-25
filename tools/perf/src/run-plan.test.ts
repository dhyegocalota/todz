import { describe, expect, test } from 'vitest';
import { PRODUCTION_ADD_CUTOFF_MS } from './budgets';
import { ORIGIN_OF_TARGET, PerfTarget, RunKind, type RunPlan, perfTargetOf, scenarioAt, validatedPlan } from './run-plan';
import { ScenarioKind } from './scenario-kind';

const MCP_SCENARIOS = [ScenarioKind.List, ScenarioKind.Add, ScenarioKind.Done];

function productionPlan(overrides: Partial<RunPlan> = {}): RunPlan {
  return {
    target: PerfTarget.Production,
    kind: RunKind.Load,
    ratePerSecond: 50,
    durationMs: 120_000,
    scenarios: MCP_SCENARIOS,
    ...overrides,
  };
}

describe('perfTargetOf', () => {
  test('the two targets parse to their fixed origins', () => {
    expect(ORIGIN_OF_TARGET[perfTargetOf('local')]).toBe('http://localhost:8787');
    expect(ORIGIN_OF_TARGET[perfTargetOf('production')]).toBe('https://api.todz.app');
  });

  test('no other value parses', () => {
    expect(() => perfTargetOf('https://staging.example.com')).toThrow('unknown target https://staging.example.com');
    expect(() => perfTargetOf('')).toThrow('unknown target ');
  });
});

describe('validatedPlan on production', () => {
  test('fifty a second for a hundred and twenty seconds of MCP is accepted', () => {
    expect(validatedPlan(productionPlan())).toEqual(productionPlan());
  });

  test('fifty-one a second throws', () => {
    expect(() => validatedPlan(productionPlan({ ratePerSecond: 51 }))).toThrow('production is capped at 50 requests a second');
  });

  test('a hundred and twenty seconds and a millisecond throws', () => {
    expect(() => validatedPlan(productionPlan({ durationMs: 120_001 }))).toThrow('production is capped at 120 seconds');
  });

  test('an owner scenario throws', () => {
    expect(() => validatedPlan(productionPlan({ scenarios: [...MCP_SCENARIOS, ScenarioKind.Owner] }))).toThrow('production runs MCP only');
  });

  test('the change feed scenario throws', () => {
    expect(() => validatedPlan(productionPlan({ scenarios: [...MCP_SCENARIOS, ScenarioKind.ChangeFeed] }))).toThrow(
      'production runs MCP only',
    );
  });

  test('stress throws', () => {
    expect(() => validatedPlan(productionPlan({ kind: RunKind.Stress }))).toThrow('stress runs on local only');
  });
});

describe('validatedPlan on local', () => {
  test('a thousand a second for six hundred seconds is accepted', () => {
    const plan = productionPlan({
      target: PerfTarget.Local,
      ratePerSecond: 1_000,
      durationMs: 600_000,
      scenarios: Object.values(ScenarioKind),
    });
    expect(validatedPlan(plan)).toEqual(plan);
  });
});

describe('scenarioAt', () => {
  const plan = productionPlan();
  const slotsOfRun = Array.from({ length: 6_000 }, (_, index) => ({ index, offsetMs: index * 20 }));

  test('before the cutoff the owner share of production becomes list and the rest of the mix holds', () => {
    const scenarios = slotsOfRun.filter(({ offsetMs }) => offsetMs < PRODUCTION_ADD_CUTOFF_MS).map((slot) => scenarioAt({ plan, ...slot }));
    expect(scenarios).not.toContain(ScenarioKind.Owner);
    expect(scenarios.filter((scenario) => scenario === ScenarioKind.List)).toHaveLength(3_000);
    expect(scenarios.filter((scenario) => scenario === ScenarioKind.Add)).toHaveLength(1_000);
    expect(scenarios.filter((scenario) => scenario === ScenarioKind.Done)).toHaveLength(1_000);
  });

  test('from the cutoff to the end only done is scheduled, and no add at or after it', () => {
    const scenarios = slotsOfRun
      .filter(({ offsetMs }) => offsetMs >= PRODUCTION_ADD_CUTOFF_MS)
      .map((slot) => scenarioAt({ plan, ...slot }));
    expect(scenarios).toHaveLength(1_000);
    expect(new Set(scenarios)).toEqual(new Set([ScenarioKind.Done]));
  });

  test('a local plan keeps the owner share and never stops adding', () => {
    const local = productionPlan({ target: PerfTarget.Local });
    expect(scenarioAt({ plan: local, index: 4, offsetMs: 110_000 })).toBe(ScenarioKind.Owner);
    expect(scenarioAt({ plan: local, index: 1, offsetMs: 110_000 })).toBe(ScenarioKind.Add);
  });
});
