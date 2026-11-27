import type { Client } from '@modelcontextprotocol/client';
import { OWNER_WRITES_PER_DAY_MAX } from '@todz/types';
import { env } from 'cloudflare:workers';
import { describe, expect, test } from 'vitest';
import { MCP_COPY, McpOwnerToolName, McpToolName } from '../src/mcp-copy';
import { utcDayOf } from '../src/telemetry/telemetry-day';
import { seedOwner, seedOwnerToken, seedProject, seedProjectToken, seedSiblingProject } from './directory-seed';
import { ClientEra, callTool, connectClient } from './mcp-client';

const PROJECT_ARGUMENT = 'project';
const DESTINATION_ARGUMENT = 'destination';
const TOOLS_WITHOUT_OWNER_SCOPE: string[] = [McpToolName.Projects];
const TASK_TOOLS_OF_OWNER = Object.values(McpToolName).filter((name) => !TOOLS_WITHOUT_OWNER_SCOPE.includes(name));
const READ_ONLY_TOOLS: string[] = [
  McpToolName.Next,
  McpToolName.List,
  McpToolName.Show,
  McpToolName.History,
  McpToolName.Projects,
  McpOwnerToolName.Workspaces,
  McpOwnerToolName.Settings,
];
const DESTRUCTIVE_TOOLS: string[] = [
  McpToolName.Update,
  McpToolName.Delete,
  McpToolName.Move,
  McpOwnerToolName.RenameWorkspace,
  McpOwnerToolName.DeleteWorkspace,
  McpOwnerToolName.RenameProject,
  McpOwnerToolName.DeleteProject,
  McpOwnerToolName.UpdateSettings,
];

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

type OwnerSetup = { client: Client; projectId: string; ownerId: string };

async function connectedOwner(): Promise<OwnerSetup> {
  const ownerId = await seedOwner();
  const projectId = await seedProject({ ownerId });
  const client = await connectClient({ era: ClientEra.Modern, token: await seedOwnerToken({ ownerId }) });
  return { client, projectId, ownerId };
}

async function toolsOf(client: Client) {
  return (await client.listTools()).tools;
}

async function ownerOfProject(projectId: string): Promise<string> {
  const row = await env.DIRECTORY.prepare(
    'SELECT workspaces.owner_id AS owner_id FROM projects JOIN workspaces ON workspaces.id = projects.workspace_id WHERE projects.id = ?',
  )
    .bind(projectId)
    .first<{ owner_id: string }>();
  if (row === null) throw new Error('a seeded project has an owner');
  return row.owner_id;
}

describe('the tool list of each scope', () => {
  test('an owner grant lists the account tools and every task tool but projects, each task tool asking for its project', async () => {
    const { client } = await connectedOwner();
    const tools = await toolsOf(client);
    expect(tools.map((tool) => tool.name).sort()).toEqual([...Object.values(McpOwnerToolName), ...TASK_TOOLS_OF_OWNER].sort());
    const taskTools = tools.filter((tool) => TASK_TOOLS_OF_OWNER.includes(tool.name as McpToolName));
    expect(taskTools.map((tool) => tool.inputSchema.required)).toEqual(taskTools.map(() => expect.arrayContaining([PROJECT_ARGUMENT])));
    expect(Object.keys(taskTools.find((tool) => tool.name === McpToolName.Move)?.inputSchema.properties ?? {}).sort()).toEqual(
      ['id', PROJECT_ARGUMENT, DESTINATION_ARGUMENT].sort(),
    );
  });

  test('a project grant lists exactly the task tools it always had, with no project argument besides the move destination', async () => {
    const ownerId = await seedOwner();
    const projectId = await seedProject({ ownerId });
    const client = await connectClient({ era: ClientEra.Modern, token: await seedProjectToken({ projectId }) });
    const tools = await toolsOf(client);
    expect(tools.map((tool) => tool.name).sort()).toEqual(Object.values(McpToolName).sort());
    const withProjectArgument = tools.filter((tool) => PROJECT_ARGUMENT in (tool.inputSchema.properties ?? {}));
    expect(withProjectArgument.map((tool) => tool.name)).toEqual([McpToolName.Move]);
  });
});

describe('the annotations of every tool', () => {
  test('an owner grant and a project grant describe each tool truthfully', async () => {
    const ownerId = await seedOwner();
    const projectId = await seedProject({ ownerId });
    const ownerClient = await connectClient({ era: ClientEra.Modern, token: await seedOwnerToken({ ownerId }) });
    const projectClient = await connectClient({ era: ClientEra.Modern, token: await seedProjectToken({ projectId }) });
    const tools = [...(await toolsOf(ownerClient)), ...(await toolsOf(projectClient))];
    tools.forEach((tool) => {
      const annotations = tool.annotations;
      expect(annotations?.title, `${tool.name} has a title`).toEqual(expect.stringMatching(/\w+/));
      expect(annotations?.openWorldHint, `${tool.name} is closed world`).toBe(false);
      expect(annotations?.readOnlyHint, `${tool.name} readOnlyHint`).toBe(READ_ONLY_TOOLS.includes(tool.name));
      expect(annotations?.idempotentHint, `${tool.name} has an idempotentHint`).toEqual(expect.any(Boolean));
      expect(annotations?.destructiveHint, `${tool.name} destructiveHint`).toBe(DESTRUCTIVE_TOOLS.includes(tool.name));
    });
  });
});

