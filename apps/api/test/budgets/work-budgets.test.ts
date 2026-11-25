import { TaskPlacement } from '@todz/types';
import { env } from 'cloudflare:workers';
import { describe, expect, test } from 'vitest';
import { z } from 'zod';
import { HttpStatus } from '../../src/http-status';
import { McpToolName } from '../../src/mcp-copy';
import { serveMcp } from '../../src/mcp-endpoint';
import { parsedJson } from '../../src/parsed-json';
import type { ProjectStore } from '../../src/project-store';
import { type WorkCounts, countedWorkEnv, rowsReadBy, seedLargeProject, seedProjectsOf } from '../budget-counters';
import { seedNudgedKey } from '../directory-seed';
import { ClientEra, callTool, connectClient } from '../mcp-client';
import { createOwnedProject, serveOwnerCall, signInOwner } from '../owner-client';
import { AGENT_ACTOR, TODAY, draftOf, newProjectStub, openTasksFilter, unwrap } from '../task-fixtures';
import {
  MCP_LIST_BUDGET_OF_ERA,
  MCP_NEXT_NUDGED_BUDGET_OF_ERA,
  OWNER_PROJECT_ROUTE_BUDGET,
  OWNER_WORKSPACE_LIST_BUDGET,
  ROWS_READ_BUDGET,
  RowsReadUseCase,
  type WorkBudget,
} from './budget-limits';

const TOOLS_CALL_METHOD = 'tools/call';
const EXPECTED_PROJECT_COUNT = 200;
const MIDDLE_TASK = 2_500;
const ANCHOR_TASK = 3_000;

const RpcMessageSchema = z.object({ method: z.string() });

type ServedRequest = { method: string; counts: WorkCounts };

const USE_CASE_OF_ROWS_READ: Record<RowsReadUseCase, (instance: ProjectStore) => unknown> = {
  [RowsReadUseCase.Add]: (instance) => instance.addTasks({ actor: AGENT_ACTOR, drafts: [draftOf('One more')] }),
  [RowsReadUseCase.UpdateFirst]: (instance) =>
    instance.updateTask({ actor: AGENT_ACTOR, number: MIDDLE_TASK, patch: { placement: { kind: TaskPlacement.First } } }),
  [RowsReadUseCase.UpdateLast]: (instance) =>
    instance.updateTask({ actor: AGENT_ACTOR, number: MIDDLE_TASK, patch: { placement: { kind: TaskPlacement.Last } } }),
  [RowsReadUseCase.UpdateBefore]: (instance) =>
    instance.updateTask({
      actor: AGENT_ACTOR,
      number: MIDDLE_TASK,
      patch: { placement: { kind: TaskPlacement.Before, anchor: ANCHOR_TASK } },
    }),
  [RowsReadUseCase.UpdateAfter]: (instance) =>
    instance.updateTask({
      actor: AGENT_ACTOR,
      number: MIDDLE_TASK,
      patch: { placement: { kind: TaskPlacement.After, anchor: ANCHOR_TASK } },
    }),
  [RowsReadUseCase.ListOpen]: (instance) => instance.listTasks({ today: TODAY, filter: openTasksFilter() }),
  [RowsReadUseCase.Next]: (instance) => instance.nextTask({ today: TODAY }),
  [RowsReadUseCase.DueNow]: (instance) => instance.dueNow({ today: TODAY }),
  [RowsReadUseCase.ReadChanges]: (instance) => instance.readChanges({ cursor: 0 }),
  [RowsReadUseCase.ReadHistory]: (instance) => instance.readHistory({ number: MIDDLE_TASK }),
};

function expectWithin({ counts, budget }: { counts: WorkCounts; budget: WorkBudget }): void {
  expect(counts.roundTrips).toBeLessThanOrEqual(budget.roundTrips);
  expect(counts.statements).toBeLessThanOrEqual(budget.statements);
  expect(counts.projectCalls).toBeLessThanOrEqual(budget.projectCalls);
}

