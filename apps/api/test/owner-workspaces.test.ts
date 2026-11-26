import { INBOX_PROJECT_NAME, NAME_MAX_LENGTH, RuleIssue } from '@todz/types';
import { env } from 'cloudflare:workers';
import { describe, expect, test } from 'vitest';
import { countingEnv } from './counting-namespace';
import { type OwnerCall, ownerCall, recordingEnv, serveOwnerCall, signInOwner } from './owner-client';
import { CLOCK_NOW } from './task-fixtures';

const OK_STATUS = 200;
const CREATED_STATUS = 201;
const BAD_REQUEST_STATUS = 400;
const UNAUTHORIZED_STATUS = 401;
const NOT_FOUND_STATUS = 404;
const CONFLICT_STATUS = 409;
const UNPROCESSABLE_STATUS = 422;
const NOT_FOUND = { error: 'not_found' };
const INVALID_REQUEST = { error: 'invalid_request' };
const INBOX_IS_FIXED = { error: 'inbox_is_fixed' };
const NAME_EMPTY = { error: 'rule_violated', issue: RuleIssue.NameEmpty, index: null };
const NAME_TOO_LONG = { error: 'rule_violated', issue: RuleIssue.NameTooLong, index: null };
const NAME_INVALID = { error: 'rule_violated', issue: RuleIssue.NameInvalid, index: null };

type ProjectBody = { id: string; name: string; is_inbox: boolean; created_at: number };
type WorkspaceBody = { id: string; name: string; created_at: number; last_activity_at: number | null; projects: ProjectBody[] };
type CountRow = { total: number };
type ProjectRow = { name: string; is_inbox: number };
type WorkspaceRow = { name: string };

async function createWorkspace({ token, name }: { token: string; name: string }): Promise<WorkspaceBody> {
  const response = await ownerCall({ method: 'POST', path: '/owner/workspaces', token, body: { name } });
  if (response.status !== CREATED_STATUS) throw new Error(`create workspace answered ${response.status}`);
  return (await response.json<{ workspace: WorkspaceBody }>()).workspace;
}

async function createProject({ token, workspaceId, name }: { token: string; workspaceId: string; name: string }): Promise<ProjectBody> {
  const response = await ownerCall({ method: 'POST', path: `/owner/workspaces/${workspaceId}/projects`, token, body: { name } });
  if (response.status !== CREATED_STATUS) throw new Error(`create project answered ${response.status}`);
  return (await response.json<{ project: ProjectBody }>()).project;
}

async function listWorkspaces(token: string): Promise<WorkspaceBody[]> {
  const response = await ownerCall({ method: 'GET', path: '/owner/workspaces', token });
  expect(response.status).toBe(OK_STATUS);
  return (await response.json<{ workspaces: WorkspaceBody[] }>()).workspaces;
}

function renameWorkspace({ token, workspaceId, body }: { token: string; workspaceId: string; body: unknown }): Promise<Response> {
  return ownerCall({ method: 'PATCH', path: `/owner/workspaces/${workspaceId}`, token, body });
}

function renameProject({ token, projectId, body }: { token: string; projectId: string; body: unknown }): Promise<Response> {
  return ownerCall({ method: 'PATCH', path: `/owner/projects/${projectId}`, token, body });
}

async function storedProject(projectId: string): Promise<ProjectRow> {
  const row = await env.DIRECTORY.prepare('SELECT name, is_inbox FROM projects WHERE id = ?').bind(projectId).first<ProjectRow>();
  if (row === null) throw new Error('the project should exist');
  return row;
}

async function storedWorkspaceName(workspaceId: string): Promise<string> {
  const row = await env.DIRECTORY.prepare('SELECT name FROM workspaces WHERE id = ?').bind(workspaceId).first<WorkspaceRow>();
  if (row === null) throw new Error('the workspace should exist');
  return row.name;
}

async function ownedRows({ table, ownerId }: { table: 'workspaces' | 'projects'; ownerId: string }): Promise<number> {
  const statement =
    table === 'workspaces'
      ? 'SELECT count(*) AS total FROM workspaces WHERE owner_id = ?'
      : 'SELECT count(*) AS total FROM projects JOIN workspaces ON workspaces.id = projects.workspace_id WHERE workspaces.owner_id = ?';
  const row = await env.DIRECTORY.prepare(statement).bind(ownerId).first<CountRow>();
  if (row === null) throw new Error('count always answers a row');
  return row.total;
}

