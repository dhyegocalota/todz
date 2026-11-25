import type { Client } from '@modelcontextprotocol/client';
import { LIST_LIMIT_MAX, MILLISECONDS_PER_SECOND, TASK_BATCH_MAX_SIZE } from '@todz/types';
import {
  CLEANUP_DURATION_MAX_MS,
  CLEANUP_RATE_MAX,
  CLEANUP_REQUEST_MAX,
  PRODUCTION_ADD_CUTOFF_MS,
  PRODUCTION_DURATION_MAX_MS,
  PRODUCTION_FAILURES_CONSECUTIVE_MAX,
  PRODUCTION_FINAL_LIST_RESERVE_MS,
  PRODUCTION_FOREIGN_OPEN_TASKS_MAX,
  PRODUCTION_IN_FLIGHT_MAX,
  PRODUCTION_RATE_MAX,
  PRODUCTION_REQUEST_MAX,
} from './budgets';
import { type ExecFile, readKeychainKey } from './keychain-key';
import { McpEra, addTask, completeTasks, connectMeasuredMcp, listTasks } from './mcp-scenario';
import { type LoopClock, type LoopSlot, runOpenLoop } from './open-loop';
import { ORIGIN_OF_TARGET, PerfTarget, RunKind, type RunPlan, scenarioAt, validatedPlan } from './run-plan';
import { ScenarioKind } from './scenario-kind';
import { plannedStarts, resolvedSlot } from './schedule';
import { chunksOf, inSequence } from './sequence';
import type { Sample } from './timed-fetch';
import { type Scheduler, guardedFetch } from './wire-guard';

export type ProductionDependencies = {
  execFile: ExecFile;
  fetch: typeof fetch;
  now: () => number;
  epochNow: () => number;
  clock: LoopClock;
  schedule: Scheduler;
  interruption: AbortSignal;
  runIdentifier: string;
  writeSend: (line: string) => void;
};

export type ProductionResult = {
  runIdentifier: string;
  samples: Sample[];
  durationMs: number;
  dropped: number;
  failures: number;
  openTasksLeft: number | null;
};

export type CleanupResult = { samples: Sample[]; openTasksLeft: number | null };

type Clients = { list: Client; add: Client; done: Client };

type Tracking = { answeredAdds: number[]; known: Set<number> };

type Session = {
  dependencies: ProductionDependencies;
  clients: Clients;
  tracking: Tracking;
  prefix: string;
};

type SlotContext = { session: Session; slot: LoopSlot; taskNumbers: number[] };

const TITLE_PREFIX = 'todz-perf';
const UNAUTHORIZED_STATUS = 401;
const PRODUCTION_PLAN: RunPlan = validatedPlan({
  target: PerfTarget.Production,
  kind: RunKind.Load,
  ratePerSecond: PRODUCTION_RATE_MAX,
  durationMs: PRODUCTION_DURATION_MAX_MS - PRODUCTION_FINAL_LIST_RESERVE_MS,
  scenarios: [ScenarioKind.List, ScenarioKind.Add, ScenarioKind.Done],
});

function prefixOf(runIdentifier: string): string {
  return `${TITLE_PREFIX} ${runIdentifier} #`;
}

async function connectedClients({
  dependencies,
  key,
  deadlineMs,
  requestMax,
  record,
}: {
  dependencies: Omit<ProductionDependencies, 'writeSend'>;
  key: string;
  deadlineMs: number;
  requestMax: number;
  record: (sample: Sample) => void;
}): Promise<Clients> {
  const fetch = guardedFetch({
    fetch: dependencies.fetch,
    deadlineMs,
    schedule: dependencies.schedule,
    requestMax,
    interruption: dependencies.interruption,
  });
  const connect = (scenario: ScenarioKind) =>
    connectMeasuredMcp({
      origin: ORIGIN_OF_TARGET[PerfTarget.Production],
      key,
      era: McpEra.Modern,
      fetch,
      now: dependencies.now,
      scenario,
      record,
    });
  const list = await connect(ScenarioKind.List);
  const add = await connect(ScenarioKind.Add);
  const done = await connect(ScenarioKind.Done);
  return { list, add, done };
}

async function filteredListing({ session }: { session: Session }) {
  const { clients, tracking, prefix } = session;
  const answer = await listTasks({ client: clients.list, text: prefix, limit: LIST_LIMIT_MAX });
  const orphans = ownTaskNumbers({ tasks: answer.tasks, prefix }).filter((number) => !tracking.known.has(number));
  orphans.forEach((number) => tracking.known.add(number));
  tracking.answeredAdds.push(...orphans);
  return answer;
}

function ownTaskNumbers({ tasks, prefix }: { tasks: { number: number; title: string }[]; prefix: string }): number[] {
  return tasks.filter((task) => task.title.startsWith(prefix)).map((task) => task.number);
}

async function listSlot({ session, slot }: SlotContext): Promise<void> {
  const isTail = slot.offsetMs >= PRODUCTION_ADD_CUTOFF_MS;
  if (isTail) {
    await filteredListing({ session });
    return;
  }
  await listTasks({ client: session.clients.list });
}

async function addSlot({ session, slot }: SlotContext): Promise<void> {
  const { dependencies, clients, tracking, prefix } = session;
  const sentAtMs = dependencies.epochNow();
  const number = await addTask({
    client: clients.add,
    title: `${prefix}${slot.index}`,
    idempotencyKey: `${TITLE_PREFIX}-${dependencies.runIdentifier}-${slot.index}`,
  });
  tracking.known.add(number);
  tracking.answeredAdds.push(number);
  dependencies.writeSend(JSON.stringify({ number, sentAtMs }));
}

