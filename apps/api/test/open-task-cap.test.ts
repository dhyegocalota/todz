import { env } from 'cloudflare:workers';
import { describe, expect, test } from 'vitest';
import type { Env } from '../src/env';
import { serveOwnerCall, signInOwner } from './owner-client';

const CAP = 3;
const CREATED_STATUS = 201;
const CONFLICT_STATUS = 409;
const cappedEnv: Env = { ...env, FAIR_USE_OPEN_TASKS_PER_PROJECT_MAX: String(CAP) };

type ProjectBody = { workspace: { projects: { id: string }[] } };
type TaskBody = { tasks: { task: { number: number } }[] };

async function inboxOf(token: string): Promise<string> {
  const response = await serveOwnerCall({
    call: { method: 'POST', path: '/owner/workspaces', token, body: { name: 'Work' } },
    now: Date.now(),
    workerEnv: cappedEnv,
  });
  const body = await response.json<ProjectBody>();
  const inbox = body.workspace.projects[0];
  if (inbox === undefined) throw new Error('a workspace has an Inbox');
  return inbox.id;
}

function addTitles({ token, projectId, titles }: { token: string; projectId: string; titles: string[] }): Promise<Response> {
  return serveOwnerCall({
    call: { method: 'POST', path: `/owner/projects/${projectId}/tasks`, token, body: { tasks: titles.map((title) => ({ title })) } },
    now: Date.now(),
    workerEnv: cappedEnv,
  });
}

function completeNumbers({ token, projectId, numbers }: { token: string; projectId: string; numbers: number[] }): Promise<Response> {
  return serveOwnerCall({
    call: { method: 'POST', path: `/owner/projects/${projectId}/tasks/complete`, token, body: { numbers } },
    now: Date.now(),
    workerEnv: cappedEnv,
  });
}

function reopenNumbers({ token, projectId, numbers }: { token: string; projectId: string; numbers: number[] }): Promise<Response> {
  return serveOwnerCall({
    call: { method: 'POST', path: `/owner/projects/${projectId}/tasks/reopen`, token, body: { numbers } },
    now: Date.now(),
    workerEnv: cappedEnv,
  });
}

async function fillProject(token: string, projectId: string): Promise<number[]> {
  const response = await addTitles({ token, projectId, titles: Array.from({ length: CAP }, (_, index) => `Task ${index}`) });
  if (response.status !== CREATED_STATUS) throw new Error(`filling answered ${response.status}`);
  return (await response.json<TaskBody>()).tasks.map(({ task }) => task.number);
}

describe('the open task cap', () => {
  test('the add past the cap is refused with the open tasks limit and a message', async () => {
    const { token } = await signInOwner();
    const projectId = await inboxOf(token);
    await fillProject(token, projectId);
    const refused = await addTitles({ token, projectId, titles: ['One too many'] });
    expect(refused.status).toBe(CONFLICT_STATUS);
    const body = await refused.json<{ error: string; limit: string; message: string }>();
    expect(body.error).toBe('limit_reached');
    expect(body.limit).toBe('open_tasks');
    expect(body.message).toContain(String(CAP));
  });

  test('completing one task frees a slot for the next add', async () => {
    const { token } = await signInOwner();
    const projectId = await inboxOf(token);
    const [first] = await fillProject(token, projectId);
    if (first === undefined) throw new Error('filling made a task');
    expect((await completeNumbers({ token, projectId, numbers: [first] })).status).toBe(200);
    expect((await addTitles({ token, projectId, titles: ['Fits again'] })).status).toBe(CREATED_STATUS);
  });

  test('a batch that would cross the cap adds nothing', async () => {
    const { token } = await signInOwner();
    const projectId = await inboxOf(token);
    const refused = await addTitles({ token, projectId, titles: ['a', 'b', 'c', 'd'] });
    expect(refused.status).toBe(CONFLICT_STATUS);
    const listed = await serveOwnerCall({
      call: { method: 'GET', path: `/owner/projects/${projectId}/changes?cursor=0`, token },
      now: Date.now(),
      workerEnv: cappedEnv,
    });
    expect(listed.status).toBe(200);
    expect(await listed.text()).not.toContain('"title":"a"');
  });

  test('reopening a done task over the cap is refused', async () => {
    const { token } = await signInOwner();
    const projectId = await inboxOf(token);
    const [first] = await fillProject(token, projectId);
    if (first === undefined) throw new Error('filling made a task');
    await completeNumbers({ token, projectId, numbers: [first] });
    await addTitles({ token, projectId, titles: ['Replaces it'] });
    const refused = await reopenNumbers({ token, projectId, numbers: [first] });
    expect(refused.status).toBe(CONFLICT_STATUS);
    expect((await refused.json<{ limit: string }>()).limit).toBe('open_tasks');
  });
});