describe('GET /owner/workspaces', () => {
  test('a new owner has no workspaces', async () => {
    const { token } = await signInOwner();
    const response = await ownerCall({ method: 'GET', path: '/owner/workspaces', token });
    expect(response.status).toBe(OK_STATUS);
    expect(await response.json()).toEqual({ workspaces: [] });
  });

  test('lists workspaces oldest first, each with its Inbox first and then its projects oldest first', async () => {
    const { token } = await signInOwner();
    const first = await createWorkspace({ token, name: 'First' });
    const second = await createWorkspace({ token, name: 'Second' });
    const launch = await createProject({ token, workspaceId: first.id, name: 'Launch' });
    const garden = await createProject({ token, workspaceId: first.id, name: 'Garden' });
    const workspaces = await listWorkspaces(token);
    expect(workspaces.map((workspace) => workspace.name)).toEqual(['First', 'Second']);
    expect(workspaces[0]?.projects.map((project) => project.id)).toEqual([first.projects[0]?.id, launch.id, garden.id]);
    expect(workspaces[1]?.projects.map((project) => project.name)).toEqual([INBOX_PROJECT_NAME]);
    expect(workspaces[1]?.id).toBe(second.id);
  });

  test('lists the Inbox first even when a regular project is older', async () => {
    const { token } = await signInOwner();
    const workspace = await createWorkspace({ token, name: 'Work' });
    const inboxId = workspace.projects[0]?.id;
    await env.DIRECTORY.prepare('INSERT INTO projects (id, workspace_id, name, is_inbox, created_at) VALUES (?, ?, ?, 0, ?)')
      .bind(crypto.randomUUID(), workspace.id, 'Older than the Inbox', 0)
      .run();
    const [listed] = await listWorkspaces(token);
    expect(listed?.projects.map((project) => project.name)).toEqual([INBOX_PROJECT_NAME, 'Older than the Inbox']);
    expect(listed?.projects[0]?.id).toBe(inboxId);
  });

  test('reads with two queries however many workspaces there are', async () => {
    const { token } = await signInOwner();
    await Promise.all(['A', 'B', 'C'].map((name) => createWorkspace({ token, name })));
    const { workerEnv, statements } = recordingEnv();
    const response = await serveOwnerCall({ call: { method: 'GET', path: '/owner/workspaces', token }, now: Date.now(), workerEnv });
    expect(response.status).toBe(OK_STATUS);
    const listing = statements.filter((statement) => /FROM (workspaces|projects)/.test(statement));
    expect(listing).toHaveLength(2);
  });

  test('never lists the workspaces or projects of another owner', async () => {
    const alice = await signInOwner();
    const bob = await signInOwner();
    await createWorkspace({ token: alice.token, name: 'Alice only' });
    expect(await listWorkspaces(bob.token)).toEqual([]);
  });
});

describe('POST /owner/workspaces', () => {
  test('creates the workspace with a trimmed name and its Inbox', async () => {
    const { token, ownerId } = await signInOwner();
    const response = await ownerCall({ method: 'POST', path: '/owner/workspaces', token, body: { name: '  Logic Bit ' } });
    expect(response.status).toBe(CREATED_STATUS);
    const { workspace } = await response.json<{ workspace: WorkspaceBody }>();
    expect(workspace).toEqual({
      id: workspace.id,
      name: 'Logic Bit',
      created_at: workspace.created_at,
      last_activity_at: null,
      projects: [{ id: workspace.projects[0]?.id, name: INBOX_PROJECT_NAME, is_inbox: true, created_at: workspace.created_at }],
    });
    expect(await storedWorkspaceName(workspace.id)).toBe('Logic Bit');
    expect(await ownedRows({ table: 'workspaces', ownerId })).toBe(1);
    expect(await ownedRows({ table: 'projects', ownerId })).toBe(1);
    expect((await listWorkspaces(token))[0]).toEqual(workspace);
  });

  test('stamps the time of the request on the workspace and its Inbox', async () => {
    const { token } = await signInOwner();
    const response = await serveOwnerCall({
      call: { method: 'POST', path: '/owner/workspaces', token, body: { name: 'Timed' } },
      now: CLOCK_NOW,
    });
    expect(response.status).toBe(CREATED_STATUS);
    const { workspace } = await response.json<{ workspace: WorkspaceBody }>();
    expect(workspace.created_at).toBe(CLOCK_NOW);
    expect(workspace.projects.map((project) => project.created_at)).toEqual([CLOCK_NOW]);
  });

  test.each([
    ['an empty name', '', NAME_EMPTY],
    ['a blank name', '   ', NAME_EMPTY],
    ['a name of 81 characters', 'a'.repeat(NAME_MAX_LENGTH + 1), NAME_TOO_LONG],
    ['a name with a control character', 'bad\u0000name', NAME_INVALID],
  ])('%s answers 422 with the rule issue and creates nothing', async (_name, name, expected) => {
    const { token, ownerId } = await signInOwner();
    const response = await ownerCall({ method: 'POST', path: '/owner/workspaces', token, body: { name } });
    expect(response.status).toBe(UNPROCESSABLE_STATUS);
    expect(await response.json()).toEqual(expected);
    expect(await ownedRows({ table: 'workspaces', ownerId })).toBe(0);
    expect(await ownedRows({ table: 'projects', ownerId })).toBe(0);
  });

  test('a name of exactly 80 characters is accepted', async () => {
    const { token } = await signInOwner();
    const workspace = await createWorkspace({ token, name: 'a'.repeat(NAME_MAX_LENGTH) });
    expect(workspace.name).toHaveLength(NAME_MAX_LENGTH);
  });

  test.each([
    ['a body that is not JSON', { rawBody: 'not json' }],
    ['a missing name', { body: {} }],
    ['a numeric name', { body: { name: 5 } }],
    ['a null name', { body: { name: null } }],
  ])('%s answers 400 and creates nothing', async (_name, payload) => {
    const { token, ownerId } = await signInOwner();
    const response = await ownerCall({ method: 'POST', path: '/owner/workspaces', token, ...payload });
    expect(response.status).toBe(BAD_REQUEST_STATUS);
    expect(await response.json()).toEqual(INVALID_REQUEST);
    expect(await ownedRows({ table: 'workspaces', ownerId })).toBe(0);
  });
});