function methodOf({ request, text }: { request: Request; text: string }): string {
  const message = RpcMessageSchema.safeParse(parsedJson(text));
  if (!message.success) return request.method;
  return message.data.method;
}

function countingServe(served: ServedRequest[]): (request: Request) => Promise<Response> {
  return async (request) => {
    const { countedEnv, counts } = countedWorkEnv();
    served.push({ method: methodOf({ request, text: await request.clone().text() }), counts });
    return serveMcp({ request, env: countedEnv, now: Date.now() });
  };
}

function toolCallCounts(served: ServedRequest[]): WorkCounts {
  const toolCalls = served.filter(({ method }) => method === TOOLS_CALL_METHOD);
  const [only, ...others] = toolCalls;
  if (only === undefined || others.length > 0) throw new Error(`expected one tools/call, served ${toolCalls.length}`);
  return only.counts;
}

async function countedToolCall({
  era,
  projectId,
  key,
  name,
}: {
  era: ClientEra;
  projectId: string;
  key: string;
  name: McpToolName;
}): Promise<WorkCounts> {
  unwrap(
    await env.PROJECT_STORE.get(env.PROJECT_STORE.idFromName(projectId)).addTasks({ actor: AGENT_ACTOR, drafts: [draftOf('Open task')] }),
  );
  const served: ServedRequest[] = [];
  const client = await connectClient({ era, key, serve: countingServe(served) });
  await callTool({ client, name, args: {} });
  return toolCallCounts(served);
}

async function seededLargeProject(): Promise<DurableObjectStub<ProjectStore>> {
  const stub = newProjectStub();
  await seedLargeProject(stub);
  return stub;
}

describe('the directory and Durable Object work of a request', () => {
  test('an owner project route', async () => {
    const project = await createOwnedProject();
    const { countedEnv, counts } = countedWorkEnv();
    const call = { method: 'GET', path: `/owner/projects/${project.projectId}/changes?cursor=0`, token: project.token };
    const response = await serveOwnerCall({ call, now: Date.now(), workerEnv: countedEnv });
    expect(response.status).toBe(HttpStatus.Ok);
    expectWithin({ counts, budget: OWNER_PROJECT_ROUTE_BUDGET });
  });

  test('the workspace list of an owner with 200 projects in 20 workspaces', async () => {
    const { token, ownerId } = await signInOwner();
    await seedProjectsOf({ ownerId });
    const { countedEnv, counts } = countedWorkEnv();
    const call = { method: 'GET', path: '/owner/workspaces', token };
    const response = await serveOwnerCall({ call, now: Date.now(), workerEnv: countedEnv });
    const { workspaces } = await response.json<{ workspaces: { projects: unknown[] }[] }>();
    expect(workspaces.flatMap(({ projects }) => projects)).toHaveLength(EXPECTED_PROJECT_COUNT);
    expectWithin({ counts, budget: OWNER_WORKSPACE_LIST_BUDGET });
  });

  describe.each([ClientEra.Legacy, ClientEra.Modern])('the %s MCP client', (era) => {
    test('a list tools/call', async () => {
      const { key, projectId } = await seedNudgedKey();
      const counts = await countedToolCall({ era, projectId, key, name: McpToolName.List });
      expectWithin({ counts, budget: MCP_LIST_BUDGET_OF_ERA[era] });
    });

    test('a next tools/call with the nudge on', async () => {
      const { key, projectId } = await seedNudgedKey();
      const counts = await countedToolCall({ era, projectId, key, name: McpToolName.Next });
      expect(counts.projectCalls).toBeGreaterThan(1);
      expectWithin({ counts, budget: MCP_NEXT_NUDGED_BUDGET_OF_ERA[era] });
    });
  });
});

describe('the rows a use case reads on a project of 5,000 tasks', () => {
  test.each(Object.values(RowsReadUseCase))('%s', async (useCase) => {
    const rowsRead = await rowsReadBy({ stub: await seededLargeProject(), use: USE_CASE_OF_ROWS_READ[useCase] });
    expect(rowsRead).toBeLessThanOrEqual(ROWS_READ_BUDGET[useCase]);
  });
});
