import type { Client } from '@modelcontextprotocol/client';
import { PROJECT_OPEN_TASKS_MAX, RuleIssue, TaskState } from '@todz/types';
import { env } from 'cloudflare:workers';
import { describe, expect, test } from 'vitest';
import { MCP_COPY, McpToolName } from '../src/mcp-copy';
import { MOVE_KEY_PREFIX } from '../src/move-task';
import { seedProjectToken, seedProjectWithToken, seedSiblingProject } from './directory-seed';
import { ClientEra, callTool, connectClient } from './mcp-client';
import { AGENT_ACTOR, CLOCK_NOW } from './task-fixtures';

type ConnectedProject = { client: Client; projectId: string };

async function connectedProject(): Promise<ConnectedProject> {
  const { projectId, token } = await seedProjectWithToken();
  return { client: await connectClient({ era: ClientEra.Modern, token }), projectId };
}

async function clientOfProject(projectId: string): Promise<Client> {
  return connectClient({ era: ClientEra.Modern, token: await seedProjectToken({ projectId }) });
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

describe('the show tool', () => {
  test('shows the title, due date, state and notes of one task', async () => {
    const { client } = await connectedProject();
    await callTool({
      client,
      name: McpToolName.Add,
      args: { tasks: [{ title: 'Plan', notes: 'Bring the deck', due_date: '2027-01-02' }] },
    });
    expect(await callTool({ client, name: McpToolName.Show, args: { id: 'T-1' } })).toEqual({
      text: `T-1 Plan${MCP_COPY.dueOn('2027-01-02')}\n\n${MCP_COPY.stateLine(TaskState.Open)}\n\nBring the deck`,
      isError: undefined,
    });
    await callTool({ client, name: McpToolName.Done, args: { ids: ['T-1'] } });
    expect((await callTool({ client, name: McpToolName.Show, args: { id: 'T-1' } })).text).toContain(MCP_COPY.stateLine(TaskState.Done));
  });

  test('a bad id and a missing task are errors, and a deleted task is gone', async () => {
    const { client } = await connectedProject();
    await addTitled({ client, title: 'Remove me' });
    await callTool({ client, name: McpToolName.Delete, args: { id: 'T-1', confirm: 'Remove me' } });
    expect(await callTool({ client, name: McpToolName.Show, args: { id: 'T-1' } })).toEqual({
      text: MCP_COPY.taskNotFound('T-1'),
      isError: true,
    });
    expect(await callTool({ client, name: McpToolName.Show, args: { id: 'x' } })).toEqual({ text: MCP_COPY.taskIdInvalid, isError: true });
  });
});

describe('the history tool', () => {
  test('lists what happened oldest first with who did it, the fields changed and the completion note', async () => {
    const { client } = await connectedProject();
    await addTitled({ client, title: 'Plan' });
    await callTool({ client, name: McpToolName.Update, args: { id: 'T-1', title: 'Plan it', due_date: '2027-01-02' } });
    await callTool({ client, name: McpToolName.Done, args: { ids: ['T-1'], note: 'Shipped' } });
    const { text } = await callTool({ client, name: McpToolName.History, args: { id: 'T-1' } });
    const [created, updated, completed] = text.split('\n');
    expect(created).toMatch(/^\d{4}-\d{2}-\d{2}T[\d:.]+Z created by Claude Code$|^\d{4}-\d{2}-\d{2}T[\d:.]+Z created by Codex$/);
    expect(updated).toMatch(/Z updated \(title, due_date\) by /);
    expect(completed).toMatch(/Z completed by .*: Shipped$/);
  });

  test('a missing task is an error', async () => {
    const { client } = await connectedProject();
    expect(await callTool({ client, name: McpToolName.History, args: { id: 'T-4' } })).toEqual({
      text: MCP_COPY.taskNotFound('T-4'),
      isError: true,
    });
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
    const { projectId: foreignId } = await seedProjectWithToken();
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
    const { projectId: foreignId } = await seedProjectWithToken();
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

  test('a move whose first run stopped after the add finishes on a retry without a second copy', async () => {
    const { client, projectId } = await connectedProject();
    const siblingId = await seedSiblingProject({ projectId, name: 'Side' });
    await addTitled({ client, title: 'Carry' });
    const destination = env.PROJECT_STORE.get(env.PROJECT_STORE.idFromName(siblingId));
    const stopped = await destination.addTasks({
      openTasksMax: PROJECT_OPEN_TASKS_MAX,
      actor: AGENT_ACTOR,
      drafts: [{ title: 'Carry', notes: null, dueDate: null, idempotencyKey: `${MOVE_KEY_PREFIX}${projectId}:1` }],
    });
    expect(stopped.ok).toBe(true);
    const moved = await callTool({ client, name: McpToolName.Move, args: { id: 'T-1', project: siblingId } });
    expect(moved.isError).toBeUndefined();
    expect((await listIn({ client, state: 'open' })).text).not.toContain('Carry');
    expect((await listIn({ client: await clientOfProject(siblingId), state: 'open' })).text).toBe('Open tasks: 1 of 1\nT-1 Carry');
  });

  test('the arrival names its source project in history and in show', async () => {
    const { client, projectId } = await connectedProject();
    const siblingId = await seedSiblingProject({ projectId, name: 'Side' });
    await addTitled({ client, title: 'Carry' });
    await callTool({ client, name: McpToolName.Move, args: { id: 'T-1', project: siblingId } });
    const sibling = await clientOfProject(siblingId);
    const history = await callTool({ client: sibling, name: McpToolName.History, args: { id: 'T-1' } });
    expect(history.text).toMatch(new RegExp(`created by .*${MCP_COPY.historyNote(MCP_COPY.movedFrom('Project'))}$`));
    expect((await callTool({ client: sibling, name: McpToolName.Show, args: { id: 'T-1' } })).text).toContain(
      MCP_COPY.movedFrom('Project'),
    );
    const original = await callTool({ client: sibling, name: McpToolName.Add, args: { tasks: [{ title: 'Own' }] } });
    expect(original.isError).toBeUndefined();
    expect((await callTool({ client: sibling, name: McpToolName.Show, args: { id: 'T-2' } })).text).not.toContain(
      MCP_COPY.movedFrom('Project'),
    );
  });

  test('a replayed arrival whose title differs from the source is refused and the source stays', async () => {
    const { client, projectId } = await connectedProject();
    const siblingId = await seedSiblingProject({ projectId, name: 'Side' });
    await addTitled({ client, title: 'Carry' });
    const destination = env.PROJECT_STORE.get(env.PROJECT_STORE.idFromName(siblingId));
    await destination.addTasks({
      openTasksMax: PROJECT_OPEN_TASKS_MAX,
      actor: AGENT_ACTOR,
      drafts: [{ title: 'Other', notes: null, dueDate: null, idempotencyKey: `${MOVE_KEY_PREFIX}${projectId}:1` }],
    });
    expect(await callTool({ client, name: McpToolName.Move, args: { id: 'T-1', project: siblingId } })).toEqual({
      text: MCP_COPY.ruleIssue[RuleIssue.MoveConflict],
      isError: true,
    });
    expect((await listIn({ client, state: 'open' })).text).toContain('Carry');
  });

  test('an add with a key in the space of moves is refused', async () => {
    const { client } = await connectedProject();
    const answer = await callTool({
      client,
      name: McpToolName.Add,
      args: { tasks: [{ title: 'Forged', idempotency_key: `${MOVE_KEY_PREFIX}${crypto.randomUUID()}:1` }] },
    });
    expect(answer.isError).toBe(true);
    expect((await listIn({ client, state: 'open' })).text).not.toContain('Forged');
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
