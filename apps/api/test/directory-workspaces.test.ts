import { env } from 'cloudflare:workers';
import { describe, expect, test } from 'vitest';
import {
  findOwnerWorkspace,
  insertProject,
  insertWorkspaceWithInbox,
  updateProjectName,
  updateWorkspaceName,
} from '../src/directory-workspaces';
import { seedOwner, seedProject, seedWorkspace } from './directory-seed';
import { CLOCK_NOW } from './task-fixtures';

const RENAMED = 'Renamed';
const CREATED = 'Created';

type NameRow = { name: string };

async function storedWorkspaceName(workspaceId: string): Promise<string> {
  const row = await env.DIRECTORY.prepare('SELECT name FROM workspaces WHERE id = ?').bind(workspaceId).first<NameRow>();
  if (row === null) throw new Error('the workspace should exist');
  return row.name;
}

async function storedProjectName(projectId: string): Promise<string> {
  const row = await env.DIRECTORY.prepare('SELECT name FROM projects WHERE id = ?').bind(projectId).first<NameRow>();
  if (row === null) throw new Error('the project should exist');
  return row.name;
}

async function projectCountOf(workspaceId: string): Promise<number> {
  const row = await env.DIRECTORY.prepare('SELECT count(*) AS total FROM projects WHERE workspace_id = ?')
    .bind(workspaceId)
    .first<{ total: number }>();
  if (row === null) throw new Error('count always answers a row');
  return row.total;
}

describe('updateWorkspaceName', () => {
  test('renames a workspace of the owner and says so', async () => {
    const ownerId = await seedOwner();
    const workspaceId = await seedWorkspace({ ownerId });
    expect(await updateWorkspaceName({ directory: env.DIRECTORY, ownerId, workspaceId, name: RENAMED })).toBe(true);
    expect(await storedWorkspaceName(workspaceId)).toBe(RENAMED);
  });

  test("changes nothing and says so for another owner's workspace", async () => {
    const workspaceId = await seedWorkspace({ ownerId: await seedOwner() });
    const intruderId = await seedOwner();
    expect(await updateWorkspaceName({ directory: env.DIRECTORY, ownerId: intruderId, workspaceId, name: RENAMED })).toBe(false);
    expect(await storedWorkspaceName(workspaceId)).not.toBe(RENAMED);
  });
});

describe('insertProject', () => {
  test('adds a project to a workspace of the owner and says so', async () => {
    const ownerId = await seedOwner();
    const workspaceId = await seedWorkspace({ ownerId });
    const projectId = crypto.randomUUID();
    expect(await insertProject({ directory: env.DIRECTORY, ownerId, projectId, workspaceId, name: CREATED, now: CLOCK_NOW })).toBe(true);
    expect(await storedProjectName(projectId)).toBe(CREATED);
  });

  test("adds nothing and says so for another owner's workspace", async () => {
    const workspaceId = await seedWorkspace({ ownerId: await seedOwner() });
    const intruderId = await seedOwner();
    const projectId = crypto.randomUUID();
    expect(
      await insertProject({ directory: env.DIRECTORY, ownerId: intruderId, projectId, workspaceId, name: CREATED, now: CLOCK_NOW }),
    ).toBe(false);
    expect(await projectCountOf(workspaceId)).toBe(0);
  });

  test('adds nothing for a workspace that never existed', async () => {
    const ownerId = await seedOwner();
    const workspaceId = crypto.randomUUID();
    expect(
      await insertProject({
        directory: env.DIRECTORY,
        ownerId,
        projectId: crypto.randomUUID(),
        workspaceId,
        name: CREATED,
        now: CLOCK_NOW,
      }),
    ).toBe(false);
  });
});

describe('updateProjectName', () => {
  test('renames a project of the owner and says so', async () => {
    const ownerId = await seedOwner();
    const projectId = await seedProject({ ownerId });
    expect(await updateProjectName({ directory: env.DIRECTORY, ownerId, projectId, name: RENAMED })).toBe(true);
    expect(await storedProjectName(projectId)).toBe(RENAMED);
  });

  test("changes nothing and says so for another owner's project", async () => {
    const projectId = await seedProject({ ownerId: await seedOwner() });
    const intruderId = await seedOwner();
    expect(await updateProjectName({ directory: env.DIRECTORY, ownerId: intruderId, projectId, name: RENAMED })).toBe(false);
    expect(await storedProjectName(projectId)).not.toBe(RENAMED);
  });

  test('changes nothing for an Inbox even of the owner', async () => {
    const ownerId = await seedOwner();
    const workspaceId = crypto.randomUUID();
    const inboxId = crypto.randomUUID();
    await insertWorkspaceWithInbox({
      directory: env.DIRECTORY,
      ownerId,
      workspaceId,
      inboxId,
      name: 'Work',
      inboxName: 'Inbox',
      now: CLOCK_NOW,
    });
    expect(await updateProjectName({ directory: env.DIRECTORY, ownerId, projectId: inboxId, name: RENAMED })).toBe(false);
    expect(await storedProjectName(inboxId)).toBe('Inbox');
  });
});

describe('findOwnerWorkspace', () => {
  test('answers the workspace with only its own projects', async () => {
    const ownerId = await seedOwner();
    const workspaceId = crypto.randomUUID();
    const inboxId = crypto.randomUUID();
    await insertWorkspaceWithInbox({
      directory: env.DIRECTORY,
      ownerId,
      workspaceId,
      inboxId,
      name: 'Work',
      inboxName: 'Inbox',
      now: CLOCK_NOW,
    });
    await seedProject({ ownerId });
    const listing = await findOwnerWorkspace({ directory: env.DIRECTORY, ownerId, workspaceId });
    expect(listing?.workspace).toEqual({ id: workspaceId, name: 'Work', createdAt: CLOCK_NOW });
    expect(listing?.projects.map((project) => project.id)).toEqual([inboxId]);
  });

  test("answers null for another owner's workspace and for one that never existed", async () => {
    const workspaceId = await seedWorkspace({ ownerId: await seedOwner() });
    const intruderId = await seedOwner();
    expect(await findOwnerWorkspace({ directory: env.DIRECTORY, ownerId: intruderId, workspaceId })).toBeNull();
    expect(await findOwnerWorkspace({ directory: env.DIRECTORY, ownerId: intruderId, workspaceId: crypto.randomUUID() })).toBeNull();
  });
});
