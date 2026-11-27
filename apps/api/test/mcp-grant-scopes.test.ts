import type { Client } from '@modelcontextprotocol/client';
import { OWNER_WRITES_PER_DAY_MAX } from '@todz/types';
import { env, exports } from 'cloudflare:workers';
import { describe, expect, test } from 'vitest';
import { MCP_COPY, McpOwnerToolName, McpToolName } from '../src/mcp-copy';
import { GrantScopeKind, type SelectionScope } from '../src/oauth/oauth-grant-scope';
import { utcDayOf } from '../src/telemetry/telemetry-day';
import { seedOwner, seedProject, seedProjectToken, seedSelectionToken, seedSiblingProject } from './directory-seed';
import { ClientEra, callTool, connectClient } from './mcp-client';

const WORKER_ORIGIN = 'http://localhost:8787';
const PROJECT_ARGUMENT = 'project';
const FORBIDDEN_STATUS = 403;
const TOOLS_WITHOUT_SELECTION: string[] = [McpToolName.Projects];
const TASK_TOOLS_OF_SELECTION = Object.values(McpToolName).filter((name) => !TOOLS_WITHOUT_SELECTION.includes(name));
const OWNER_TOOLS = Object.values(McpOwnerToolName).filter((name) => name !== McpOwnerToolName.Workspaces);

const TASK_CALLS: [McpToolName, Record<string, unknown>][] = [
  [McpToolName.List, {}],
  [McpToolName.Next, {}],
  [McpToolName.Show, { id: 'T-1' }],
  [McpToolName.History, { id: 'T-1' }],
  [McpToolName.Add, { tasks: [{ title: 'Planted' }] }],
  [McpToolName.Update, { id: 'T-1', title: 'Planted' }],
  [McpToolName.Done, { ids: ['T-1'] }],
  [McpToolName.Reopen, { ids: ['T-1'] }],
  [McpToolName.Delete, { id: 'T-1', confirm: 'Private' }],
  [McpToolName.Move, { id: 'T-1', destination: 'unused' }],
];

const OUTSIDE_THE_SET = { text: MCP_COPY.accountNotFound, isError: true };

type Fixture = {
  ownerId: string;
  firstProjectId: string;
  secondProjectId: string;
  thirdProjectId: string;
  fourthProjectId: string;
  firstWorkspaceId: string;
  thirdWorkspaceId: string;
  fourthWorkspaceId: string;
};

async function workspaceOf(projectId: string): Promise<string> {
  const row = await env.DIRECTORY.prepare('SELECT workspace_id FROM projects WHERE id = ?')
    .bind(projectId)
    .first<{ workspace_id: string }>();
  return row!.workspace_id;
}

async function fixture(): Promise<Fixture> {
  const ownerId = await seedOwner();
  const firstProjectId = await seedProject({ ownerId });
  const secondProjectId = await seedSiblingProject({ projectId: firstProjectId, name: 'Second' });
  const thirdProjectId = await seedProject({ ownerId });
  const fourthProjectId = await seedProject({ ownerId });
  return {
    ownerId,
    firstProjectId,
    secondProjectId,
    thirdProjectId,
    fourthProjectId,
    firstWorkspaceId: await workspaceOf(firstProjectId),
    thirdWorkspaceId: await workspaceOf(thirdProjectId),
    fourthWorkspaceId: await workspaceOf(fourthProjectId),
  };
}

async function connectedSelection({ ownerId, scopes }: { ownerId: string; scopes: SelectionScope[] }): Promise<Client> {
  const token = await seedSelectionToken({ ownerId, scopes });
  return connectClient({ era: ClientEra.Modern, token });
}

function projectScope(projectId: string): SelectionScope {
  return { kind: GrantScopeKind.Project, projectId };
}

function workspaceScope(workspaceId: string): SelectionScope {
  return { kind: GrantScopeKind.Workspace, workspaceId };
}

async function toolsOf(client: Client) {
  return (await client.listTools()).tools;
}

