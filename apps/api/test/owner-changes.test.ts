import { TASK_BATCH_MAX_SIZE } from '@todz/types';
import { describe, expect, test } from 'vitest';
import { HttpStatus } from '../src/http-status';
import { McpToolName } from '../src/mcp-copy';
import { CHANGE_PAGE_SIZE } from '../src/project-store';
import { countingEnv } from './counting-namespace';
import { ClientEra, callTool, connectClient } from './mcp-client';
import { type OwnedProject, createOwnedProject, issueMcpKey, ownerCall, projectCall, serveOwnerCall } from './owner-client';

const WEBSOCKET_UPGRADE = 'websocket';
const CHANGED = 'changed';
const FAR_AHEAD_CURSOR = 9;
const UNSAFE_CURSOR = '9007199254740992';
const INVALID_REQUEST = { error: 'invalid_request' };

type TaskBody = { number: number; title: string };
type ChangesBody = { tasks: TaskBody[]; cursor: number; has_more: boolean };
type SocketProbe = { messages: string[]; waitForCount: (count: number) => Promise<void> };

function addTasks({ project, titles }: { project: OwnedProject; titles: string[] }): Promise<Response> {
  return projectCall({ project, method: 'POST', path: '/tasks', body: { tasks: titles.map((title) => ({ title })) } });
}

function readChanges({ project, query }: { project: OwnedProject; query: string }): Promise<Response> {
  return projectCall({ project, method: 'GET', path: `/changes${query}` });
}

async function changesFrom({ project, cursor }: { project: OwnedProject; cursor: number }): Promise<ChangesBody> {
  const response = await readChanges({ project, query: `?cursor=${cursor}` });
  expect(response.status).toBe(HttpStatus.Ok);
  return response.json<ChangesBody>();
}

async function addedByAgent({ project, titles }: { project: OwnedProject; titles: string[] }): Promise<void> {
  const key = await issueMcpKey({ token: project.token, projectId: project.projectId });
  const client = await connectClient({ era: ClientEra.Legacy, key });
  await callTool({ client, name: McpToolName.Add, args: { tasks: titles.map((title) => ({ title })) } });
}

async function openSocket(project: OwnedProject): Promise<SocketProbe> {
  const response = await projectCall({ project, method: 'GET', path: '/socket', headers: { Upgrade: WEBSOCKET_UPGRADE } });
  const socket = response.webSocket;
  if (socket === null) throw new Error(`the socket answered ${response.status}`);
  socket.accept();
  const messages: string[] = [];
  const countListeners: (() => void)[] = [];
  socket.addEventListener('message', (event) => {
    messages.push(String(event.data));
    countListeners.forEach((listener) => listener());
  });
  function waitForCount(count: number): Promise<void> {
    return new Promise((resolve) => {
      function resolveWhenReached(): void {
        if (messages.length >= count) resolve();
      }
      countListeners.push(resolveWhenReached);
      resolveWhenReached();
    });
  }
  return { messages, waitForCount };
}

async function settled({ project, probe, count }: { project: OwnedProject; probe: SocketProbe; count: number }): Promise<string[]> {
  await probe.waitForCount(count);
  await changesFrom({ project, cursor: 0 });
  return probe.messages;
}

