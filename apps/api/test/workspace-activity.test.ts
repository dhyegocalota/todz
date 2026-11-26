import { WORKSPACE_ACTIVITY_WRITE_INTERVAL_MS } from '@todz/types';
import { env } from 'cloudflare:workers';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { HttpStatus } from '../src/http-status';
import { isActivityWriteDue } from '../src/workspace-activity';
import { type OwnedProject, createOwnedProject, ownerCall, projectCall } from './owner-client';
import { CLOCK_NOW } from './task-fixtures';

type ListedWorkspace = { id: string; last_activity_at: number | null };
type WorkspaceRow = { last_activity_at: number | null };

async function listedWorkspace(project: OwnedProject): Promise<ListedWorkspace> {
  const response = await ownerCall({ method: 'GET', path: '/owner/workspaces', token: project.token });
  expect(response.status).toBe(HttpStatus.Ok);
  const { workspaces } = await response.json<{ workspaces: ListedWorkspace[] }>();
  const [workspace] = workspaces;
  if (workspace === undefined) throw new Error('the owner has a workspace');
  return workspace;
}

async function addTask({ project, title }: { project: OwnedProject; title: string }): Promise<void> {
  const response = await projectCall({ project, method: 'POST', path: '/tasks', body: { tasks: [{ title }] } });
  expect(response.status).toBe(HttpStatus.Created);
}

async function storedActivity(project: OwnedProject): Promise<number | null> {
  const { id } = await listedWorkspace(project);
  const row = await env.DIRECTORY.prepare('SELECT last_activity_at FROM workspaces WHERE id = ?').bind(id).first<WorkspaceRow>();
  if (row === null) throw new Error('the workspace should exist');
  return row.last_activity_at;
}

afterEach(() => {
  vi.useRealTimers();
});

describe('isActivityWriteDue', () => {
  test('is due when nothing was written yet', () => {
    expect(isActivityWriteDue({ writtenAt: null, now: CLOCK_NOW })).toBe(true);
  });

  test('is not due inside the interval', () => {
    expect(isActivityWriteDue({ writtenAt: CLOCK_NOW, now: CLOCK_NOW + WORKSPACE_ACTIVITY_WRITE_INTERVAL_MS - 1 })).toBe(false);
  });

  test('is due once the interval has passed', () => {
    expect(isActivityWriteDue({ writtenAt: CLOCK_NOW, now: CLOCK_NOW + WORKSPACE_ACTIVITY_WRITE_INTERVAL_MS })).toBe(true);
  });
});

describe('workspace last activity', () => {
  test('a workspace nobody wrote to lists a null last activity', async () => {
    const project = await createOwnedProject();
    expect((await listedWorkspace(project)).last_activity_at).toBeNull();
  });

  test('a task written in a project stamps its workspace and the listing carries the stamp', async () => {
    const project = await createOwnedProject();
    const before = Date.now();
    await addTask({ project, title: 'First' });
    await vi.waitFor(async () => expect(await storedActivity(project)).not.toBeNull());
    const { last_activity_at } = await listedWorkspace(project);
    expect(last_activity_at).toBeGreaterThanOrEqual(before);
  });

  test('a read does not stamp the workspace', async () => {
    const project = await createOwnedProject();
    const response = await projectCall({ project, method: 'GET', path: '/changes?cursor=0' });
    expect(response.status).toBe(HttpStatus.Ok);
    expect(await storedActivity(project)).toBeNull();
  });

  test('a write after the interval stamps again with the later time', async () => {
    const project = await createOwnedProject();
    await addTask({ project, title: 'First' });
    await vi.waitFor(async () => expect(await storedActivity(project)).not.toBeNull());
    const firstStamp = await storedActivity(project);
    if (firstStamp === null) throw new Error('the first write stamps');
    vi.useFakeTimers({ toFake: ['Date'], now: firstStamp + WORKSPACE_ACTIVITY_WRITE_INTERVAL_MS });
    await addTask({ project, title: 'Second' });
    await vi.waitFor(async () => expect(await storedActivity(project)).toBe(firstStamp + WORKSPACE_ACTIVITY_WRITE_INTERVAL_MS));
  });
});
