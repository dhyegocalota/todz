import type { Client } from '@modelcontextprotocol/client';
import { INBOX_PROJECT_NAME, OWNER_WORKSPACES_MAX, RuleIssue } from '@todz/types';
import { env, exports } from 'cloudflare:workers';
import { describe, expect, test } from 'vitest';
import { MCP_COPY, McpOwnerToolName, McpToolName } from '../src/mcp-copy';
import { accessSecret, revokeToken, seedOwner, seedOwnerToken, seedProject, seedProjectWithToken, seedWorkspace } from './directory-seed';
import { ClientEra, callTool, connectClient } from './mcp-client';

const MCP_URL = 'http://localhost:8787/mcp';
const UNAUTHORIZED_STATUS = 401;
const ID_PATTERN = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g;

type OwnerSetup = { ownerId: string; client: Client };

async function connectedOwner(era: ClientEra = ClientEra.Modern): Promise<OwnerSetup> {
  const ownerId = await seedOwner();
  const token = await seedOwnerToken({ ownerId });
  return { ownerId, client: await connectClient({ era, token }) };
}

function idsIn(text: string): string[] {
  return [...text.matchAll(ID_PATTERN)].map((match) => match[0]);
}

async function createdWorkspace({ client, name }: { client: Client; name: string }): Promise<{ workspaceId: string; inboxId: string }> {
  const answer = await callTool({ client, name: McpOwnerToolName.CreateWorkspace, args: { name } });
  const [workspaceId, inboxId] = idsIn(answer.text);
  if (workspaceId === undefined || inboxId === undefined) throw new Error(`no ids in ${answer.text}`);
  return { workspaceId, inboxId };
}

async function createdProject({ client, workspaceId, name }: { client: Client; workspaceId: string; name: string }): Promise<string> {
  const answer = await callTool({ client, name: McpOwnerToolName.CreateProject, args: { workspace: workspaceId, name } });
  const [projectId] = idsIn(answer.text);
  if (projectId === undefined) throw new Error(`no id in ${answer.text}`);
  return projectId;
}

function workspacesOf(client: Client) {
  return callTool({ client, name: McpOwnerToolName.Workspaces, args: {} });
}

describe.each([ClientEra.Legacy, ClientEra.Modern])('the owner key, %s client', (era) => {
  test('lists the nine account tools with their copy, and the task tools of the project server but projects', async () => {
    const { client } = await connectedOwner(era);
    const { tools } = await client.listTools();
    const accountTools = tools.filter((tool) => Object.values<string>(McpOwnerToolName).includes(tool.name));
    expect(accountTools.map((tool) => tool.name).sort()).toEqual(Object.values(McpOwnerToolName).sort());
    expect(Object.fromEntries(accountTools.map((tool) => [tool.name, tool.description]))).toEqual(MCP_COPY.ownerTools);
    expect(tools.map((tool) => tool.name)).toContain(McpToolName.Add);
    expect(tools.map((tool) => tool.name)).not.toContain(McpToolName.Projects);
  });

  test('creates a workspace with its Inbox and lists it', async () => {
    const { client } = await connectedOwner(era);
    expect(await workspacesOf(client)).toEqual({ text: MCP_COPY.noWorkspaces, isError: undefined });
    const { workspaceId, inboxId } = await createdWorkspace({ client, name: 'Home' });
    const { text } = await workspacesOf(client);
    expect(text).toContain(`${workspaceId} Home`);
    expect(text).toContain(`${inboxId} ${INBOX_PROJECT_NAME}${MCP_COPY.inboxProject}`);
  });
});

