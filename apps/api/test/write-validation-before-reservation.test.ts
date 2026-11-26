import { formatShortId } from '@todz/core';
import { TASK_BATCH_MAX_SIZE, TASK_NOTES_MAX_LENGTH } from '@todz/types';
import { env } from 'cloudflare:workers';
import { describe, expect, test } from 'vitest';
import { seedIssuedKey } from './directory-seed';
import { ClientEra, callTool, connectClient } from './mcp-client';
import { type OwnedProject, createOwnedProject, issueMcpKey, projectCall } from './owner-client';

const UNPROCESSABLE_STATUS = 422;
const OVER_BATCH_SIZE = TASK_BATCH_MAX_SIZE + 1;
const OVER_NOTES = 'n'.repeat(TASK_NOTES_MAX_LENGTH + 1);

type UsageRow = { writes: number; bytes: number };

async function usageOf(ownerId: string): Promise<UsageRow> {
  const row = await env.DIRECTORY.prepare(
    'SELECT COALESCE(SUM(writes), 0) AS writes, COALESCE(SUM(bytes), 0) AS bytes FROM owner_usage WHERE owner_id = ?',
  )
    .bind(ownerId)
    .first<UsageRow>();
  if (row === null) throw new Error('an aggregate always answers a row');
  return row;
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

function draftsOf({ count, notes }: { count: number; notes?: string }): { title: string; notes?: string }[] {
  return Array.from({ length: count }, (_, index) => ({ title: `Draft ${index}`, notes }));
}

async function addedTaskNumber(project: OwnedProject): Promise<number> {
  const response = await projectCall({ project, method: 'POST', path: '/tasks', body: { tasks: [{ title: 'Seed' }] } });
  const { tasks } = await response.json<{ tasks: { task: { number: number } }[] }>();
  const [added] = tasks;
  if (added === undefined) throw new Error('a task was added');
  return added.task.number;
}

describe('the owner API validates a write before it reserves', () => {
  test.each([
    { name: 'an over-size batch', body: { tasks: draftsOf({ count: OVER_BATCH_SIZE }) } },
    { name: 'a batch with over-limit notes', body: { tasks: draftsOf({ count: TASK_BATCH_MAX_SIZE, notes: OVER_NOTES }) } },
  ])('$name adds nothing and reserves nothing', async ({ body }) => {
    const project = await createOwnedProject();
    const response = await projectCall({ project, method: 'POST', path: '/tasks', body });
    expect(response.status).toBe(UNPROCESSABLE_STATUS);
    expect(await usageOf(project.ownerId)).toEqual({ writes: 0, bytes: 0 });
  });

  test('an update with over-limit notes reserves nothing beyond the seed', async () => {
    const project = await createOwnedProject();
    const number = await addedTaskNumber(project);
    const before = await usageOf(project.ownerId);
    const response = await projectCall({ project, method: 'PATCH', path: `/tasks/${number}`, body: { notes: OVER_NOTES } });
    expect(response.status).toBe(UNPROCESSABLE_STATUS);
    expect(await usageOf(project.ownerId)).toEqual(before);
  });

  test.each([
    { name: 'complete', path: '/tasks/complete' },
    { name: 'reopen', path: '/tasks/reopen' },
  ])('an over-size $name batch reserves nothing', async ({ path }) => {
    const project = await createOwnedProject();
    const numbers = Array.from({ length: OVER_BATCH_SIZE }, (_, index) => index + 1);
    const response = await projectCall({ project, method: 'POST', path, body: { numbers } });
    expect(response.status).toBe(UNPROCESSABLE_STATUS);
    expect(await usageOf(project.ownerId)).toEqual({ writes: 0, bytes: 0 });
  });
});

describe('MCP validates a write before it reserves', () => {
  test.each([
    { name: 'an over-size batch', tasks: draftsOf({ count: OVER_BATCH_SIZE }) },
    { name: 'a batch with over-limit notes', tasks: draftsOf({ count: TASK_BATCH_MAX_SIZE, notes: OVER_NOTES }) },
  ])('$name is an error answer and reserves nothing', async ({ tasks }) => {
    const { projectId, key } = await seedIssuedKey();
    const client = await connectClient({ era: ClientEra.Modern, key });
    const answer = await callTool({ client, name: 'add', args: { tasks } });
    expect(answer.isError).toBe(true);
    expect(await usageOf(await ownerOfProject(projectId))).toEqual({ writes: 0, bytes: 0 });
  });

  test('an over-size done batch is an error answer and reserves nothing', async () => {
    const project = await createOwnedProject();
    const key = await issueMcpKey({ token: project.token, projectId: project.projectId });
    const client = await connectClient({ era: ClientEra.Modern, key });
    const ids = Array.from({ length: OVER_BATCH_SIZE }, (_, index) => formatShortId(index + 1));
    const answer = await callTool({ client, name: 'done', args: { ids } });
    expect(answer.isError).toBe(true);
    expect(await usageOf(project.ownerId)).toEqual({ writes: 0, bytes: 0 });
  });
});
