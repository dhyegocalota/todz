import { MILLISECONDS_PER_MINUTE } from '@todz/types';
import { appChecks } from './app-command';
import { type ParsedArguments, flagValueOf, numberFlagOf } from './arguments';
import { INITIALIZE_SAMPLE_COUNT, PERCENTILE_SLOWEST, STRESS_STEP_MS, TARGET_DURATION_MS, TARGET_RATE_PER_SECOND } from './budgets';
import type { CliDependencies } from './cli';
import { type LocalRunDependencies, runLocalLoad } from './local-run';
import { measureInitialize } from './mcp-scenario';
import { percentileOf } from './percentiles';
import { cleanupProduction, runProduction } from './production-run';
import { Verdict, isFailure, reportRows, rowText, REPORT_HEADER } from './report';
import { ORIGIN_OF_TARGET, PerfTarget, RunKind, type RunPlan, perfTargetOf } from './run-plan';
import { ScenarioKind } from './scenario-kind';
import { seedFixture } from './seed';
import { runSoak, soakAccess } from './soak';
import { isStressPassing, runStress } from './stress';
import { tailSummaryOf } from './tail-log';
import type { Sample } from './timed-fetch';
import { UsageError } from './usage-error';

export enum CliCommand {
  Load = 'load',
  Stress = 'stress',
  Seed = 'seed',
  Soak = 'soak',
  Production = 'production',
  App = 'app',
  Tail = 'tail',
}

export enum ExitCode {
  Passed = 0,
  Failed = 1,
  Usage = 2,
}

type Handler = (parsed: ParsedArguments) => Promise<ExitCode>;

const SEED_IDENTITY = 'todz-perf-seed';
const HOT_PROJECT_TASK_COUNT = 5_000;
const OWNER_PROJECT_COUNT = 200;
const TARGET_FLAG = 'target';
const PORT_FLAG = 'port';
const PORT_MAX = 65_535;
const CLEANUP_FLAG = 'cleanup';
const SENDS_FLAG = 'sends';

function exitCodeOf(isPassing: boolean): ExitCode {
  if (isPassing) return ExitCode.Passed;
  return ExitCode.Failed;
}

function localPortOrigin(parsed: ParsedArguments): string {
  const localOrigin = ORIGIN_OF_TARGET[PerfTarget.Local];
  if (flagValueOf({ parsed, name: PORT_FLAG }) === null) return localOrigin;
  const port = numberFlagOf({ parsed, name: PORT_FLAG });
  if (!Number.isInteger(port) || port > PORT_MAX) throw new UsageError(`--${PORT_FLAG} needs a port from 1 to ${PORT_MAX}`);
  const url = new URL(localOrigin);
  url.port = String(port);
  return url.origin;
}

function localOriginOf({ parsed, command }: { parsed: ParsedArguments; command: CliCommand }): string {
  const value = flagValueOf({ parsed, name: TARGET_FLAG });
  if (value !== null && perfTargetOf(value) === PerfTarget.Production) {
    throw new UsageError(`${command} runs on local only; the bounded production run is pnpm perf production`);
  }
  return localPortOrigin(parsed);
}

function localDependencies({ dependencies, origin }: { dependencies: CliDependencies; origin: string }): LocalRunDependencies {
  const { fetch, now, clock, schedule, openSignals } = dependencies;
  return { origin, fetch, now, clock, schedule, openSignals };
}

function localPlan({ ratePerSecond, durationMs, kind }: { ratePerSecond: number; durationMs: number; kind: RunKind }): RunPlan {
  return { target: PerfTarget.Local, kind, ratePerSecond, durationMs, scenarios: Object.values(ScenarioKind) };
}

async function seeded({ dependencies, origin, identity }: { dependencies: CliDependencies; origin: string; identity: string }) {
  const fixture = await seedFixture({
    origin,
    fetch: dependencies.fetch,
    identity,
    taskCount: HOT_PROJECT_TASK_COUNT,
    projectCount: OWNER_PROJECT_COUNT,
  });
  dependencies.out(
    `seeded: ${HOT_PROJECT_TASK_COUNT} tasks in the hot project (${fixture.doneTasks} done), ${fixture.projectIds.length} projects\n`,
  );
  return fixture;
}