describe('the tool list of a selection', () => {
  test('two projects of different workspaces list the workspaces tool and every task tool, each asking for its project, and no owner tool', async () => {
    const { ownerId, firstProjectId, thirdProjectId } = await fixture();
    const client = await connectedSelection({ ownerId, scopes: [projectScope(firstProjectId), projectScope(thirdProjectId)] });

    const tools = await toolsOf(client);

    expect(tools.map((tool) => tool.name).sort()).toEqual([McpOwnerToolName.Workspaces, ...TASK_TOOLS_OF_SELECTION].sort());
    OWNER_TOOLS.forEach((name) => expect(tools.map((tool) => tool.name)).not.toContain(name));
    const taskTools = tools.filter((tool) => TASK_TOOLS_OF_SELECTION.includes(tool.name as McpToolName));
    expect(taskTools.map((tool) => tool.inputSchema.required)).toEqual(taskTools.map(() => expect.arrayContaining([PROJECT_ARGUMENT])));
  });

  test('a whole workspace lists the same tools', async () => {
    const { ownerId, firstWorkspaceId } = await fixture();
    const client = await connectedSelection({ ownerId, scopes: [workspaceScope(firstWorkspaceId)] });

    expect((await toolsOf(client)).map((tool) => tool.name).sort()).toEqual(
      [McpOwnerToolName.Workspaces, ...TASK_TOOLS_OF_SELECTION].sort(),
    );
  });

  test.each(OWNER_TOOLS)('the %s owner tool is not offered and cannot be called', async (name) => {
    const { ownerId, firstWorkspaceId } = await fixture();
    const client = await connectedSelection({ ownerId, scopes: [workspaceScope(firstWorkspaceId)] });

    const outcome = await callTool({
      client,
      name,
      args: { name: 'Planted', workspace: firstWorkspaceId, project: 'x', confirm: 'x' },
    }).then(
      (answer) => answer.isError,
      () => true,
    );

    expect(outcome).toBe(true);
    expect(
      await env.DIRECTORY.prepare('SELECT count(*) AS total FROM workspaces WHERE name = ?').bind('Planted').first<{ total: number }>(),
    ).toEqual({
      total: 0,
    });
  });

  test('one project chosen as a project is served as the project server, with no project argument and its siblings reachable by move', async () => {
    const { firstProjectId, secondProjectId } = await fixture();
    const client = await connectClient({ era: ClientEra.Modern, token: await seedProjectToken({ projectId: firstProjectId }) });

    const tools = await toolsOf(client);

    expect(tools.map((tool) => tool.name).sort()).toEqual(Object.values(McpToolName).sort());
    expect(tools.filter((tool) => PROJECT_ARGUMENT in (tool.inputSchema.properties ?? {})).map((tool) => tool.name)).toEqual([
      McpToolName.Move,
    ]);
    await callTool({ client, name: McpToolName.Add, args: { tasks: [{ title: 'Travel' }] } });
    const moved = await callTool({ client, name: McpToolName.Move, args: { id: 'T-1', project: secondProjectId } });
    expect(moved.isError).toBeUndefined();
  });
});