async function doneSlot({ session, taskNumbers }: SlotContext): Promise<void> {
  try {
    await completeTasks({ client: session.clients.done, numbers: taskNumbers });
  } catch (failure) {
    taskNumbers.forEach((number) => session.tracking.known.delete(number));
    throw failure;
  }
}

const EXECUTOR_OF_SCENARIO: Partial<Record<ScenarioKind, (context: SlotContext) => Promise<void>>> = {
  [ScenarioKind.List]: listSlot,
  [ScenarioKind.Add]: addSlot,
  [ScenarioKind.Done]: doneSlot,
};

async function executeSlot({ session, slot }: { session: Session; slot: LoopSlot }): Promise<void> {
  const planned = scenarioAt({ plan: PRODUCTION_PLAN, ...slot });
  const batchSize = slot.offsetMs >= PRODUCTION_ADD_CUTOFF_MS ? TASK_BATCH_MAX_SIZE : 1;
  const resolved = resolvedSlot({ scenario: planned, answeredAdds: session.tracking.answeredAdds, batchSize });
  const execute = EXECUTOR_OF_SCENARIO[resolved.scenario];
  if (execute === undefined) throw new Error(`production has no executor for ${resolved.scenario}`);
  await execute({ session, slot, taskNumbers: resolved.taskNumbers });
}

function openCountOf({ session }: { session: Session }): Promise<number | null> {
  return listTasks({ client: session.clients.list, text: session.prefix, limit: 1 })
    .then((answer) => answer.totalMatched)
    .catch(() => null);
}

async function refuseForeignProject({ client }: { client: Client }): Promise<void> {
  const everything = await listTasks({ client, limit: 1 });
  const ours = await listTasks({ client, text: TITLE_PREFIX, limit: 1 });
  const foreignCount = everything.totalMatched - ours.totalMatched;
  if (foreignCount > PRODUCTION_FOREIGN_OPEN_TASKS_MAX) {
    throw new Error(`the project holds ${foreignCount} open tasks that are not ${TITLE_PREFIX} tasks`);
  }
}

export async function runProduction(dependencies: ProductionDependencies): Promise<ProductionResult> {
  const key = await readKeychainKey({ execFile: dependencies.execFile });
  const samples: Sample[] = [];
  const stop = new AbortController();
  const clients = await connectedClients({
    dependencies: { ...dependencies, interruption: AbortSignal.any([dependencies.interruption, stop.signal]) },
    key,
    deadlineMs: PRODUCTION_DURATION_MAX_MS,
    requestMax: PRODUCTION_REQUEST_MAX,
    record: (sample) => {
      samples.push(sample);
      if (sample.status === UNAUTHORIZED_STATUS) stop.abort();
    },
  });
  await refuseForeignProject({ client: clients.list });
  const streak = { failures: 0 };
  const session = {
    dependencies,
    clients,
    tracking: { answeredAdds: [], known: new Set<number>() },
    prefix: prefixOf(dependencies.runIdentifier),
  };
  const counters = { dropped: 0, failures: 0 };
  await runOpenLoop({
    starts: plannedStarts({ ratePerSecond: PRODUCTION_PLAN.ratePerSecond, durationMs: PRODUCTION_PLAN.durationMs }),
    clock: dependencies.clock,
    execute: async (slot) => {
      try {
        await executeSlot({ session, slot });
        streak.failures = 0;
      } catch (failure) {
        streak.failures += 1;
        if (streak.failures >= PRODUCTION_FAILURES_CONSECUTIVE_MAX) stop.abort();
        throw failure;
      }
    },
    onDropped: () => (counters.dropped += 1),
    onFailure: () => (counters.failures += 1),
    inFlightMax: PRODUCTION_IN_FLIGHT_MAX,
  });
  return {
    runIdentifier: dependencies.runIdentifier,
    samples,
    durationMs: PRODUCTION_PLAN.durationMs,
    ...counters,
    openTasksLeft: await openCountOf({ session }),
  };
}

export async function cleanupProduction(dependencies: Omit<ProductionDependencies, 'writeSend'>): Promise<CleanupResult> {
  const key = await readKeychainKey({ execFile: dependencies.execFile });
  const samples: Sample[] = [];
  const clients = await connectedClients({
    dependencies,
    key,
    deadlineMs: CLEANUP_DURATION_MAX_MS,
    requestMax: CLEANUP_REQUEST_MAX,
    record: (sample) => samples.push(sample),
  });
  const prefix = prefixOf(dependencies.runIdentifier);
  const pacing = { startedAt: dependencies.clock.now(), requests: 0 };
  const pace = () => dependencies.clock.waitUntil(pacing.startedAt + (pacing.requests++ * MILLISECONDS_PER_SECOND) / CLEANUP_RATE_MAX);

  async function sweep(): Promise<number> {
    await pace();
    const answer = await listTasks({ client: clients.list, text: prefix, limit: LIST_LIMIT_MAX });
    const numbers = ownTaskNumbers({ tasks: answer.tasks, prefix });
    if (numbers.length === 0) return answer.totalMatched;
    await inSequence({
      items: chunksOf({ items: numbers, size: TASK_BATCH_MAX_SIZE }),
      step: async (batch) => {
        await pace();
        await completeTasks({ client: clients.done, numbers: batch });
      },
    });
    return sweep();
  }

  return { samples, openTasksLeft: await sweep().catch(() => null) };
}