describe('GET /owner/projects/:projectId/changes', () => {
  test('an empty project at cursor 0 answers an empty page', async () => {
    const project = await createOwnedProject();
    expect(await changesFrom({ project, cursor: 0 })).toEqual({ tasks: [], cursor: 0, has_more: false });
  });

  test('two added tasks come back at cursor 0 with the cursor on the last', async () => {
    const project = await createOwnedProject();
    await addTasks({ project, titles: ['One', 'Two'] });
    const changes = await changesFrom({ project, cursor: 0 });
    expect(changes.tasks.map((task) => task.number)).toEqual([1, 2]);
    expect(changes.cursor).toBe(2);
    expect(changes.has_more).toBe(false);
  });

  test('a task an agent added after the cursor is the only one returned and moves the cursor', async () => {
    const project = await createOwnedProject();
    await addTasks({ project, titles: ['One', 'Two'] });
    await addedByAgent({ project, titles: ['Three'] });
    const changes = await changesFrom({ project, cursor: 2 });
    expect(changes.tasks.map((task) => task.number)).toEqual([3]);
    expect(changes.cursor).toBe(3);
  });

  test('a project past one page answers a full page with has_more, then the rest', async () => {
    const project = await createOwnedProject();
    const titles = Array.from({ length: CHANGE_PAGE_SIZE + 1 }, (_unused, index) => `Task ${index + 1}`);
    await addTasks({ project, titles: titles.slice(0, TASK_BATCH_MAX_SIZE) });
    await addTasks({ project, titles: titles.slice(TASK_BATCH_MAX_SIZE, TASK_BATCH_MAX_SIZE * 2) });
    await addTasks({ project, titles: titles.slice(TASK_BATCH_MAX_SIZE * 2) });
    const firstPage = await changesFrom({ project, cursor: 0 });
    expect(firstPage.tasks).toHaveLength(CHANGE_PAGE_SIZE);
    expect(firstPage.cursor).toBe(CHANGE_PAGE_SIZE);
    expect(firstPage.has_more).toBe(true);
    const secondPage = await changesFrom({ project, cursor: firstPage.cursor });
    expect(secondPage.tasks.map((task) => task.number)).toEqual([CHANGE_PAGE_SIZE + 1]);
    expect(secondPage.has_more).toBe(false);
  });

  test('a task carries its full json shape', async () => {
    const project = await createOwnedProject();
    await addTasks({ project, titles: ['One'] });
    const { tasks } = await changesFrom({ project, cursor: 0 });
    const [task] = tasks;
    if (task === undefined) throw new Error('the page should carry the task');
    expect(Object.keys(task).sort()).toEqual(
      [
        'completed_at',
        'created_at',
        'created_by',
        'due_date',
        'idempotency_key',
        'notes',
        'number',
        'order_key',
        'state',
        'title',
        'updated_at',
      ].sort(),
    );
  });

  test.each([
    ['a missing cursor', ''],
    ['a negative cursor', '?cursor=-1'],
    ['a fractional cursor', '?cursor=1.5'],
    ['a cursor that is not a number', '?cursor=abc'],
    ['a cursor with a leading zero', '?cursor=01'],
    ['an empty cursor', '?cursor='],
    ['two valid cursors', '?cursor=1&cursor=2'],
    ['a valid cursor then an invalid one', '?cursor=0&cursor=abc'],
    ['a cursor above the safe integers', `?cursor=${UNSAFE_CURSOR}`],
  ])('%s answers 400 invalid_request', async (_name, query) => {
    const project = await createOwnedProject();
    const response = await readChanges({ project, query });
    expect(response.status).toBe(HttpStatus.BadRequest);
    expect(await response.json()).toEqual(INVALID_REQUEST);
  });

  test('a cursor above the last change number answers 409 cursor_ahead', async () => {
    const project = await createOwnedProject();
    await addTasks({ project, titles: ['One', 'Two', 'Three'] });
    const response = await readChanges({ project, query: `?cursor=${FAR_AHEAD_CURSOR}` });
    expect(response.status).toBe(HttpStatus.Conflict);
    expect(await response.json()).toEqual({ error: 'cursor_ahead' });
  });

  test('a bad cursor on a project the owner does not have answers 400 before ownership', async () => {
    const project = await createOwnedProject();
    const response = await ownerCall({
      method: 'GET',
      path: `/owner/projects/${crypto.randomUUID()}/changes?cursor=abc`,
      token: project.token,
    });
    expect(response.status).toBe(HttpStatus.BadRequest);
  });

  test('no session answers 401 and opens no Durable Object', async () => {
    const project = await createOwnedProject();
    const { countedEnv, addressingCalls } = countingEnv();
    const response = await serveOwnerCall({
      call: { method: 'GET', path: `/owner/projects/${project.projectId}/changes?cursor=0` },
      now: Date.now(),
      workerEnv: countedEnv,
    });
    expect(response.status).toBe(HttpStatus.Unauthorized);
    expect(addressingCalls).toEqual([]);
  });
});

describe('GET /owner/projects/:projectId/socket', () => {
  test('answers 101 with a live socket when the upgrade header is present', async () => {
    const project = await createOwnedProject();
    const response = await projectCall({ project, method: 'GET', path: '/socket', headers: { Upgrade: WEBSOCKET_UPGRADE } });
    expect(response.status).toBe(HttpStatus.SwitchingProtocols);
    expect(response.webSocket).not.toBeNull();
    response.webSocket?.accept();
  });

  test('answers 426 with an empty body and the upgrade header when the upgrade header is missing', async () => {
    const project = await createOwnedProject();
    const response = await projectCall({ project, method: 'GET', path: '/socket' });
    expect(response.status).toBe(HttpStatus.UpgradeRequired);
    expect(await response.text()).toBe('');
    expect(response.headers.get('Upgrade')).toBe(WEBSOCKET_UPGRADE);
  });

  test('no session answers 401 and opens no Durable Object', async () => {
    const project = await createOwnedProject();
    const { countedEnv, addressingCalls } = countingEnv();
    const response = await serveOwnerCall({
      call: { method: 'GET', path: `/owner/projects/${project.projectId}/socket`, headers: { Upgrade: WEBSOCKET_UPGRADE } },
      now: Date.now(),
      workerEnv: countedEnv,
    });
    expect(response.status).toBe(HttpStatus.Unauthorized);
    expect(addressingCalls).toEqual([]);
  });

  test('an owner write sends changed', async () => {
    const project = await createOwnedProject();
    const probe = await openSocket(project);
    await addTasks({ project, titles: ['One'] });
    expect(await settled({ project, probe, count: 1 })).toEqual([CHANGED]);
  });

  test('an agent add sends changed', async () => {
    const project = await createOwnedProject();
    const probe = await openSocket(project);
    await addedByAgent({ project, titles: ['One'] });
    expect(await settled({ project, probe, count: 1 })).toEqual([CHANGED]);
  });

  test('an agent done sends changed', async () => {
    const project = await createOwnedProject();
    await addTasks({ project, titles: ['One'] });
    const key = await issueMcpKey({ token: project.token, projectId: project.projectId });
    const client = await connectClient({ era: ClientEra.Legacy, key });
    const probe = await openSocket(project);
    await callTool({ client, name: McpToolName.Done, args: { ids: ['T-1'] } });
    expect(await settled({ project, probe, count: 1 })).toEqual([CHANGED]);
  });

  test('a refused write sends nothing before the sentinel write', async () => {
    const project = await createOwnedProject();
    const probe = await openSocket(project);
    const refused = await addTasks({ project, titles: ['   '] });
    expect(refused.status).toBe(HttpStatus.Unprocessable);
    await addTasks({ project, titles: ['Sentinel'] });
    expect(await settled({ project, probe, count: 1 })).toEqual([CHANGED]);
  });
});
