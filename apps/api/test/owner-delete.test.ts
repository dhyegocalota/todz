import { INBOX_PROJECT_NAME } from '@todz/types';
import { env, exports } from 'cloudflare:workers';
import { runInDurableObject } from 'cloudflare:test';
import { describe, expect, test } from 'vitest';
import { digestCredential } from '../src/credential-digest';
import { deleteOwnerProject, deleteOwnerWorkspace } from '../src/directory-workspaces';
import { openMcpSession } from '../src/mcp-sessions';
import { countingEnv } from './counting-namespace';
import type { Env } from '../src/env';
import type { ProjectStore } from '../src/project-store';
import { ownerCall, serveOwnerCall, signInOwner, workerEnvWith } from './owner-client';
import { CLOCK_NOW } from './task-fixtures';

const OK_STATUS = 200;
const CREATED_STATUS = 201;
const NO_CONTENT_STATUS = 204;
const UNAUTHORIZED_STATUS = 401;
const NOT_FOUND_STATUS = 404;
const CONFLICT_STATUS = 409;
const NOT_FOUND = { error: 'not_found' };
const INBOX_IS_FIXED = { error: 'inbox_is_fixed' };
const MCP_URL = 'http://localhost:8787/mcp';

type ProjectBody = { id: string; name: string; is_inbox: boolean; created_at: number };
type WorkspaceBody = { id: string; name: string; created_at: number; projects: ProjectBody[] };
type IssuedBody = { key: { id: string }; secret: string };
type CountRow = { total: number };

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

function inboxOf(workspace: WorkspaceBody): ProjectBody {
  const inbox = workspace.projects.find((project) => project.is_inbox);
  if (inbox === undefined) throw new Error('a workspace has an Inbox');
  return inbox;
}

async function issueKey({ token, projectId }: { token: string; projectId: string }): Promise<string> {
  const response = await ownerCall({ method: 'POST', path: `/owner/projects/${projectId}/keys`, token });
  if (response.status !== CREATED_STATUS) throw new Error(`issue key answered ${response.status}`);
  return (await response.json<IssuedBody>()).secret;
}

async function listWorkspaces(token: string): Promise<WorkspaceBody[]> {
  const response = await ownerCall({ method: 'GET', path: '/owner/workspaces', token });
  expect(response.status).toBe(OK_STATUS);
  return (await response.json<{ workspaces: WorkspaceBody[] }>()).workspaces;
}

function deleteWorkspace({ token, workspaceId }: { token: string; workspaceId: string }): Promise<Response> {
  return ownerCall({ method: 'DELETE', path: `/owner/workspaces/${workspaceId}`, token });
}

function deleteProject({ token, projectId }: { token: string; projectId: string }): Promise<Response> {
  return ownerCall({ method: 'DELETE', path: `/owner/projects/${projectId}`, token });
}

function mcpCall(secret: string): Promise<Response> {
  return exports.default.fetch(MCP_URL, { method: 'POST', headers: { Authorization: `Bearer ${secret}` } });
}

