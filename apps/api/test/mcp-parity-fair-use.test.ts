import type { Client } from '@modelcontextprotocol/client';
import { OWNER_WRITES_PER_DAY_MAX, RuleIssue } from '@todz/types';
import { env, exports } from 'cloudflare:workers';
import { describe, expect, test } from 'vitest';
import type { Env } from '../src/env';
import { MCP_COPY, McpOwnerToolName, McpToolName } from '../src/mcp-copy';
import { serveMcp } from '../src/mcp-endpoint';
import { utcDayOf } from '../src/telemetry/telemetry-day';
import { seedProjectWithToken, seedOwner, seedOwnerToken, seedProject, seedSiblingProject, seedWorkspace } from './directory-seed';
import { ClientEra, callTool, connectClient } from './mcp-client';

const FORBIDDEN_STATUS = 403;
const SUSPENDED_JSON_RPC_CODE = -32003;
const WORKER_ORIGIN = 'http://localhost:8787';
const JSON_MEDIA_TYPE = 'application/json';
const ID_PATTERN = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g;
const WORKSPACES_CAP = 1;
const PROJECTS_CAP = 2;
const cappedEnv: Env = {
  ...env,
  FAIR_USE_WORKSPACES_MAX: String(WORKSPACES_CAP),
  FAIR_USE_PROJECTS_PER_WORKSPACE_MAX: String(PROJECTS_CAP),
};

async function ownerOfProject(projectId: string): Promise<string> {
  const row = await env.DIRECTORY.prepare(
    'SELECT workspaces.owner_id AS owner_id FROM projects JOIN workspaces ON workspaces.id = projects.workspace_id WHERE projects.id = ?',
  )
    .bind(projectId)
    .first<{ owner_id: string }>();
  if (row === null) throw new Error('a seeded project has an owner');
  return row.owner_id;
}

async function exhaustToday(ownerId: string): Promise<void> {
  await env.DIRECTORY.prepare(
    'INSERT INTO owner_usage (owner_id, day, writes, bytes) VALUES (?, ?, ?, 0) ON CONFLICT (owner_id, day) DO UPDATE SET writes = excluded.writes',
  )
    .bind(ownerId, utcDayOf(Date.now()), OWNER_WRITES_PER_DAY_MAX)
    .run();
}

function ownerKeyClient({ ownerId, workerEnv = env }: { ownerId: string; workerEnv?: Env }): Promise<Client> {
  return seedOwnerToken({ ownerId }).then((token) =>
    connectClient({
      era: ClientEra.Modern,
      token,
      serve: (request) => serveMcp({ request, env: workerEnv, now: Date.now() }),
    }),
  );
}

function initializeRequest(token: string): Request {
  return new Request(`${WORKER_ORIGIN}/mcp`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': JSON_MEDIA_TYPE, Accept: `${JSON_MEDIA_TYPE}, text/event-stream` },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} }),
  });
}

describe('a suspended owner key', () => {
  test('is refused on every call with the suspended code', async () => {
    const ownerId = await seedOwner();
    const token = await seedOwnerToken({ ownerId });
    await env.DIRECTORY.prepare('UPDATE owners SET suspended_at = ? WHERE id = ?').bind(Date.now(), ownerId).run();
    const response = await exports.default.fetch(initializeRequest(token));
    expect(response.status).toBe(FORBIDDEN_STATUS);
    expect((await response.json<{ error: { code: number } }>()).error.code).toBe(SUSPENDED_JSON_RPC_CODE);
  });
});

