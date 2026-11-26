import type { Client } from '@modelcontextprotocol/client';
import { RuleIssue } from '@todz/types';
import { env } from 'cloudflare:workers';
import { describe, expect, test } from 'vitest';
import { MCP_COPY, McpToolName } from '../src/mcp-copy';
import { issueProjectKey } from '../src/project-keys';
import { issuedKeyOf, seedIssuedKey, seedSiblingProject } from './directory-seed';
import { ClientEra, callTool, connectClient } from './mcp-client';
import { CLOCK_NOW } from './task-fixtures';

type ConnectedProject = { client: Client; projectId: string };

async function connectedProject(): Promise<ConnectedProject> {
  const { projectId, key } = await seedIssuedKey();
  return { client: await connectClient({ era: ClientEra.Modern, key }), projectId };
}

async function clientOfProject(projectId: string): Promise<Client> {
  const { secret } = await issuedKeyOf(issueProjectKey({ directory: env.DIRECTORY, projectId, now: CLOCK_NOW }));
  return connectClient({ era: ClientEra.Modern, key: secret });
}

function addTitled({ client, title }: { client: Client; title: string }) {
  return callTool({ client, name: McpToolName.Add, args: { tasks: [{ title }] } });
}

function listIn({ client, state }: { client: Client; state: string }) {
  return callTool({ client, name: McpToolName.List, args: { state } });
}

describe('the reopen tool', () => {
  test('a done task is open again and a second call says it already was', async () => {
    const { client } = await connectedProject();
    await addTitled({ client, title: 'Ship it' });
    await callTool({ client, name: McpToolName.Done, args: { ids: ['T-1'] } });
    expect(await callTool({ client, name: McpToolName.Reopen, args: { ids: ['T-1'] } })).toEqual({
      text: `${MCP_COPY.reopened} T-1 Ship it`,
      isError: undefined,
    });
    expect((await listIn({ client, state: 'open' })).text).toContain('T-1 Ship it');
    expect((await callTool({ client, name: McpToolName.Reopen, args: { ids: ['T-1'] } })).text).toBe(`${MCP_COPY.alreadyOpen} T-1 Ship it`);
  });

  test('an id that is not a task id and a task that does not exist are errors', async () => {
    const { client } = await connectedProject();
    expect(await callTool({ client, name: McpToolName.Reopen, args: { ids: ['nope'] } })).toEqual({
      text: MCP_COPY.taskIdInvalid,
      isError: true,
    });
    expect(await callTool({ client, name: McpToolName.Reopen, args: { ids: ['T-9'] } })).toEqual({
      text: MCP_COPY.taskNotFound('T-9'),
      isError: true,
    });
  });
});

describe('the update tool sets and clears the due date and the notes (pin)', () => {
  test('a date and notes are set, then null clears both', async () => {
    const { client } = await connectedProject();
    await addTitled({ client, title: 'Plan' });
    const set = await callTool({ client, name: McpToolName.Update, args: { id: 'T-1', due_date: '2027-01-02', notes: 'Bring the deck' } });
    expect(set.text).toBe(`${MCP_COPY.updated} T-1 Plan${MCP_COPY.dueOn('2027-01-02')}`);
    const cleared = await callTool({ client, name: McpToolName.Update, args: { id: 'T-1', due_date: null, notes: null } });
    expect(cleared.text).toBe(`${MCP_COPY.updated} T-1 Plan`);
  });
});

describe('the delete tool', () => {
  test('the confirmation naming the title deletes the task', async () => {
    const { client } = await connectedProject();
    await addTitled({ client, title: 'Remove me' });
    expect(await callTool({ client, name: McpToolName.Delete, args: { id: 'T-1', confirm: 'Remove me' } })).toEqual({
      text: `${MCP_COPY.deleted} T-1 Remove me`,
      isError: undefined,
    });
    expect((await listIn({ client, state: 'open' })).text).not.toContain('Remove me');
    expect(await callTool({ client, name: McpToolName.Delete, args: { id: 'T-1', confirm: 'Remove me' } })).toEqual({
      text: MCP_COPY.taskNotFound('T-1'),
      isError: true,
    });
  });

  test('a confirmation that is not the title is refused and the task stays', async () => {
    const { client } = await connectedProject();
    await addTitled({ client, title: 'Remove me' });
    expect(await callTool({ client, name: McpToolName.Delete, args: { id: 'T-1', confirm: 'remove' } })).toEqual({
      text: MCP_COPY.ruleIssue[RuleIssue.ConfirmationMismatch],
      isError: true,
    });
    expect((await listIn({ client, state: 'open' })).text).toContain('Remove me');
  });

  test('a call without a confirmation never reaches the store', async () => {
    const { client } = await connectedProject();
    await addTitled({ client, title: 'Remove me' });
    const answer = await callTool({ client, name: McpToolName.Delete, args: { id: 'T-1' } });
    expect(answer.isError).toBe(true);
    expect((await listIn({ client, state: 'open' })).text).toContain('Remove me');
  });
});