function mcpSessionCall({ secret, sessionId }: { secret: string; sessionId: string }): Promise<Response> {
  return exports.default.fetch(MCP_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${secret}`, 'Mcp-Session-Id': sessionId },
  });
}

async function countRows({ sql, bindings }: { sql: string; bindings: string[] }): Promise<number> {
  const row = await env.DIRECTORY.prepare(sql)
    .bind(...bindings)
    .first<CountRow>();
  if (row === null) throw new Error('count always answers a row');
  return row.total;
}

async function storedProjectRows(projectIds: string[]): Promise<number> {
  return countRows({
    sql: `SELECT count(*) AS total FROM projects WHERE id IN (${projectIds.map(() => '?').join(', ')})`,
    bindings: projectIds,
  });
}

async function storedWorkspaceRows(workspaceId: string): Promise<number> {
  return countRows({ sql: 'SELECT count(*) AS total FROM workspaces WHERE id = ?', bindings: [workspaceId] });
}

async function storedKeyRows(projectId: string): Promise<number> {
  return countRows({ sql: 'SELECT count(*) AS total FROM project_keys WHERE project_id = ?', bindings: [projectId] });
}

async function projectStoreTableCount(projectId: string): Promise<number> {
  const stub = env.PROJECT_STORE.get(env.PROJECT_STORE.idFromName(projectId));
  return runInDurableObject(stub, (_instance, state) => {
    const tables = state.storage.sql.exec("SELECT name FROM sqlite_schema WHERE type = 'table'").toArray();
    return tables.length;
  });
}

describe('DELETE /owner/workspaces/:workspaceId', () => {
  test('answers 204 and removes the workspace with its Inbox, its projects and their keys', async () => {
    const { token } = await signInOwner();
    const doomed = await createWorkspace({ token, name: 'Doomed' });
    const launch = await createProject({ token, workspaceId: doomed.id, name: 'Launch' });
    await issueKey({ token, projectId: launch.id });
    const kept = await createWorkspace({ token, name: 'Kept' });
    const projectIds = [...doomed.projects, launch].map((project) => project.id);
    const response = await deleteWorkspace({ token, workspaceId: doomed.id });
    expect(response.status).toBe(NO_CONTENT_STATUS);
    expect(await response.text()).toBe('');
    expect(await storedWorkspaceRows(doomed.id)).toBe(0);
    expect(await storedProjectRows(projectIds)).toBe(0);
    expect(await storedKeyRows(launch.id)).toBe(0);
    expect((await listWorkspaces(token)).map((workspace) => workspace.id)).toEqual([kept.id]);
  });

  test('revokes every MCP key of the deleted projects at once: the key answers 401 right after', async () => {
    const { token } = await signInOwner();
    const workspace = await createWorkspace({ token, name: 'Keyed' });
    const secret = await issueKey({ token, projectId: inboxOf(workspace).id });
    expect((await mcpCall(secret)).status).not.toBe(UNAUTHORIZED_STATUS);
    await deleteWorkspace({ token, workspaceId: workspace.id });
    const refused = await mcpCall(secret);
    expect(refused.status).toBe(UNAUTHORIZED_STATUS);
    expect(await refused.text()).toBe('');
  });

  test('wipes the storage of every deleted project', async () => {
    const { token } = await signInOwner();
    const workspace = await createWorkspace({ token, name: 'Wiped' });
    const inboxId = inboxOf(workspace).id;
    expect(await projectStoreTableCount(inboxId)).toBeGreaterThan(0);
    await deleteWorkspace({ token, workspaceId: workspace.id });
    expect(await projectStoreTableCount(inboxId)).toBe(0);
  });

  test('deleting the only workspace leaves the owner with none', async () => {
    const { token } = await signInOwner();
    const only = await createWorkspace({ token, name: 'Only' });
    const response = await deleteWorkspace({ token, workspaceId: only.id });
    expect(response.status).toBe(NO_CONTENT_STATUS);
    expect(await listWorkspaces(token)).toEqual([]);
  });

  test('an unknown workspace answers 404 not_found and deletes nothing', async () => {
    const { token } = await signInOwner();
    const kept = await createWorkspace({ token, name: 'Kept' });
    const response = await deleteWorkspace({ token, workspaceId: crypto.randomUUID() });
    expect(response.status).toBe(NOT_FOUND_STATUS);
    expect(await response.json()).toEqual(NOT_FOUND);
    expect(await storedWorkspaceRows(kept.id)).toBe(1);
  });

  test('another owner gets the answer an absent workspace gets, and the workspace stays', async () => {
    const alice = await signInOwner();
    const bob = await signInOwner();
    const workspace = await createWorkspace({ token: alice.token, name: 'Alice' });
    const { countedEnv, addressingCalls } = countingEnv();
    const foreign = await serveOwnerCall({
      call: { method: 'DELETE', path: `/owner/workspaces/${workspace.id}`, token: bob.token },
      now: CLOCK_NOW,
      workerEnv: countedEnv,
    });
    const absent = await serveOwnerCall({
      call: { method: 'DELETE', path: `/owner/workspaces/${crypto.randomUUID()}`, token: bob.token },
      now: CLOCK_NOW,
      workerEnv: countedEnv,
    });
    expect([foreign.status, await foreign.text()]).toEqual([absent.status, await absent.text()]);
    expect(foreign.status).toBe(NOT_FOUND_STATUS);
    expect(addressingCalls).toEqual([]);
    expect(await storedWorkspaceRows(workspace.id)).toBe(1);
    expect((await listWorkspaces(alice.token)).map((listed) => listed.id)).toEqual([workspace.id]);
  });
});

describe('DELETE /owner/projects/:projectId', () => {
  test('answers 204 and removes the project and its keys, leaving its workspace and siblings', async () => {
    const { token } = await signInOwner();
    const workspace = await createWorkspace({ token, name: 'Work' });
    const project = await createProject({ token, workspaceId: workspace.id, name: 'Launch' });
    const sibling = await createProject({ token, workspaceId: workspace.id, name: 'Garden' });
    await issueKey({ token, projectId: project.id });
    const response = await deleteProject({ token, projectId: project.id });
    expect(response.status).toBe(NO_CONTENT_STATUS);
    expect(await storedProjectRows([project.id])).toBe(0);
    expect(await storedKeyRows(project.id)).toBe(0);
    expect(await storedProjectRows([sibling.id])).toBe(1);
    expect((await listWorkspaces(token))[0]?.projects.map((listed) => listed.id)).toEqual([workspace.projects[0]?.id, sibling.id]);
  });

  test('revokes the MCP key of the deleted project at once and wipes its storage', async () => {
    const { token } = await signInOwner();
    const workspace = await createWorkspace({ token, name: 'Work' });
    const project = await createProject({ token, workspaceId: workspace.id, name: 'Launch' });
    const secret = await issueKey({ token, projectId: project.id });
    expect((await mcpCall(secret)).status).not.toBe(UNAUTHORIZED_STATUS);
    expect(await projectStoreTableCount(project.id)).toBeGreaterThan(0);
    await deleteProject({ token, projectId: project.id });
    expect((await mcpCall(secret)).status).toBe(UNAUTHORIZED_STATUS);
    expect(await projectStoreTableCount(project.id)).toBe(0);
  });

  test('the Inbox answers 409 inbox_is_fixed and is kept', async () => {
    const { token } = await signInOwner();
    const workspace = await createWorkspace({ token, name: 'Work' });
    const inboxId = inboxOf(workspace).id;
    const response = await deleteProject({ token, projectId: inboxId });
    expect(response.status).toBe(CONFLICT_STATUS);
    expect(await response.json()).toEqual(INBOX_IS_FIXED);
    expect(await storedProjectRows([inboxId])).toBe(1);
    expect((await listWorkspaces(token))[0]?.projects[0]?.name).toBe(INBOX_PROJECT_NAME);
  });

  test('an unknown project answers 404 not_found', async () => {
    const { token } = await signInOwner();
    const response = await deleteProject({ token, projectId: crypto.randomUUID() });
    expect(response.status).toBe(NOT_FOUND_STATUS);
    expect(await response.json()).toEqual(NOT_FOUND);
  });

  test('another owner gets 404 and the project, its key and its storage stay', async () => {
    const alice = await signInOwner();
    const bob = await signInOwner();
    const workspace = await createWorkspace({ token: alice.token, name: 'Alice' });
    const project = await createProject({ token: alice.token, workspaceId: workspace.id, name: 'Alice project' });
    const secret = await issueKey({ token: alice.token, projectId: project.id });
    const response = await deleteProject({ token: bob.token, projectId: project.id });
    expect(response.status).toBe(NOT_FOUND_STATUS);
    expect(await response.json()).toEqual(NOT_FOUND);
    expect(await storedProjectRows([project.id])).toBe(1);
    expect(await storedKeyRows(project.id)).toBe(1);
    expect((await mcpCall(secret)).status).not.toBe(UNAUTHORIZED_STATUS);
    expect(await projectStoreTableCount(project.id)).toBeGreaterThan(0);
  });
});

describe('another owner deleting a project that has no key', () => {
  test('answers 404 and the project stays', async () => {
    const alice = await signInOwner();
    const bob = await signInOwner();
    const workspace = await createWorkspace({ token: alice.token, name: 'Alice' });
    const project = await createProject({ token: alice.token, workspaceId: workspace.id, name: 'Alice project' });
    const response = await deleteProject({ token: bob.token, projectId: project.id });
    expect(response.status).toBe(NOT_FOUND_STATUS);
    expect(await response.json()).toEqual(NOT_FOUND);
    expect(await storedProjectRows([project.id])).toBe(1);
  });
});

describe('a deleted project with an MCP session open', () => {
  test('the session answers 401 right after the workspace is deleted', async () => {
    const { token } = await signInOwner();
    const workspace = await createWorkspace({ token, name: 'Open session' });
    const secret = await issueKey({ token, projectId: inboxOf(workspace).id });
    const sessionId = await openMcpSession({
      directory: env.DIRECTORY,
      keyDigest: await digestCredential(secret),
      clientName: 'Claude Code',
      now: Date.now(),
    });
    expect((await mcpSessionCall({ secret, sessionId })).status).not.toBe(UNAUTHORIZED_STATUS);
    await deleteWorkspace({ token, workspaceId: workspace.id });
    expect((await mcpSessionCall({ secret, sessionId })).status).toBe(UNAUTHORIZED_STATUS);
  });
});

describe('the directory deletions called for another owner', () => {
  test('deleteOwnerWorkspace answers null and keeps the workspace and its projects', async () => {
    const { token } = await signInOwner();
    const workspace = await createWorkspace({ token, name: 'Mine' });
    const answer = await deleteOwnerWorkspace({ directory: env.DIRECTORY, ownerId: crypto.randomUUID(), workspaceId: workspace.id });
    expect(answer).toBeNull();
    expect(await storedWorkspaceRows(workspace.id)).toBe(1);
    expect(await storedProjectRows(workspace.projects.map((project) => project.id))).toBe(1);
  });

  test('deleteOwnerProject answers false and keeps the project', async () => {
    const { token } = await signInOwner();
    const workspace = await createWorkspace({ token, name: 'Mine' });
    const project = await createProject({ token, workspaceId: workspace.id, name: 'Launch' });
    const isDeleted = await deleteOwnerProject({ directory: env.DIRECTORY, ownerId: crypto.randomUUID(), projectId: project.id });
    expect(isDeleted).toBe(false);
    expect(await storedProjectRows([project.id])).toBe(1);
  });
});

function wipeFailingEnv(): Env {
  const namespace = {
    idFromName: (name: string) => name,
    get: () => ({
      wipe: () => {
        throw new Error('the project store is unreachable');
      },
    }),
  } as unknown as DurableObjectNamespace<ProjectStore>;
  return workerEnvWith({ PROJECT_STORE: namespace });
}

describe('a delete whose storage wipe fails after the directory rows are gone', () => {
  test('the workspace delete still answers 204', async () => {
    const { token } = await signInOwner();
    const workspace = await createWorkspace({ token, name: 'Orphaned' });
    const response = await serveOwnerCall({
      call: { method: 'DELETE', path: `/owner/workspaces/${workspace.id}`, token },
      now: CLOCK_NOW,
      workerEnv: wipeFailingEnv(),
    });
    expect(response.status).toBe(NO_CONTENT_STATUS);
    expect(await storedWorkspaceRows(workspace.id)).toBe(0);
  });

  test('the project delete still answers 204', async () => {
    const { token } = await signInOwner();
    const workspace = await createWorkspace({ token, name: 'Work' });
    const project = await createProject({ token, workspaceId: workspace.id, name: 'Launch' });
    const response = await serveOwnerCall({
      call: { method: 'DELETE', path: `/owner/projects/${project.id}`, token },
      now: CLOCK_NOW,
      workerEnv: wipeFailingEnv(),
    });
    expect(response.status).toBe(NO_CONTENT_STATUS);
    expect(await storedProjectRows([project.id])).toBe(0);
  });
});

describe('delete routes without a session', () => {
  test.each([['/owner/workspaces/any'], ['/owner/projects/any']])('DELETE %s answers 401 with an empty body', async (path) => {
    const response = await ownerCall({ method: 'DELETE', path });
    expect(response.status).toBe(UNAUTHORIZED_STATUS);
    expect(await response.text()).toBe('');
  });
});
