import { OWNER_WORKSPACES_MAX, WORKSPACE_PROJECTS_MAX } from '@todz/types';
import { env } from 'cloudflare:workers';
import { describe, expect, test } from 'vitest';
import { ownerCall, signInOwner } from './owner-client';

const CREATED_STATUS = 201;
const CONFLICT_STATUS = 409;
const LIMIT_REACHED = { error: 'limit_reached', message: expect.any(String) };
const CONCURRENT_EXTRA = 5;
const INBOX_COUNT = 1;

type WorkspaceBody = { id: string; projects: { id: string }[] };
type CountRow = { total: number };

function createWorkspace(token: string): Promise<Response> {
  return ownerCall({ method: 'POST', path: '/owner/workspaces', token, body: { name: 'Work' } });
}

function createProject({ token, workspaceId }: { token: string; workspaceId: string }): Promise<Response> {
  return ownerCall({ method: 'POST', path: `/owner/workspaces/${workspaceId}/projects`, token, body: { name: 'Side' } });
}

async function createdWorkspace(token: string): Promise<WorkspaceBody> {
  const response = await createWorkspace(token);
  if (response.status !== CREATED_STATUS) throw new Error(`create workspace answered ${response.status}`);
  return (await response.json<{ workspace: WorkspaceBody }>()).workspace;
}

function inboxOf(workspace: WorkspaceBody): string {
  const [inbox] = workspace.projects;
  if (inbox === undefined) throw new Error('a workspace has an Inbox');
  return inbox.id;
}

async function inSequence(count: number, call: () => Promise<Response>): Promise<number[]> {
  return Array.from({ length: count }).reduce<Promise<number[]>>(
    async (statuses) => [...(await statuses), (await call()).status],
    Promise.resolve([]),
  );
}

async function countOf({ statement, value }: { statement: string; value: string }): Promise<number> {
  const row = await env.DIRECTORY.prepare(statement).bind(value).first<CountRow>();
  if (row === null) throw new Error('count always answers a row');
  return row.total;
}

function workspaceCount(ownerId: string): Promise<number> {
  return countOf({ statement: 'SELECT count(*) AS total FROM workspaces WHERE owner_id = ?', value: ownerId });
}

function projectCount(workspaceId: string): Promise<number> {
  return countOf({ statement: 'SELECT count(*) AS total FROM projects WHERE workspace_id = ?', value: workspaceId });
}

describe('the workspace quota', () => {
  test('the next workspace over the cap is refused and the list keeps the cap', async () => {
    const { token, ownerId } = await signInOwner();
    await inSequence(OWNER_WORKSPACES_MAX, () => createWorkspace(token));
    const refused = await createWorkspace(token);
    expect(refused.status).toBe(CONFLICT_STATUS);
    expect(await refused.json()).toMatchObject(LIMIT_REACHED);
    const listed = await ownerCall({ method: 'GET', path: '/owner/workspaces', token });
    expect((await listed.json<{ workspaces: unknown[] }>()).workspaces).toHaveLength(OWNER_WORKSPACES_MAX);
    expect(await workspaceCount(ownerId)).toBe(OWNER_WORKSPACES_MAX);
  });

  test('concurrent creates stop at the cap', async () => {
    const { token, ownerId } = await signInOwner();
    const responses = await Promise.all(Array.from({ length: OWNER_WORKSPACES_MAX + CONCURRENT_EXTRA }, () => createWorkspace(token)));
    expect(responses.filter(({ status }) => status === CREATED_STATUS)).toHaveLength(OWNER_WORKSPACES_MAX);
    expect(await workspaceCount(ownerId)).toBe(OWNER_WORKSPACES_MAX);
  });

  test("another owner's workspaces do not count", async () => {
    const full = await signInOwner();
    await inSequence(OWNER_WORKSPACES_MAX, () => createWorkspace(full.token));
    const other = await signInOwner();
    expect((await createWorkspace(other.token)).status).toBe(CREATED_STATUS);
  });
});

describe('the project quota', () => {
  test('the next project over the cap, the Inbox counted, is refused', async () => {
    const { token } = await signInOwner();
    const workspace = await createdWorkspace(token);
    await inSequence(WORKSPACE_PROJECTS_MAX - INBOX_COUNT, () => createProject({ token, workspaceId: workspace.id }));
    const refused = await createProject({ token, workspaceId: workspace.id });
    expect(refused.status).toBe(CONFLICT_STATUS);
    expect(await refused.json()).toMatchObject(LIMIT_REACHED);
    expect(await projectCount(workspace.id)).toBe(WORKSPACE_PROJECTS_MAX);
  });

  test('a full workspace leaves another workspace of the owner open', async () => {
    const { token } = await signInOwner();
    const full = await createdWorkspace(token);
    await inSequence(WORKSPACE_PROJECTS_MAX - INBOX_COUNT, () => createProject({ token, workspaceId: full.id }));
    const open = await createdWorkspace(token);
    expect((await createProject({ token, workspaceId: open.id })).status).toBe(CREATED_STATUS);
  });
});