function loadHandler(dependencies: CliDependencies): Handler {
  return async (parsed) => {
    const origin = localOriginOf({ parsed, command: CliCommand.Load });
    const fixture = await seeded({ dependencies, origin, identity: `todz-perf-load-${dependencies.randomIdentifier()}` });
    const initializeSamples: Sample[] = [];
    await measureInitialize({
      origin,
      key: fixture.hotKey,
      fetch: dependencies.fetch,
      now: dependencies.now,
      record: (sample) => initializeSamples.push(sample),
      count: INITIALIZE_SAMPLE_COUNT,
    });
    const plan = localPlan({ ratePerSecond: TARGET_RATE_PER_SECOND, durationMs: TARGET_DURATION_MS, kind: RunKind.Load });
    const result = await runLocalLoad({ plan, fixture, dependencies: localDependencies({ dependencies, origin }) });
    const rows = reportRows({ samples: [...initializeSamples, ...result.samples], durationMs: result.durationMs });
    dependencies.out(
      [REPORT_HEADER, ...rows.map(rowText), `done tasks at the start: ${fixture.doneTasks}`, `failed requests: ${result.failures}`].join(
        '\n',
      ) + '\n',
    );
    return exitCodeOf(rows.every((row) => row.verdict === Verdict.Pass) && result.failures === 0);
  };
}

function stepLine({ ratePerSecond, samples }: { ratePerSecond: number; samples: Sample[] }): string {
  const percentile99 = percentileOf({ samples: samples.map((sample) => sample.durationMs), percentile: PERCENTILE_SLOWEST });
  return `step ${ratePerSecond} a second: ${samples.length} requests, p99 ${Math.round(percentile99)} ms, ${samples.filter(isFailure).length} failed`;
}

function stressHandler(dependencies: CliDependencies): Handler {
  return async (parsed) => {
    const origin = localOriginOf({ parsed, command: CliCommand.Stress });
    const fixture = await seeded({ dependencies, origin, identity: `todz-perf-stress-${dependencies.randomIdentifier()}` });
    const outcome = await runStress({
      runStep: async (ratePerSecond) => {
        const plan = localPlan({ ratePerSecond, durationMs: STRESS_STEP_MS, kind: RunKind.Stress });
        const { samples } = await runLocalLoad({ plan, fixture, dependencies: localDependencies({ dependencies, origin }) });
        dependencies.out(`${stepLine({ ratePerSecond, samples })}\n`);
        return samples;
      },
    });
    dependencies.out(`held: ${outcome.held} a second; broke: ${outcome.broke}; reached the ceiling: ${outcome.reachedCeiling}\n`);
    return exitCodeOf(isStressPassing(outcome));
  };
}

function seedHandler(dependencies: CliDependencies): Handler {
  return async (parsed) => {
    const taskCount = numberFlagOf({ parsed, name: 'tasks' });
    const projectCount = numberFlagOf({ parsed, name: 'projects' });
    const origin = localOriginOf({ parsed, command: CliCommand.Seed });
    const fixture = await seedFixture({ origin, fetch: dependencies.fetch, identity: SEED_IDENTITY, taskCount, projectCount });
    dependencies.out(
      [
        `identity: ${SEED_IDENTITY}`,
        `hot project: ${fixture.hotProjectId}`,
        `done tasks: ${fixture.doneTasks}`,
        `projects: ${fixture.projectIds.length}`,
      ].join('\n') + '\n',
    );
    return ExitCode.Passed;
  };
}