describe('PATCH /owner/workspaces/:workspaceId', () => {
  test('renames the workspace with a trimmed name and answers it with its projects', async () => {
    const { token } = await signInOwner();
    const workspace = await createWorkspace({ token, name: 'Before' });
    await createProject({ token, workspaceId: workspace.id, name: 'Kept' });
    const response = await renameWorkspace({ token, workspaceId: workspace.id, body: { name: '  After ' } });
    expect(response.status).toBe(OK_STATUS);
    const { workspace: renamed } = await response.json<{ workspace: WorkspaceBody }>();
    expect(renamed).toMatchObject({ id: workspace.id, name: 'After', created_at: workspace.created_at });
    expect(renamed.projects.map((project) => project.name)).toEqual([INBOX_PROJECT_NAME, 'Kept']);
    expect(await storedWorkspaceName(workspace.id)).toBe('After');
  });

  test('a rule violation answers 422 and keeps the name', async () => {
    const { token } = await signInOwner();
    const workspace = await createWorkspace({ token, name: 'Kept' });
    const response = await renameWorkspace({ token, workspaceId: workspace.id, body: { name: '' } });
    expect(response.status).toBe(UNPROCESSABLE_STATUS);
    expect(await response.json()).toEqual(NAME_EMPTY);
    expect(await storedWorkspaceName(workspace.id)).toBe('Kept');
  });

  test('a body that fails its schema answers 400 even for a workspace that does not exist', async () => {
    const { token } = await signInOwner();
    const response = await renameWorkspace({ token, workspaceId: crypto.randomUUID(), body: { name: 5 } });
    expect(response.status).toBe(BAD_REQUEST_STATUS);
    expect(await response.json()).toEqual(INVALID_REQUEST);
  });

  test('an unknown workspace answers 404 not_found, before the name rules', async () => {
    const { token } = await signInOwner();
    const valid = await renameWorkspace({ token, workspaceId: crypto.randomUUID(), body: { name: 'Fine' } });
    const invalid = await renameWorkspace({ token, workspaceId: crypto.randomUUID(), body: { name: '' } });
    expect([valid.status, invalid.status]).toEqual([NOT_FOUND_STATUS, NOT_FOUND_STATUS]);
    expect(await valid.json()).toEqual(NOT_FOUND);
    expect(await invalid.json()).toEqual(NOT_FOUND);
  });
});