describe('the projects tool', () => {
  test('lists the projects of the workspace of the key and marks the current one', async () => {
    const { client, projectId } = await connectedProject();
    const siblingId = await seedSiblingProject({ projectId, name: 'Side' });
    const { text } = await callTool({ client, name: McpToolName.Projects, args: {} });
    expect(text).toContain(`${projectId} Project${MCP_COPY.currentProject}`);
    expect(text).toContain(`${siblingId} Side`);
  });

  test('never lists a project of another workspace', async () => {
    const { client } = await connectedProject();
    const { projectId: foreignId } = await seedIssuedKey();
    expect((await callTool({ client, name: McpToolName.Projects, args: {} })).text).not.toContain(foreignId);
  });
});

describe('the move tool', () => {
  test('moves an open task to a sibling project: gone here, added there with its notes and due date', async () => {
    const { client, projectId } = await connectedProject();
    const siblingId = await seedSiblingProject({ projectId, name: 'Side' });
    await callTool({ client, name: McpToolName.Add, args: { tasks: [{ title: 'Carry', notes: 'Heavy', due_date: '2027-03-04' }] } });
    const moved = await callTool({ client, name: McpToolName.Move, args: { id: 'T-1', project: siblingId } });
    const arrival = MCP_COPY.movedTo({ projectName: 'Side', shortId: 'T-1' });
    expect(moved).toEqual({ text: `${MCP_COPY.moved} T-1 Carry${MCP_COPY.dueOn('2027-03-04')} ${arrival}`, isError: undefined });
    expect((await listIn({ client, state: 'open' })).text).not.toContain('Carry');
    const sibling = await clientOfProject(siblingId);
    expect((await listIn({ client: sibling, state: 'open' })).text).toContain(`T-1 Carry${MCP_COPY.dueOn('2027-03-04')}`);
    expect((await callTool({ client: sibling, name: McpToolName.Next, args: {} })).text).toContain('Heavy');
  });

  test('a done task arrives done', async () => {
    const { client, projectId } = await connectedProject();
    const siblingId = await seedSiblingProject({ projectId, name: 'Side' });
    await addTitled({ client, title: 'Finished' });
    await callTool({ client, name: McpToolName.Done, args: { ids: ['T-1'] } });
    await callTool({ client, name: McpToolName.Move, args: { id: 'T-1', project: siblingId } });
    const sibling = await clientOfProject(siblingId);
    expect((await listIn({ client: sibling, state: 'done' })).text).toContain('Finished');
    expect((await listIn({ client: sibling, state: 'open' })).text).not.toContain('Finished');
  });

  test('a project of another workspace, an unknown project and the same project are refused and the task stays', async () => {
    const { client, projectId } = await connectedProject();
    const { projectId: foreignId } = await seedIssuedKey();
    await addTitled({ client, title: 'Stay' });
    const foreign = await callTool({ client, name: McpToolName.Move, args: { id: 'T-1', project: foreignId } });
    const unknown = await callTool({ client, name: McpToolName.Move, args: { id: 'T-1', project: crypto.randomUUID() } });
    const same = await callTool({ client, name: McpToolName.Move, args: { id: 'T-1', project: projectId } });
    expect(foreign).toEqual({ text: MCP_COPY.projectNotInWorkspace, isError: true });
    expect(unknown).toEqual(foreign);
    expect(same).toEqual({ text: MCP_COPY.projectNotInWorkspace, isError: true });
    expect((await listIn({ client, state: 'open' })).text).toContain('Stay');
    expect((await listIn({ client: await clientOfProject(foreignId), state: 'open' })).text).not.toContain('Stay');
  });

  test('a missing task is not found and nothing is added to the destination', async () => {
    const { client, projectId } = await connectedProject();
    const siblingId = await seedSiblingProject({ projectId, name: 'Side' });
    expect(await callTool({ client, name: McpToolName.Move, args: { id: 'T-4', project: siblingId } })).toEqual({
      text: MCP_COPY.taskNotFound('T-4'),
      isError: true,
    });
    expect((await listIn({ client: await clientOfProject(siblingId), state: 'open' })).text).not.toContain('T-1');
  });
});
