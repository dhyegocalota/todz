import type { LocalRunDependencies } from './local-run';
import { McpEra, connectMeasuredMcp, listTasks, updateTask } from './mcp-scenario';
import { runOpenLoop } from './open-loop';
import { type OwnerConnection, issueKey, listWorkspaces, signInOwner } from './owner-scenario';
import { ScenarioKind } from './scenario-kind';
import { plannedStarts } from './schedule';
import { workspaceNameOf } from './seed';

export type SoakResult = { updates: number; lists: number; failures: number };

export type SoakAccess = { connection: OwnerConnection; hotProjectId: string };

const SOAK_TASK_COUNT = 50;
const SOAK_RATE_PER_SECOND = 2;
const SLOTS_PER_UPDATE = 2;
const SOAK_TITLE = 'todz-perf soak';
const HOT_WORKSPACE_INDEX = 0;

export async function soakAccess({
  origin,
  fetch,
  identity,
}: {
  origin: string;
  fetch: typeof globalThis.fetch;
  identity: string;
}): Promise<SoakAccess> {
  const connection = await signInOwner({ origin, fetch, identity });
  const hotWorkspace = (await listWorkspaces(connection)).find((workspace) => workspace.name === workspaceNameOf(HOT_WORKSPACE_INDEX));
  if (hotWorkspace === undefined) throw new Error('the owner has no seeded workspace; run pnpm perf seed first');
  const [hotProjectId] = hotWorkspace.projectIds;
  if (hotProjectId === undefined) throw new Error('the seeded workspace has no Inbox');
  return { connection, hotProjectId };
}

export async function runSoak({
  access,
  durationMs,
  dependencies,
}: {
  access: SoakAccess;
  durationMs: number;
  dependencies: LocalRunDependencies;
}): Promise<SoakResult> {
  const key = await issueKey({ connection: access.connection, projectId: access.hotProjectId });
  const client = await connectMeasuredMcp({
    origin: dependencies.origin,
    key,
    era: McpEra.Modern,
    fetch: dependencies.fetch,
    now: dependencies.now,
    scenario: ScenarioKind.List,
    record: () => undefined,
  });
  const numbers = (await listTasks({ client, limit: SOAK_TASK_COUNT })).tasks.map((task) => task.number);
  if (numbers.length === 0) throw new Error('the hot project has no open task to soak');
  const counts = { updates: 0, lists: 0, failures: 0 };
  await runOpenLoop({
    starts: plannedStarts({ ratePerSecond: SOAK_RATE_PER_SECOND, durationMs }),
    clock: dependencies.clock,
    execute: async ({ index }) => {
      const isUpdate = index % SLOTS_PER_UPDATE === 0;
      if (!isUpdate) {
        await listTasks({ client });
        counts.lists += 1;
        return;
      }
      const number = numbers[(index / SLOTS_PER_UPDATE) % numbers.length];
      if (number === undefined) throw new Error('the soak has no task to update');
      await updateTask({ client, number, title: SOAK_TITLE });
      counts.updates += 1;
    },
    onDropped: () => undefined,
    onFailure: () => (counts.failures += 1),
  });
  return counts;
}