describe('POST /owner/workspaces/:workspaceId/projects', () => {
  test('creates a regular project with a trimmed name after the Inbox', async () => {
    const { token } = await signInOwner();
    const workspace = await createWorkspace({ token, name: 'Work' });
    const response = await ownerCall({
      method: 'POST',
      path: `/owner/workspaces/${workspace.id}/projects`,
      token,
      body: { name: '  Launch ' },
    });
    expect(response.status).toBe(CREATED_STATUS);
    const { project } = await response.json<{ project: ProjectBody }>();
    expect(project).toEqual({ id: project.id, name: 'Launch', is_inbox: false, created_at: project.created_at });
    expect((await listWorkspaces(token))[0]?.projects.map((listed) => listed.id)).toEqual([workspace.projects[0]?.id, project.id]);
  });

  test('a regular project may be named Inbox and is still not the Inbox', async () => {
    const { token } = await signInOwner();
    const workspace = await createWorkspace({ token, name: 'Work' });
    const project = await createProject({ token, workspaceId: workspace.id, name: INBOX_PROJECT_NAME });
    expect(project.is_inbox).toBe(false);
    expect(await storedProject(project.id)).toEqual({ name: INBOX_PROJECT_NAME, is_inbox: 0 });
    expect((await listWorkspaces(token))[0]?.projects.map((listed) => listed.is_inbox)).toEqual([true, false]);
  });

  test('a rule violation answers 422 and creates nothing', async () => {
    const { token, ownerId } = await signInOwner();
    const workspace = await createWorkspace({ token, name: 'Work' });
    const response = await ownerCall({ method: 'POST', path: `/owner/workspaces/${workspace.id}/projects`, token, body: { name: '' } });
    expect(response.status).toBe(UNPROCESSABLE_STATUS);
    expect(await response.json()).toEqual(NAME_EMPTY);
    expect(await ownedRows({ table: 'projects', ownerId })).toBe(1);
  });

  test('a bad body answers 400 and an unknown workspace answers 404 not_found', async () => {
    const { token } = await signInOwner();
    const unknown = crypto.randomUUID();
    const badBody = await ownerCall({ method: 'POST', path: `/owner/workspaces/${unknown}/projects`, token, body: {} });
    expect(badBody.status).toBe(BAD_REQUEST_STATUS);
    const missing = await ownerCall({ method: 'POST', path: `/owner/workspaces/${unknown}/projects`, token, body: { name: 'Fine' } });
    expect(missing.status).toBe(NOT_FOUND_STATUS);
    expect(await missing.json()).toEqual(NOT_FOUND);
  });
});

describe('PATCH /owner/projects/:projectId', () => {
  test('renames a regular project with a trimmed name', async () => {
    const { token } = await signInOwner();
    const workspace = await createWorkspace({ token, name: 'Work' });
    const project = await createProject({ token, workspaceId: workspace.id, name: 'Before' });
    const response = await renameProject({ token, projectId: project.id, body: { name: ' After  ' } });
    expect(response.status).toBe(OK_STATUS);
    expect(await response.json()).toEqual({ project: { ...project, name: 'After' } });
    expect(await storedProject(project.id)).toEqual({ name: 'After', is_inbox: 0 });
  });

  test('renaming a project to Inbox keeps it a regular project', async () => {
    const { token } = await signInOwner();
    const workspace = await createWorkspace({ token, name: 'Work' });
    const project = await createProject({ token, workspaceId: workspace.id, name: 'Before' });
    const response = await renameProject({ token, projectId: project.id, body: { name: INBOX_PROJECT_NAME } });
    expect(response.status).toBe(OK_STATUS);
    expect(await response.json()).toEqual({ project: { ...project, name: INBOX_PROJECT_NAME, is_inbox: false } });
    expect(await storedProject(project.id)).toEqual({ name: INBOX_PROJECT_NAME, is_inbox: 0 });
  });

  test('the Inbox answers 409 inbox_is_fixed whatever the name and keeps its name', async () => {
    const { token } = await signInOwner();
    const workspace = await createWorkspace({ token, name: 'Work' });
    const inboxId = workspace.projects[0]?.id;
    if (inboxId === undefined) throw new Error('a workspace has an Inbox');
    const renamed = await renameProject({ token, projectId: inboxId, body: { name: 'Other' } });
    const emptied = await renameProject({ token, projectId: inboxId, body: { name: '' } });
    expect([renamed.status, emptied.status]).toEqual([CONFLICT_STATUS, CONFLICT_STATUS]);
    expect(await renamed.json()).toEqual(INBOX_IS_FIXED);
    expect(await emptied.json()).toEqual(INBOX_IS_FIXED);
    expect(await storedProject(inboxId)).toEqual({ name: INBOX_PROJECT_NAME, is_inbox: 1 });
  });

  test('a rule violation answers 422 and keeps the name', async () => {
    const { token } = await signInOwner();
    const workspace = await createWorkspace({ token, name: 'Work' });
    const project = await createProject({ token, workspaceId: workspace.id, name: 'Kept' });
    const response = await renameProject({ token, projectId: project.id, body: { name: 'a'.repeat(NAME_MAX_LENGTH + 1) } });
    expect(response.status).toBe(UNPROCESSABLE_STATUS);
    expect(await response.json()).toEqual(NAME_TOO_LONG);
    expect((await storedProject(project.id)).name).toBe('Kept');
  });

  test('a bad body answers 400 and an unknown project answers 404 not_found', async () => {
    const { token } = await signInOwner();
    const unknown = crypto.randomUUID();
    expect((await renameProject({ token, projectId: unknown, body: { name: 5 } })).status).toBe(BAD_REQUEST_STATUS);
    const missing = await renameProject({ token, projectId: unknown, body: { name: 'Fine' } });
    expect(missing.status).toBe(NOT_FOUND_STATUS);
    expect(await missing.json()).toEqual(NOT_FOUND);
  });
});