describe('the account tools', () => {
  test('a workspace lists only what the owner of the key owns', async () => {
    const { client } = await connectedOwner();
    const foreignWorkspaceId = await seedWorkspace({ ownerId: await seedOwner() });
    const { workspaceId } = await createdWorkspace({ client, name: 'Mine' });
    const { text } = await workspacesOf(client);
    expect(text).toContain(workspaceId);
    expect(text).not.toContain(foreignWorkspaceId);
  });

  test('rename and create project work, and delete_project removes only the named project', async () => {
    const { client } = await connectedOwner();
    const { workspaceId } = await createdWorkspace({ client, name: 'Work' });
    const projectId = await createdProject({ client, workspaceId, name: 'Launch' });
    const spareId = await createdProject({ client, workspaceId, name: 'Spare' });
    const renamed = await callTool({ client, name: McpOwnerToolName.RenameProject, args: { project: projectId, name: 'Ship' } });
    expect(renamed).toEqual({ text: MCP_COPY.projectRenamed({ id: projectId, name: 'Ship' }), isError: undefined });
    const renamedWorkspace = await callTool({
      client,
      name: McpOwnerToolName.RenameWorkspace,
      args: { workspace: workspaceId, name: 'Office' },
    });
    expect(renamedWorkspace.text).toBe(MCP_COPY.workspaceRenamed({ id: workspaceId, name: 'Office' }));
    const deleted = await callTool({ client, name: McpOwnerToolName.DeleteProject, args: { project: projectId, confirm: 'Ship' } });
    expect(deleted).toEqual({ text: MCP_COPY.projectDeleted('Ship'), isError: undefined });
    const { text } = await workspacesOf(client);
    expect(text).not.toContain(projectId);
    expect(text).toContain(spareId);
  });

  test('delete_workspace with the name deletes the workspace and its projects', async () => {
    const { client } = await connectedOwner();
    const { workspaceId } = await createdWorkspace({ client, name: 'Temporary' });
    const deleted = await callTool({
      client,
      name: McpOwnerToolName.DeleteWorkspace,
      args: { workspace: workspaceId, confirm: 'Temporary' },
    });
    expect(deleted).toEqual({ text: MCP_COPY.workspaceDeleted('Temporary'), isError: undefined });
    expect((await workspacesOf(client)).text).toBe(MCP_COPY.noWorkspaces);
  });

  test('a confirmation that is not the current name deletes nothing, for a workspace and for a project', async () => {
    const { client } = await connectedOwner();
    const { workspaceId } = await createdWorkspace({ client, name: 'Keep me' });
    const projectId = await createdProject({ client, workspaceId, name: 'Keep too' });
    const refusal = { text: MCP_COPY.ruleIssue[RuleIssue.ConfirmationMismatch], isError: true };
    expect(
      await callTool({ client, name: McpOwnerToolName.DeleteWorkspace, args: { workspace: workspaceId, confirm: 'keep me' } }),
    ).toEqual(refusal);
    expect(await callTool({ client, name: McpOwnerToolName.DeleteProject, args: { project: projectId, confirm: '' } })).toEqual(refusal);
    const { text } = await workspacesOf(client);
    expect(text).toContain(workspaceId);
    expect(text).toContain(projectId);
  });

  test('a delete without a confirm argument never reaches the account', async () => {
    const { client } = await connectedOwner();
    const { workspaceId } = await createdWorkspace({ client, name: 'Keep me' });
    const answer = await callTool({ client, name: McpOwnerToolName.DeleteWorkspace, args: { workspace: workspaceId } });
    expect(answer.isError).toBe(true);
    expect((await workspacesOf(client)).text).toContain(workspaceId);
  });

  test('the Inbox cannot be renamed or deleted', async () => {
    const { client } = await connectedOwner();
    const { inboxId } = await createdWorkspace({ client, name: 'Home' });
    const renamed = await callTool({ client, name: McpOwnerToolName.RenameProject, args: { project: inboxId, name: 'Other' } });
    const deleted = await callTool({
      client,
      name: McpOwnerToolName.DeleteProject,
      args: { project: inboxId, confirm: INBOX_PROJECT_NAME },
    });
    expect(renamed).toEqual({ text: MCP_COPY.inboxIsFixed, isError: true });
    expect(deleted).toEqual({ text: MCP_COPY.inboxIsFixed, isError: true });
  });

  test('a workspace or project of another owner answers exactly what an absent id answers, and is untouched', async () => {
    const { client } = await connectedOwner();
    const foreignOwnerId = await seedOwner();
    const foreignProjectId = await seedProject({ ownerId: foreignOwnerId });
    const foreignWorkspaceId = await seedWorkspace({ ownerId: foreignOwnerId });
    const absentId = crypto.randomUUID();
    const notFound = { text: MCP_COPY.accountNotFound, isError: true };
    const answers = await Promise.all([
      callTool({ client, name: McpOwnerToolName.RenameWorkspace, args: { workspace: foreignWorkspaceId, name: 'Taken' } }),
      callTool({ client, name: McpOwnerToolName.RenameWorkspace, args: { workspace: absentId, name: 'Taken' } }),
      callTool({ client, name: McpOwnerToolName.DeleteWorkspace, args: { workspace: foreignWorkspaceId, confirm: 'Workspace' } }),
      callTool({ client, name: McpOwnerToolName.DeleteProject, args: { project: foreignProjectId, confirm: 'Project' } }),
      callTool({ client, name: McpOwnerToolName.RenameProject, args: { project: foreignProjectId, name: 'Taken' } }),
      callTool({ client, name: McpOwnerToolName.CreateProject, args: { workspace: foreignWorkspaceId, name: 'Planted' } }),
    ]);
    expect(answers).toEqual(Array.from({ length: answers.length }, () => notFound));
    const stored = await env.DIRECTORY.prepare('SELECT count(*) AS total FROM projects WHERE id = ? OR workspace_id = ?')
      .bind(foreignProjectId, foreignWorkspaceId)
      .first<{ total: number }>();
    expect(stored).toEqual({ total: 1 });
  });

  test('an invalid name is refused with the rule sentence', async () => {
    const { client } = await connectedOwner();
    expect(await callTool({ client, name: McpOwnerToolName.CreateWorkspace, args: { name: '   ' } })).toEqual({
      text: MCP_COPY.ruleIssue[RuleIssue.NameEmpty],
      isError: true,
    });
  });

  test('the workspace count of an owner is capped', async () => {
    const { client } = await connectedOwner();
    await Promise.all(Array.from({ length: OWNER_WORKSPACES_MAX }, (_unused, index) => createdWorkspace({ client, name: `W${index}` })));
    expect(await callTool({ client, name: McpOwnerToolName.CreateWorkspace, args: { name: 'One more' } })).toEqual({
      text: MCP_COPY.workspacesLimit(OWNER_WORKSPACES_MAX),
      isError: true,
    });
  });
});

