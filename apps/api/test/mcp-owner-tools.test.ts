import type { Client } from '@modelcontextprotocol/client';
import { INBOX_PROJECT_NAME, OWNER_KEY_PREFIX, OWNER_WORKSPACES_MAX, PROJECT_KEY_PREFIX, RuleIssue } from '@todz/types';
import { env, exports } from 'cloudflare:workers';
import { describe, expect, test } from 'vitest';
import { generateCredentialSecret } from '../src/credential-secret';
import { MCP_COPY, McpOwnerToolName, McpToolName } from '../src/mcp-copy';
import { seedIssuedKey, seedOwner, seedOwnerKey, seedProject, seedRevokedOwnerKey, seedWorkspace } from './directory-seed';
import { ClientEra, callTool, connectClient } from './mcp-client';

const MCP_URL = 'http://localhost:8787/mcp';
const UNAUTHORIZED_STATUS = 401;
const ID_PATTERN = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g;

type OwnerSetup = { ownerId: string; client: Client };

async function connectedOwner(era: ClientEra = ClientEra.Modern): Promise<OwnerSetup> {
  const ownerId = await seedOwner();
  const key = await seedOwnerKey({ ownerId });
  return { ownerId, client: await connectClient({ era, key }) };
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
  test('lists exactly the seven account tools and none of the project tools', async () => {
    const { client } = await connectedOwner(era);
    const { tools } = await client.listTools();
    expect(tools.map((tool) => tool.name).sort()).toEqual(Object.values(McpOwnerToolName).sort());
    expect(Object.fromEntries(tools.map((tool) => [tool.name, tool.description]))).toEqual(MCP_COPY.ownerTools);
    expect(tools.map((tool) => tool.name)).not.toContain(McpToolName.Add);
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

describe('the two scopes never mix', () => {
  test('a project key does not list the account tools and cannot call one', async () => {
    const { key } = await seedIssuedKey();
    const client = await connectClient({ era: ClientEra.Modern, key });
    const { tools } = await client.listTools();
    expect(tools.map((tool) => tool.name).filter((name) => Object.values<string>(McpOwnerToolName).includes(name))).toEqual([]);
    await expect(
      callTool({ client, name: McpOwnerToolName.DeleteWorkspace, args: { workspace: crypto.randomUUID(), confirm: 'x' } }),
    ).rejects.toThrow();
  });

  test('an owner key cannot call a task tool', async () => {
    const { client } = await connectedOwner();
    await expect(callTool({ client, name: McpToolName.Add, args: { tasks: [{ title: 'No' }] } })).rejects.toThrow();
  });

  test.each([
    { name: 'a revoked owner key', secret: async () => seedRevokedOwnerKey({ ownerId: await seedOwner() }) },
    { name: 'an owner key never issued', secret: async () => `${OWNER_KEY_PREFIX}${generateCredentialSecret()}` },
    { name: 'the random part of an owner key without its prefix', secret: async () => generateCredentialSecret() },
  ])('$name answers 401 and nothing else', async ({ secret }) => {
    const response = await exports.default.fetch(MCP_URL, { method: 'POST', headers: { Authorization: `Bearer ${await secret()}` } });
    expect(response.status).toBe(UNAUTHORIZED_STATUS);
    expect(await response.text()).toBe('');
  });

  test('an owner key under the project key prefix opens nothing', async () => {
    const ownerKey = await seedOwnerKey({ ownerId: await seedOwner() });
    const asProjectKey = ownerKey.replace(OWNER_KEY_PREFIX, PROJECT_KEY_PREFIX);
    const response = await exports.default.fetch(MCP_URL, { method: 'POST', headers: { Authorization: `Bearer ${asProjectKey}` } });
    expect(response.status).toBe(UNAUTHORIZED_STATUS);
  });
});