describe('another owner reaching for workspaces and projects', () => {
  async function ownerAWorkspace() {
    const alice = await signInOwner();
    const bob = await signInOwner();
    const workspace = await createWorkspace({ token: alice.token, name: 'Alice work' });
    const project = await createProject({ token: alice.token, workspaceId: workspace.id, name: 'Alice project' });
    const inboxId = workspace.projects[0]?.id;
    if (inboxId === undefined) throw new Error('a workspace has an Inbox');
    return { alice, bob, workspace, project, inboxId };
  }

  test('answer exactly what ids that never existed answer, and open no Durable Object', async () => {
    const { bob, workspace, project, inboxId } = await ownerAWorkspace();
    const { countedEnv, addressingCalls } = countingEnv();
    const reachingCalls = ({ workspaceId, projectId }: { workspaceId: string; projectId: string }): OwnerCall[] => [
      { method: 'PATCH', path: `/owner/workspaces/${workspaceId}`, token: bob.token, body: { name: 'Taken' } },
      { method: 'POST', path: `/owner/workspaces/${workspaceId}/projects`, token: bob.token, body: { name: 'Taken' } },
      { method: 'PATCH', path: `/owner/projects/${projectId}`, token: bob.token, body: { name: 'Taken' } },
    ];
    const answersOf = (calls: OwnerCall[]) =>
      Promise.all(
        calls.map(async (call) => {
          const response = await serveOwnerCall({ call, now: Date.now(), workerEnv: countedEnv });
          return { status: response.status, body: await response.text() };
        }),
      );
    const foreign = await answersOf([project.id, inboxId].flatMap((projectId) => reachingCalls({ workspaceId: workspace.id, projectId })));
    const absent = await answersOf(
      [crypto.randomUUID(), crypto.randomUUID()].flatMap((id) => reachingCalls({ workspaceId: id, projectId: id })),
    );
    expect(foreign).toHaveLength(absent.length);
    expect(foreign).toEqual(absent);
    expect(foreign.every((answer) => answer.status === NOT_FOUND_STATUS && answer.body === JSON.stringify(NOT_FOUND))).toBe(true);
    expect(addressingCalls).toEqual([]);
  });

  test('change nothing of the other owner', async () => {
    const { bob, workspace, project, inboxId } = await ownerAWorkspace();
    await renameWorkspace({ token: bob.token, workspaceId: workspace.id, body: { name: 'Taken' } });
    await renameProject({ token: bob.token, projectId: project.id, body: { name: 'Taken' } });
    await renameProject({ token: bob.token, projectId: inboxId, body: { name: 'Taken' } });
    await ownerCall({ method: 'POST', path: `/owner/workspaces/${workspace.id}/projects`, token: bob.token, body: { name: 'Taken' } });
    expect(await storedWorkspaceName(workspace.id)).toBe('Alice work');
    expect(await storedProject(project.id)).toEqual({ name: 'Alice project', is_inbox: 0 });
    expect(await storedProject(inboxId)).toEqual({ name: INBOX_PROJECT_NAME, is_inbox: 1 });
    expect(await ownedRows({ table: 'projects', ownerId: bob.ownerId })).toBe(0);
  });
});

describe('workspace and project routes without a session', () => {
  test.each([
    ['GET', '/owner/workspaces'],
    ['POST', '/owner/workspaces'],
    ['PATCH', '/owner/workspaces/any'],
    ['POST', '/owner/workspaces/any/projects'],
    ['PATCH', '/owner/projects/any'],
  ])('%s %s answers 401 with an empty body', async (method, path) => {
    const response = await ownerCall({ method, path, rawBody: method === 'GET' ? undefined : '{"name":"x"}' });
    expect(response.status).toBe(UNAUTHORIZED_STATUS);
    expect(await response.text()).toBe('');
  });
});
