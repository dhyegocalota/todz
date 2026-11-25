import type { Client } from '@modelcontextprotocol/client';
import { type ChangeFeed, type ChangeSignals, openChangeFeed } from './change-feed';
import { McpEra, addTask, completeTasks, connectMeasuredMcp, listTasks } from './mcp-scenario';
import { type LoopClock, type LoopSlot, runOpenLoop } from './open-loop';
import { type OwnerConnection, addOwnerTasks, completeOwnerTasks, listWorkspaces, readChanges } from './owner-scenario';
import { type RunPlan, scenarioAt, validatedPlan } from './run-plan';
import { ScenarioKind } from './scenario-kind';
import { plannedStarts, resolvedSlot } from './schedule';
import type { Fixture } from './seed';
import { type Sample, timedFetch } from './timed-fetch';
import type { Scheduler } from './wire-guard';

export type LocalRunDependencies = {
  origin: string;
  fetch: typeof fetch;
  now: () => number;
  clock: LoopClock;
  schedule: Scheduler;
  openSignals: (access: { origin: string; token: string; projectId: string }) => Promise<ChangeSignals>;
};

export type LocalRunResult = { samples: Sample[]; durationMs: number; failures: number };

type McpScenarioKind = ScenarioKind.List | ScenarioKind.Add | ScenarioKind.Done;

type EraClients = Record<McpEra, Record<McpScenarioKind, Client>>;

type OwnerAnswered = { projectId: string; number: number };

type Session = {
  fixture: Fixture;
  clients: EraClients;
  owners: Record<ScenarioKind.Owner | ScenarioKind.Workspaces, OwnerConnection>;
  feed: ChangeFeed;
  now: () => number;
  answeredAdds: number[];
  ownerAnswered: OwnerAnswered[];
};

type SlotContext = { session: Session; slot: LoopSlot; taskNumbers: number[] };

const ERA_BLOCK_SIZE = 10;
const OWNER_SLOT_SPAN = 5;
const OWNER_STEP_COUNT = 4;
const ERAS = [McpEra.Legacy, McpEra.Modern];

function eraAt(index: number): McpEra {
  const era = ERAS[Math.floor(index / ERA_BLOCK_SIZE) % ERAS.length];
  if (era === undefined) throw new Error(`no era for slot ${index}`);
  return era;
}

function clientFor({ session, slot, scenario }: { session: Session; slot: LoopSlot; scenario: McpScenarioKind }): Client {
  return session.clients[eraAt(slot.index)][scenario];
}

async function listSlot(context: SlotContext): Promise<void> {
  await listTasks({ client: clientFor({ session: context.session, slot: context.slot, scenario: ScenarioKind.List }) });
}

async function addSlot({ session, slot }: SlotContext): Promise<void> {
  const sentAtMs = session.now();
  const number = await addTask({
    client: clientFor({ session, slot, scenario: ScenarioKind.Add }),
    title: `todz-perf load #${slot.index}`,
    idempotencyKey: `todz-perf-load-${slot.index}`,
  });
  session.feed.markSent({ number, sentAtMs });
  session.answeredAdds.push(number);
}

async function doneSlot({ session, slot, taskNumbers }: SlotContext): Promise<void> {
  await completeTasks({ client: clientFor({ session, slot, scenario: ScenarioKind.Done }), numbers: taskNumbers });
}

function ownerProjectOf({ session, slot }: { session: Session; slot: LoopSlot }): string {
  const { projectIds } = session.fixture;
  const projectId = projectIds[Math.floor(slot.index / (OWNER_SLOT_SPAN * OWNER_STEP_COUNT)) % projectIds.length];
  if (projectId === undefined) throw new Error('the fixture has no project');
  return projectId;
}

async function ownerChangesSlot(context: SlotContext): Promise<void> {
  await readChanges({ connection: context.session.owners[ScenarioKind.Owner], projectId: ownerProjectOf(context), cursor: 0 });
}

async function ownerAddSlot(context: SlotContext): Promise<void> {
  const { session } = context;
  const projectId = ownerProjectOf(context);
  const [number] = await addOwnerTasks({
    connection: session.owners[ScenarioKind.Owner],
    projectId,
    titles: [`todz-perf owner #${context.slot.index}`],
  });
  if (number === undefined) throw new Error('the owner add answered no task');
  session.ownerAnswered.push({ projectId, number });
}

async function ownerCompleteSlot(context: SlotContext): Promise<void> {
  const answered = context.session.ownerAnswered.shift();
  if (answered === undefined) return ownerChangesSlot(context);
  await completeOwnerTasks({
    connection: context.session.owners[ScenarioKind.Owner],
    projectId: answered.projectId,
    numbers: [answered.number],
  });
}

async function workspacesSlot({ session }: SlotContext): Promise<void> {
  await listWorkspaces(session.owners[ScenarioKind.Workspaces]);
}