function soakHandler(dependencies: CliDependencies): Handler {
  return async (parsed) => {
    const minutes = numberFlagOf({ parsed, name: 'minutes' });
    const origin = localOriginOf({ parsed, command: CliCommand.Soak });
    const access = await soakAccess({ origin, fetch: dependencies.fetch, identity: SEED_IDENTITY });
    const result = await runSoak({
      access,
      durationMs: minutes * MILLISECONDS_PER_MINUTE,
      dependencies: localDependencies({ dependencies, origin }),
    });
    dependencies.out(`soak: ${result.updates} updates, ${result.lists} lists, ${result.failures} failed\n`);
    return exitCodeOf(result.failures === 0);
  };
}

function productionHandler(dependencies: CliDependencies): Handler {
  return async (parsed) => {
    const cleanupRun = flagValueOf({ parsed, name: CLEANUP_FLAG });
    const productionDependencies = {
      execFile: dependencies.execFile,
      fetch: dependencies.fetch,
      now: dependencies.now,
      epochNow: dependencies.epochNow,
      clock: dependencies.clock,
      schedule: dependencies.schedule,
      writeSend: (line: string) => dependencies.out(`${line}\n`),
    };
    async function cleanedUp(runIdentifier: string): Promise<number | null> {
      const { openTasksLeft } = await cleanupProduction({
        ...productionDependencies,
        interruption: new AbortController().signal,
        runIdentifier,
      });
      dependencies.err(`open tasks left: ${openTasksLeft}\n`);
      return openTasksLeft;
    }
    if (cleanupRun !== null) return exitCodeOf((await cleanedUp(cleanupRun)) === 0);
    const runIdentifier = dependencies.randomIdentifier();
    const interruption = new AbortController();
    dependencies.onInterrupt(async () => {
      interruption.abort();
      await cleanedUp(runIdentifier);
      return ExitCode.Failed;
    });
    dependencies.err(`run: ${runIdentifier}\n`);
    const result = await runProduction({ ...productionDependencies, interruption: interruption.signal, runIdentifier });
    const rows = reportRows({ samples: result.samples, durationMs: result.durationMs });
    dependencies.err(
      [
        REPORT_HEADER,
        ...rows.map(rowText),
        `dropped: ${result.dropped}`,
        `failed requests: ${result.failures}`,
        `open tasks left: ${result.openTasksLeft}`,
      ].join('\n') + '\n',
    );
    return exitCodeOf(rows.every((row) => row.verdict === Verdict.Pass) && result.openTasksLeft === 0);
  };
}

function appHandler(dependencies: CliDependencies): Handler {
  return async (parsed) => {
    const checks = await appChecks({
      execFile: dependencies.execFile,
      readSends: dependencies.readFile,
      sendsPath: flagValueOf({ parsed, name: SENDS_FLAG }),
    });
    dependencies.out(checks.map((check) => `${check.name}: ${check.summary} ${check.verdict}`).join('\n') + '\n');
    return exitCodeOf(checks.every((check) => check.verdict !== Verdict.Fail));
  };
}

function tailHandler(dependencies: CliDependencies): Handler {
  return async (parsed) => {
    const [path] = parsed.positionals;
    if (path === undefined) throw new UsageError('tail needs the saved wrangler tail file');
    const summary = tailSummaryOf(await dependencies.readFile(path));
    const outcomeLines = Object.entries(summary.outcomes).map(([outcome, count]) => `${outcome}: ${count}`);
    dependencies.out(
      [`events: ${summary.events}`, ...outcomeLines, `cpuTime p50 ${summary.cpuTimeMedianMs} ms, p99 ${summary.cpuTimeSlowestMs} ms`].join(
        '\n',
      ) + '\n',
    );
    return ExitCode.Passed;
  };
}

export function commandsOf(dependencies: CliDependencies): Record<CliCommand, Handler> {
  return {
    [CliCommand.Load]: loadHandler(dependencies),
    [CliCommand.Stress]: stressHandler(dependencies),
    [CliCommand.Seed]: seedHandler(dependencies),
    [CliCommand.Soak]: soakHandler(dependencies),
    [CliCommand.Production]: productionHandler(dependencies),
    [CliCommand.App]: appHandler(dependencies),
    [CliCommand.Tail]: tailHandler(dependencies),
  };
}