describe('the projects a selection covers', () => {
  test('two projects in different workspaces are both worked on', async () => {
    const { ownerId, firstProjectId, thirdProjectId } = await fixture();
    const client = await connectedSelection({ ownerId, scopes: [projectScope(firstProjectId), projectScope(thirdProjectId)] });

    const first = await callTool({ client, name: McpToolName.Add, args: { project: firstProjectId, tasks: [{ title: 'One' }] } });
    const third = await callTool({ client, name: McpToolName.Add, args: { project: thirdProjectId, tasks: [{ title: 'Three' }] } });

    expect(first.isError).toBeUndefined();
    expect(third.isError).toBeUndefined();
    expect((await callTool({ client, name: McpToolName.List, args: { project: firstProjectId } })).text).toContain('One');
    expect((await callTool({ client, name: McpToolName.List, args: { project: thirdProjectId } })).text).toContain('Three');
  });

  test('a whole workspace covers its projects, including one created after the grant', async () => {
    const { ownerId, firstProjectId, secondProjectId, thirdProjectId, firstWorkspaceId } = await fixture();
    const client = await connectedSelection({ ownerId, scopes: [workspaceScope(firstWorkspaceId)] });
    const laterProjectId = await seedSiblingProject({ projectId: firstProjectId, name: 'Later' });

    const answers = await Promise.all(
      [firstProjectId, secondProjectId, laterProjectId].map((project) =>
        callTool({ client, name: McpToolName.Add, args: { project, tasks: [{ title: 'Covered' }] } }),
      ),
    );

    answers.forEach((answer) => expect(answer.isError).toBeUndefined());
    expect(await callTool({ client, name: McpToolName.List, args: { project: thirdProjectId } })).toEqual(OUTSIDE_THE_SET);
  });

  test('a workspace plus a project elsewhere covers both and nothing else', async () => {
    const { ownerId, firstProjectId, thirdProjectId, fourthProjectId, firstWorkspaceId } = await fixture();
    const client = await connectedSelection({ ownerId, scopes: [workspaceScope(firstWorkspaceId), projectScope(fourthProjectId)] });

    expect((await callTool({ client, name: McpToolName.List, args: { project: firstProjectId } })).isError).toBeUndefined();
    expect((await callTool({ client, name: McpToolName.List, args: { project: fourthProjectId } })).isError).toBeUndefined();
    expect(await callTool({ client, name: McpToolName.List, args: { project: thirdProjectId } })).toEqual(OUTSIDE_THE_SET);
  });

  test.each(TASK_CALLS)('the %s tool on a project outside the set answers as for an unknown project', async (name, args) => {
    const { ownerId, firstProjectId, thirdProjectId, fourthProjectId } = await fixture();
    const client = await connectedSelection({ ownerId, scopes: [projectScope(firstProjectId), projectScope(fourthProjectId)] });
    const outsideTool = await callTool({ client, name, args: { ...args, project: thirdProjectId } });
    const unknownTool = await callTool({ client, name, args: { ...args, project: crypto.randomUUID() } });

    expect(outsideTool).toEqual(unknownTool);
    expect(outsideTool).toEqual(OUTSIDE_THE_SET);
  });

  test('a project of another owner answers as an unknown one even when its workspace id is listed', async () => {
    const { ownerId, firstProjectId } = await fixture();
    const strangerProjectId = await seedProject({ ownerId: await seedOwner() });
    const client = await connectedSelection({
      ownerId,
      scopes: [projectScope(firstProjectId), workspaceScope(await workspaceOf(strangerProjectId)), projectScope(strangerProjectId)],
    });

    expect(await callTool({ client, name: McpToolName.List, args: { project: strangerProjectId } })).toEqual(OUTSIDE_THE_SET);
  });
});

describe('moving inside a selection', () => {
  async function addTask({ client, project }: { client: Client; project: string }): Promise<void> {
    await callTool({ client, name: McpToolName.Add, args: { project, tasks: [{ title: 'Travel' }] } });
  }

  test('a move between two selected projects of one workspace lands', async () => {
    const { ownerId, firstProjectId, secondProjectId } = await fixture();
    const client = await connectedSelection({ ownerId, scopes: [projectScope(firstProjectId), projectScope(secondProjectId)] });
    await addTask({ client, project: firstProjectId });

    const moved = await callTool({
      client,
      name: McpToolName.Move,
      args: { project: firstProjectId, id: 'T-1', destination: secondProjectId },
    });

    expect(moved.isError).toBeUndefined();
    expect((await callTool({ client, name: McpToolName.List, args: { project: secondProjectId } })).text).toContain('Travel');
  });

  test('a move inside a selected workspace lands', async () => {
    const { ownerId, firstProjectId, secondProjectId, firstWorkspaceId } = await fixture();
    const client = await connectedSelection({ ownerId, scopes: [workspaceScope(firstWorkspaceId)] });
    await addTask({ client, project: firstProjectId });

    const moved = await callTool({
      client,
      name: McpToolName.Move,
      args: { project: firstProjectId, id: 'T-1', destination: secondProjectId },
    });

    expect(moved.isError).toBeUndefined();
  });

  test('a move to a sibling that is not selected is refused as not another project of the workspace', async () => {
    const { ownerId, firstProjectId, secondProjectId, fourthProjectId } = await fixture();
    const client = await connectedSelection({
      ownerId,
      scopes: [projectScope(firstProjectId), projectScope(fourthProjectId)],
    });
    await addTask({ client, project: firstProjectId });

    const refused = await callTool({
      client,
      name: McpToolName.Move,
      args: { project: firstProjectId, id: 'T-1', destination: secondProjectId },
    });

    expect(refused).toEqual({ text: MCP_COPY.projectNotInWorkspace, isError: true });
    expect((await callTool({ client, name: McpToolName.List, args: { project: firstProjectId } })).text).toContain('Travel');
  });

  test('a move across workspaces is refused even when both ends are selected', async () => {
    const { ownerId, firstProjectId, thirdProjectId } = await fixture();
    const client = await connectedSelection({ ownerId, scopes: [projectScope(firstProjectId), projectScope(thirdProjectId)] });
    await addTask({ client, project: firstProjectId });

    const refused = await callTool({
      client,
      name: McpToolName.Move,
      args: { project: firstProjectId, id: 'T-1', destination: thirdProjectId },
    });

    expect(refused).toEqual({ text: MCP_COPY.projectNotInWorkspace, isError: true });
  });

  test('a move from a project outside the set is refused as unknown', async () => {
    const { ownerId, firstProjectId, thirdProjectId, fourthProjectId } = await fixture();
    const client = await connectedSelection({ ownerId, scopes: [projectScope(firstProjectId), projectScope(fourthProjectId)] });

    const refused = await callTool({
      client,
      name: McpToolName.Move,
      args: { project: thirdProjectId, id: 'T-1', destination: firstProjectId },
    });

    expect(refused).toEqual(OUTSIDE_THE_SET);
  });
});