describe('the settings tools', () => {
  test('settings shows the time zone, the agent nudge and the day email of the owner of the key', async () => {
    const ownerId = await seedOwner('Pacific/Kiritimati');
    const client = await connectClient({ era: ClientEra.Modern, token: await seedOwnerToken({ ownerId }) });
    const { text } = await callTool({ client, name: McpOwnerToolName.Settings, args: {} });
    expect(text.split('\n')).toEqual(
      expect.arrayContaining([
        MCP_COPY.timeZoneLine('Pacific/Kiritimati'),
        expect.stringMatching(/^Agent nudge: (on|off)$/),
        expect.stringMatching(/^Day email: /),
      ]),
    );
  });

  test('update_settings changes only what is given, validates the time zone and shows the result', async () => {
    const { client } = await connectedOwner();
    const updated = await callTool({
      client,
      name: McpOwnerToolName.UpdateSettings,
      args: { time_zone: 'America/Sao_Paulo', agent_nudge: false, day_email: true, day_email_minutes: 450 },
    });
    expect(updated).toEqual({
      text: [
        MCP_COPY.settingsUpdated,
        MCP_COPY.timeZoneLine('America/Sao_Paulo'),
        MCP_COPY.agentNudgeLine(MCP_COPY.settingsOff),
        MCP_COPY.dayEmailOnLine('07:30'),
      ].join('\n'),
      isError: undefined,
    });
    const only = await callTool({ client, name: McpOwnerToolName.UpdateSettings, args: { day_email: false } });
    expect(only.text.split('\n')).toEqual([
      MCP_COPY.settingsUpdated,
      MCP_COPY.timeZoneLine('America/Sao_Paulo'),
      MCP_COPY.agentNudgeLine(MCP_COPY.settingsOff),
      MCP_COPY.dayEmailOffLine,
    ]);
  });

  test('a bad time zone, an empty call and minutes out of range change nothing', async () => {
    const { client } = await connectedOwner();
    expect(await callTool({ client, name: McpOwnerToolName.UpdateSettings, args: { time_zone: 'Mars/Base' } })).toEqual({
      text: MCP_COPY.timeZoneInvalid,
      isError: true,
    });
    expect(await callTool({ client, name: McpOwnerToolName.UpdateSettings, args: {} })).toEqual({
      text: MCP_COPY.nothingToUpdateSettings,
      isError: true,
    });
    expect((await callTool({ client, name: McpOwnerToolName.UpdateSettings, args: { day_email_minutes: 1440 } })).isError).toBe(true);
  });

  test('a key changes the settings of its own owner and no other', async () => {
    const { client } = await connectedOwner();
    const otherOwnerId = await seedOwner('Asia/Tokyo');
    await callTool({ client, name: McpOwnerToolName.UpdateSettings, args: { time_zone: 'Europe/Lisbon' } });
    const row = await env.DIRECTORY.prepare('SELECT time_zone FROM owners WHERE id = ?').bind(otherOwnerId).first<{ time_zone: string }>();
    expect(row).toEqual({ time_zone: 'Asia/Tokyo' });
  });
});

describe('the two scopes never mix', () => {
  test('a project key does not list the account tools and cannot call one', async () => {
    const { token } = await seedProjectWithToken();
    const client = await connectClient({ era: ClientEra.Modern, token });
    const { tools } = await client.listTools();
    expect(tools.map((tool) => tool.name).filter((name) => Object.values<string>(McpOwnerToolName).includes(name))).toEqual([]);
    await expect(
      callTool({ client, name: McpOwnerToolName.DeleteWorkspace, args: { workspace: crypto.randomUUID(), confirm: 'x' } }),
    ).rejects.toThrow();
  });

  test('an owner token cannot call the projects tool of a project grant', async () => {
    const { client } = await connectedOwner();
    await expect(callTool({ client, name: McpToolName.Projects, args: {} })).rejects.toThrow();
  });

  test.each([
    {
      name: 'a revoked owner token',
      secret: async () => {
        const token = await seedOwnerToken({ ownerId: await seedOwner() });
        await revokeToken(token);
        return token;
      },
    },
    { name: 'an owner token never issued', secret: async () => accessSecret() },
  ])('$name answers 401 and nothing else', async ({ secret }) => {
    const response = await exports.default.fetch(MCP_URL, { method: 'POST', headers: { Authorization: `Bearer ${await secret()}` } });
    expect(response.status).toBe(UNAUTHORIZED_STATUS);
    expect(await response.text()).toBe('');
  });
});