describe('an owner at the daily cap', () => {
  test('cannot reopen or move a task, and the refusal costs no change', async () => {
    const { projectId, token } = await seedProjectWithToken();
    const siblingId = await seedSiblingProject({ projectId, name: 'Side' });
    const client = await connectClient({ era: ClientEra.Modern, token });
    await callTool({ client, name: McpToolName.Add, args: { tasks: [{ title: 'One' }, { title: 'Two' }] } });
    await callTool({ client, name: McpToolName.Done, args: { ids: ['T-1'] } });
    await exhaustToday(await ownerOfProject(projectId));
    const reopened = await callTool({ client, name: McpToolName.Reopen, args: { ids: ['T-1'] } });
    const moved = await callTool({ client, name: McpToolName.Move, args: { id: 'T-2', project: siblingId } });
    const deleted = await callTool({ client, name: McpToolName.Delete, args: { id: 'T-2', confirm: 'Two' } });
    [reopened, moved, deleted].forEach((answer) => {
      expect(answer.isError).toBe(true);
      expect(answer.text).toContain(String(OWNER_WRITES_PER_DAY_MAX));
    });
    expect((await callTool({ client, name: McpToolName.List, args: { state: 'done' } })).text).toContain('T-1 One');
    expect((await callTool({ client, name: McpToolName.List, args: {} })).text).toContain('T-2 Two');
  });

  test('is refused for an invalid call before the cap: a wrong confirm and a missing task keep their own sentence', async () => {
    const { projectId, token } = await seedProjectWithToken();
    const client = await connectClient({ era: ClientEra.Modern, token });
    await callTool({ client, name: McpToolName.Add, args: { tasks: [{ title: 'Keep' }] } });
    await exhaustToday(await ownerOfProject(projectId));
    expect(await callTool({ client, name: McpToolName.Delete, args: { id: 'T-1', confirm: 'nope' } })).toEqual({
      text: MCP_COPY.ruleIssue[RuleIssue.ConfirmationMismatch],
      isError: true,
    });
    expect(await callTool({ client, name: McpToolName.Delete, args: { id: 'T-9', confirm: 'x' } })).toEqual({
      text: MCP_COPY.taskNotFound('T-9'),
      isError: true,
    });
  });

  test('cannot create, rename, delete or change settings with an owner key, and a bad name keeps its own sentence', async () => {
    const ownerId = await seedOwner();
    const client = await ownerKeyClient({ ownerId });
    const created = await callTool({ client, name: McpOwnerToolName.CreateWorkspace, args: { name: 'Before' } });
    expect(created.isError).toBeUndefined();
    await exhaustToday(ownerId);
    const refused = await Promise.all([
      callTool({ client, name: McpOwnerToolName.CreateWorkspace, args: { name: 'After' } }),
      callTool({ client, name: McpOwnerToolName.UpdateSettings, args: { agent_nudge: false } }),
    ]);
    refused.forEach((answer) => {
      expect(answer.isError).toBe(true);
      expect(answer.text).toContain(String(OWNER_WRITES_PER_DAY_MAX));
    });
    expect(await callTool({ client, name: McpOwnerToolName.CreateWorkspace, args: { name: '   ' } })).toEqual({
      text: MCP_COPY.ruleIssue[RuleIssue.NameEmpty],
      isError: true,
    });
    expect(await callTool({ client, name: McpOwnerToolName.UpdateSettings, args: { time_zone: 'Mars/Base' } })).toEqual({
      text: MCP_COPY.timeZoneInvalid,
      isError: true,
    });
    expect((await callTool({ client, name: McpOwnerToolName.Workspaces, args: {} })).text).not.toContain('After');
  });
});

describe('an owner key reaching for a foreign id', () => {
  test('a rename or a create answers not found and spends no write', async () => {
    const ownerId = await seedOwner();
    const foreignOwnerId = await seedOwner();
    const foreignWorkspaceId = await seedWorkspace({ ownerId: foreignOwnerId });
    const foreignProjectId = await seedProject({ ownerId: foreignOwnerId });
    const client = await ownerKeyClient({ ownerId });
    const answers = await Promise.all([
      callTool({ client, name: McpOwnerToolName.RenameWorkspace, args: { workspace: foreignWorkspaceId, name: 'Mine' } }),
      callTool({ client, name: McpOwnerToolName.CreateProject, args: { workspace: foreignWorkspaceId, name: 'Mine' } }),
      callTool({ client, name: McpOwnerToolName.RenameProject, args: { project: foreignProjectId, name: 'Mine' } }),
    ]);
    answers.forEach((answer) => expect(answer).toEqual({ text: MCP_COPY.accountNotFound, isError: true }));
    const usage = await env.DIRECTORY.prepare('SELECT count(*) AS total FROM owner_usage WHERE owner_id = ?')
      .bind(ownerId)
      .first<{ total: number }>();
    expect(usage).toEqual({ total: 0 });
  });
});

describe('the account limits come from the configured variables', () => {
  test('a second workspace is refused at FAIR_USE_WORKSPACES_MAX with the configured number', async () => {
    const client = await ownerKeyClient({ ownerId: await seedOwner(), workerEnv: cappedEnv });
    expect((await callTool({ client, name: McpOwnerToolName.CreateWorkspace, args: { name: 'First' } })).isError).toBeUndefined();
    expect(await callTool({ client, name: McpOwnerToolName.CreateWorkspace, args: { name: 'Second' } })).toEqual({
      text: MCP_COPY.workspacesLimit(WORKSPACES_CAP),
      isError: true,
    });
  });

  test('a project beyond FAIR_USE_PROJECTS_PER_WORKSPACE_MAX is refused with the configured number', async () => {
    const client = await ownerKeyClient({ ownerId: await seedOwner(), workerEnv: cappedEnv });
    const created = await callTool({ client, name: McpOwnerToolName.CreateWorkspace, args: { name: 'Only' } });
    const [workspaceMatch] = [...created.text.matchAll(ID_PATTERN)];
    if (workspaceMatch === undefined) throw new Error(`no id in ${created.text}`);
    const [workspaceId] = workspaceMatch;
    const first = await callTool({ client, name: McpOwnerToolName.CreateProject, args: { workspace: workspaceId, name: 'Launch' } });
    expect(first.isError).toBeUndefined();
    expect(await callTool({ client, name: McpOwnerToolName.CreateProject, args: { workspace: workspaceId, name: 'Extra' } })).toEqual({
      text: MCP_COPY.projectsLimit(PROJECTS_CAP),
      isError: true,
    });
  });
});