describe('the workspaces tool of a selection', () => {
  test('lists a listed workspace with all its projects and, for a project, its workspace with only that project', async () => {
    const {
      ownerId,
      firstProjectId,
      secondProjectId,
      thirdProjectId,
      fourthProjectId,
      firstWorkspaceId,
      thirdWorkspaceId,
      fourthWorkspaceId,
    } = await fixture();
    const client = await connectedSelection({ ownerId, scopes: [workspaceScope(firstWorkspaceId), projectScope(fourthProjectId)] });

    const { text } = await callTool({ client, name: McpOwnerToolName.Workspaces, args: {} });

    [firstWorkspaceId, firstProjectId, secondProjectId, fourthWorkspaceId, fourthProjectId].forEach((id) => expect(text).toContain(id));
    [thirdWorkspaceId, thirdProjectId].forEach((id) => expect(text).not.toContain(id));
  });

  test('shows only the selected projects of a workspace that is not selected whole', async () => {
    const { ownerId, firstProjectId, secondProjectId, firstWorkspaceId, fourthProjectId } = await fixture();
    const client = await connectedSelection({ ownerId, scopes: [projectScope(firstProjectId), projectScope(fourthProjectId)] });

    const { text } = await callTool({ client, name: McpOwnerToolName.Workspaces, args: {} });

    expect(text).toContain(firstWorkspaceId);
    expect(text).toContain(firstProjectId);
    expect(text).not.toContain(secondProjectId);
  });
});

describe('the limits of a selection grant', () => {
  test('the daily write budget of the owner applies', async () => {
    const { ownerId, firstProjectId, fourthProjectId } = await fixture();
    const client = await connectedSelection({ ownerId, scopes: [projectScope(firstProjectId), projectScope(fourthProjectId)] });
    await env.DIRECTORY.prepare('INSERT INTO owner_usage (owner_id, day, writes, bytes) VALUES (?, ?, ?, 0)')
      .bind(ownerId, utcDayOf(Date.now()), OWNER_WRITES_PER_DAY_MAX)
      .run();

    const answer = await callTool({ client, name: McpToolName.Add, args: { project: firstProjectId, tasks: [{ title: 'Over the day' }] } });

    expect(answer.isError).toBe(true);
    expect(answer.text).toContain(String(OWNER_WRITES_PER_DAY_MAX));
  });

  test('a suspended owner is refused on every call', async () => {
    const { ownerId, firstWorkspaceId } = await fixture();
    const token = await seedSelectionToken({ ownerId, scopes: [workspaceScope(firstWorkspaceId)] });
    await env.DIRECTORY.prepare('UPDATE owners SET suspended_at = ? WHERE id = ?').bind(Date.now(), ownerId).run();

    const response = await exports.default.fetch(
      new Request(`${WORKER_ORIGIN}/mcp`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} }),
      }),
    );

    expect(response.status).toBe(FORBIDDEN_STATUS);
  });
});