const OWNER_STEPS: ((context: SlotContext) => Promise<void>)[] = [workspacesSlot, ownerChangesSlot, ownerAddSlot, ownerCompleteSlot];

async function ownerSlot(context: SlotContext): Promise<void> {
  const step = OWNER_STEPS[Math.floor(context.slot.index / OWNER_SLOT_SPAN) % OWNER_STEP_COUNT];
  if (step === undefined) throw new Error('the owner scenario has no step');
  await step(context);
}

const EXECUTOR_OF_SCENARIO: Partial<Record<ScenarioKind, (context: SlotContext) => Promise<void>>> = {
  [ScenarioKind.List]: listSlot,
  [ScenarioKind.Add]: addSlot,
  [ScenarioKind.Done]: doneSlot,
  [ScenarioKind.Owner]: ownerSlot,
};

async function connectedClients({
  fixture,
  dependencies,
  record,
}: {
  fixture: Fixture;
  dependencies: LocalRunDependencies;
  record: (sample: Sample) => void;
}): Promise<EraClients> {
  const connect = (era: McpEra, scenario: McpScenarioKind) =>
    connectMeasuredMcp({
      origin: dependencies.origin,
      key: fixture.hotKey,
      era,
      fetch: dependencies.fetch,
      now: dependencies.now,
      scenario,
      record,
    });
  const clientsOf = async (era: McpEra) => ({
    [ScenarioKind.List]: await connect(era, ScenarioKind.List),
    [ScenarioKind.Add]: await connect(era, ScenarioKind.Add),
    [ScenarioKind.Done]: await connect(era, ScenarioKind.Done),
  });
  return { [McpEra.Legacy]: await clientsOf(McpEra.Legacy), [McpEra.Modern]: await clientsOf(McpEra.Modern) };
}

function timedOwner({
  fixture,
  dependencies,
  scenario,
  record,
}: {
  fixture: Fixture;
  dependencies: LocalRunDependencies;
  scenario: ScenarioKind;
  record: (sample: Sample) => void;
}): OwnerConnection {
  const fetch = timedFetch({ fetch: dependencies.fetch, now: dependencies.now, scenario, record });
  return { ...fixture.connection, fetch };
}

async function cursorAtEnd({
  connection,
  projectId,
  cursor,
}: {
  connection: OwnerConnection;
  projectId: string;
  cursor: number;
}): Promise<number> {
  const page = await readChanges({ connection, projectId, cursor });
  if (!page.hasMore) return page.cursor;
  return cursorAtEnd({ connection, projectId, cursor: page.cursor });
}

async function openedFeed({
  fixture,
  dependencies,
  record,
}: {
  fixture: Fixture;
  dependencies: LocalRunDependencies;
  record: (sample: Sample) => void;
}): Promise<ChangeFeed> {
  const { connection, hotProjectId } = fixture;
  const signals = await dependencies.openSignals({ origin: dependencies.origin, token: connection.token, projectId: hotProjectId });
  const cursor = await cursorAtEnd({ connection, projectId: hotProjectId, cursor: 0 });
  return openChangeFeed({
    signals,
    pull: (from) => readChanges({ connection, projectId: hotProjectId, cursor: from }),
    cursor,
    now: dependencies.now,
    record,
  });
}

export async function runLocalLoad({
  plan,
  fixture,
  dependencies,
}: {
  plan: RunPlan;
  fixture: Fixture;
  dependencies: LocalRunDependencies;
}): Promise<LocalRunResult> {
  const validated = validatedPlan(plan);
  const samples: Sample[] = [];
  const record = (sample: Sample) => samples.push(sample);
  const session: Session = {
    fixture,
    clients: await connectedClients({ fixture, dependencies, record }),
    owners: {
      [ScenarioKind.Owner]: timedOwner({ fixture, dependencies, scenario: ScenarioKind.Owner, record }),
      [ScenarioKind.Workspaces]: timedOwner({ fixture, dependencies, scenario: ScenarioKind.Workspaces, record }),
    },
    feed: await openedFeed({ fixture, dependencies, record }),
    now: dependencies.now,
    answeredAdds: [],
    ownerAnswered: [],
  };
  const counters = { failures: 0 };
  await runOpenLoop({
    starts: plannedStarts({ ratePerSecond: validated.ratePerSecond, durationMs: validated.durationMs }),
    clock: dependencies.clock,
    execute: async (slot) => {
      const resolved = resolvedSlot({
        scenario: scenarioAt({ plan: validated, ...slot }),
        answeredAdds: session.answeredAdds,
        batchSize: 1,
      });
      const execute = EXECUTOR_OF_SCENARIO[resolved.scenario];
      if (execute === undefined) throw new Error(`a local run has no executor for ${resolved.scenario}`);
      await execute({ session, slot, taskNumbers: resolved.taskNumbers });
    },
    onDropped: () => undefined,
    onFailure: () => (counters.failures += 1),
  });
  await session.feed.settled();
  session.feed.close();
  return { samples, durationMs: validated.durationMs, failures: counters.failures };
}