describe('an owner grant working on its own project', () => {
  test('adds, lists and completes a task, and the history names the connected app', async () => {
    const { client, projectId } = await connectedOwner();
    const added = await callTool({ client, name: McpToolName.Add, args: { project: projectId, tasks: [{ title: 'Ship it' }] } });
    expect(added.isError).toBeUndefined();
    expect(added.text).toContain('T-1 Ship it');
    expect((await callTool({ client, name: McpToolName.List, args: { project: projectId } })).text).toContain('T-1 Ship it');
    expect(
      (await callTool({ client, name: McpToolName.Done, args: { project: projectId, ids: ['T-1'], note: 'Shipped' } })).text,
    ).toContain('T-1 Ship it');
    expect((await callTool({ client, name: McpToolName.List, args: { project: projectId } })).text).not.toContain('T-1 Ship it');
    expect((await callTool({ client, name: McpToolName.Next, args: { project: projectId } })).text).toBe(MCP_COPY.noOpenTasks);
  });

  test('moves a task to another project of the same workspace and deletes with its title as confirm', async () => {
    const { client, projectId } = await connectedOwner();
    const siblingId = await seedSiblingProject({ projectId, name: 'Sibling' });
    await callTool({ client, name: McpToolName.Add, args: { project: projectId, tasks: [{ title: 'Travel' }, { title: 'Drop' }] } });
    const moved = await callTool({
      client,
      name: McpToolName.Move,
      args: { project: projectId, id: 'T-1', destination: siblingId },
    });
    expect(moved.isError).toBeUndefined();
    expect((await callTool({ client, name: McpToolName.List, args: { project: siblingId } })).text).toContain('Travel');
    const refused = await callTool({ client, name: McpToolName.Delete, args: { project: projectId, id: 'T-2', confirm: 'Not it' } });
    expect(refused.isError).toBe(true);
    const deleted = await callTool({ client, name: McpToolName.Delete, args: { project: projectId, id: 'T-2', confirm: 'Drop' } });
    expect(deleted.isError).toBeUndefined();
  });

  test('the daily write budget applies', async () => {
    const { client, projectId, ownerId } = await connectedOwner();
    await env.DIRECTORY.prepare('INSERT INTO owner_usage (owner_id, day, writes, bytes) VALUES (?, ?, ?, 0)')
      .bind(ownerId, utcDayOf(Date.now()), OWNER_WRITES_PER_DAY_MAX)
      .run();
    const answer = await callTool({ client, name: McpToolName.Add, args: { project: projectId, tasks: [{ title: 'Over the day' }] } });
    expect(answer.isError).toBe(true);
    expect(answer.text).toContain(String(OWNER_WRITES_PER_DAY_MAX));
  });
});

describe('the project an owner grant names', () => {
  test.each(TASK_CALLS)(
    'the %s tool on a project of another owner answers as for an unknown project and changes nothing',
    async (name, args) => {
      const { client } = await connectedOwner();
      const stranger = await seedOwner();
      const strangerProjectId = await seedProject({ ownerId: stranger });
      const strangerClient = await connectClient({ era: ClientEra.Modern, token: await seedOwnerToken({ ownerId: stranger }) });
      await callTool({
        client: strangerClient,
        name: McpToolName.Add,
        args: { project: strangerProjectId, tasks: [{ title: 'Private' }] },
      });
      const foreign = await callTool({ client, name, args: { ...args, project: strangerProjectId } });
      const unknown = await callTool({ client, name, args: { ...args, project: crypto.randomUUID() } });
      expect(foreign).toEqual(unknown);
      expect(foreign).toEqual({ text: MCP_COPY.accountNotFound, isError: true });
      const strangerList = await callTool({ client: strangerClient, name: McpToolName.List, args: { project: strangerProjectId } });
      expect(strangerList.text).toContain('Private');
      expect(strangerList.text).not.toContain('Planted');
    },
  );

  test('a move cannot land in a project of another owner', async () => {
    const { client, projectId } = await connectedOwner();
    const strangerProjectId = await seedProject({ ownerId: await seedOwner() });
    await callTool({ client, name: McpToolName.Add, args: { project: projectId, tasks: [{ title: 'Stay' }] } });
    const answer = await callTool({
      client,
      name: McpToolName.Move,
      args: { project: projectId, id: 'T-1', destination: strangerProjectId },
    });
    expect(answer).toEqual({ text: MCP_COPY.projectNotInWorkspace, isError: true });
    expect((await callTool({ client, name: McpToolName.List, args: { project: projectId } })).text).toContain('Stay');
  });

  test.each(TASK_TOOLS_OF_OWNER)('the %s tool without a project is refused', async (name) => {
    const { client } = await connectedOwner();
    const outcome = await callTool({ client, name, args: {} }).then(
      (answer) => answer.isError,
      () => true,
    );
    expect(outcome).toBe(true);
  });

  test('two owners work at once and each lists only its own tasks', async () => {
    const first = await connectedOwner();
    const second = await connectedOwner();
    await callTool({ client: first.client, name: McpToolName.Add, args: { project: first.projectId, tasks: [{ title: 'First only' }] } });
    await callTool({
      client: second.client,
      name: McpToolName.Add,
      args: { project: second.projectId, tasks: [{ title: 'Second only' }] },
    });
    const firstList = await callTool({ client: first.client, name: McpToolName.List, args: { project: first.projectId } });
    expect(firstList.text).toContain('First only');
    expect(firstList.text).not.toContain('Second only');
    expect(await ownerOfProject(second.projectId)).toBe(second.ownerId);
  });
});
