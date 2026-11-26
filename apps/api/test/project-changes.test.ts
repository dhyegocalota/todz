import { OWNER_ACTOR } from '@todz/core';
import { ActorKind, HistoryAction, TASK_BATCH_MAX_SIZE, TaskField } from '@todz/types';
import { describe, expect, test } from 'vitest';
import { ProjectFailureKind } from '../src/project-result';
import { CHANGE_PAGE_SIZE } from '../src/project-store';
import { AGENT_ACTOR, draftOf, newProjectStub, unwrap } from './task-fixtures';

const MISSING_NUMBER = 9;
const BEYOND_LAST_CHANGE = 4;
const BEFORE_FIRST_CHANGE = 0;
const NEW_STORE_CURSOR = 1;
const SOCKET_URL = 'https://project.test/socket';
const WEBSOCKET_UPGRADE = 'websocket';
const UPGRADE_REQUIRED_STATUS = 426;
const SWITCHING_PROTOCOLS_STATUS = 101;
const CHANGED = 'changed';
const BAD_REQUEST_STATUS = 400;
const SESSION_HEADERS = { Upgrade: WEBSOCKET_UPGRADE, 'Todz-Session-Digest': 'a-session-digest' };

async function addTitled({ stub, count }: { stub: ReturnType<typeof newProjectStub>; count: number }): Promise<void> {
  const titles = Array.from({ length: count }, (_unused, index) => `Task ${index + 1}`);
  const batches = Array.from({ length: Math.ceil(count / TASK_BATCH_MAX_SIZE) }, (_unused, index) =>
    titles.slice(index * TASK_BATCH_MAX_SIZE, (index + 1) * TASK_BATCH_MAX_SIZE),
  );
  await batches.reduce(async (previous, batch) => {
    await previous;
    unwrap(await stub.addTasks({ actor: AGENT_ACTOR, drafts: batch.map(draftOf) }));
  }, Promise.resolve());
}

describe('ProjectStore readChanges', () => {
  test('three tasks come back at cursor 0 with the cursor on the last one', async () => {
    const stub = newProjectStub();
    await addTitled({ stub, count: 3 });
    const changes = unwrap(await stub.readChanges({ cursor: 0 }));
    expect(changes.tasks.map((task) => task.number)).toEqual([1, 2, 3]);
    expect(changes.cursor).toBe(3);
    expect(changes.hasMore).toBe(false);
  });

  test('101 tasks page as 100 with more, then 1, then nothing at the same cursor', async () => {
    const stub = newProjectStub();
    await addTitled({ stub, count: CHANGE_PAGE_SIZE + 1 });
    const firstPage = unwrap(await stub.readChanges({ cursor: 0 }));
    expect(firstPage.tasks).toHaveLength(CHANGE_PAGE_SIZE);
    expect(firstPage.cursor).toBe(CHANGE_PAGE_SIZE);
    expect(firstPage.hasMore).toBe(true);
    const secondPage = unwrap(await stub.readChanges({ cursor: firstPage.cursor }));
    expect(secondPage.tasks.map((task) => task.number)).toEqual([CHANGE_PAGE_SIZE + 1]);
    expect(secondPage.cursor).toBe(CHANGE_PAGE_SIZE + 1);
    expect(secondPage.hasMore).toBe(false);
    const emptyPage = unwrap(await stub.readChanges({ cursor: secondPage.cursor }));
    expect(emptyPage).toEqual({ tasks: [], deletedNumbers: [], cursor: CHANGE_PAGE_SIZE + 1, hasMore: false });
  });

  test('a task updated twice after the cursor appears once, in its latest state', async () => {
    const stub = newProjectStub();
    await addTitled({ stub, count: 3 });
    unwrap(await stub.updateTask({ actor: AGENT_ACTOR, number: 1, patch: { title: 'Renamed once' } }));
    unwrap(await stub.updateTask({ actor: AGENT_ACTOR, number: 1, patch: { title: 'Renamed twice' } }));
    const changes = unwrap(await stub.readChanges({ cursor: 3 }));
    expect(changes.tasks.map((task) => ({ number: task.number, title: task.title }))).toEqual([{ number: 1, title: 'Renamed twice' }]);
    expect(changes.cursor).toBe(5);
  });

  test('a cursor above the last change number is cursor ahead', async () => {
    const stub = newProjectStub();
    await addTitled({ stub, count: 3 });
    expect(await stub.readChanges({ cursor: BEYOND_LAST_CHANGE })).toEqual({
      ok: false,
      failure: { kind: ProjectFailureKind.CursorAhead },
    });
  });

  test('a cursor on the last change number is an empty page at that cursor', async () => {
    const stub = newProjectStub();
    await addTitled({ stub, count: 3 });
    expect(unwrap(await stub.readChanges({ cursor: 3 }))).toEqual({ tasks: [], deletedNumbers: [], cursor: 3, hasMore: false });
  });

  test('a new store counts its last change number as 0: cursor 1 is ahead, cursor 0 is empty', async () => {
    const stub = newProjectStub();
    expect(await stub.readChanges({ cursor: NEW_STORE_CURSOR })).toEqual({ ok: false, failure: { kind: ProjectFailureKind.CursorAhead } });
    expect(unwrap(await stub.readChanges({ cursor: BEFORE_FIRST_CHANGE }))).toEqual({
      tasks: [],
      deletedNumbers: [],
      cursor: 0,
      hasMore: false,
    });
  });
});

type ProjectStub = ReturnType<typeof newProjectStub>;
type SocketProbe = { socket: WebSocket; messages: string[]; waitForCount: (count: number) => Promise<void> };

async function openSocket(stub: ProjectStub): Promise<SocketProbe> {
  const response = await stub.fetch(SOCKET_URL, { headers: SESSION_HEADERS });
  const socket = response.webSocket;
  if (socket === null) throw new Error('the project did not accept the socket');
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
  return { socket, messages, waitForCount };
}

async function settled({ stub, probe, count }: { stub: ProjectStub; probe: SocketProbe; count: number }): Promise<string[]> {
  await probe.waitForCount(count);
  unwrap(await stub.readChanges({ cursor: 0 }));
  return probe.messages;
}

async function addOne({ stub, title }: { stub: ProjectStub; title: string }): Promise<void> {
  unwrap(await stub.addTasks({ actor: AGENT_ACTOR, drafts: [draftOf(title)] }));
}

describe('ProjectStore fetch', () => {
  test('a request without the upgrade header is refused with 426, an empty body and the upgrade header', async () => {
    const response = await newProjectStub().fetch(SOCKET_URL);
    expect(response.status).toBe(UPGRADE_REQUIRED_STATUS);
    expect(await response.text()).toBe('');
    expect(response.headers.get('Upgrade')).toBe(WEBSOCKET_UPGRADE);
  });

  test('an upgrade without its session is refused with 400', async () => {
    const response = await newProjectStub().fetch(SOCKET_URL, { headers: { Upgrade: WEBSOCKET_UPGRADE } });
    expect(response.status).toBe(BAD_REQUEST_STATUS);
    expect(response.webSocket).toBeNull();
  });

  test('a request with the upgrade header and its session is answered 101 with the client socket', async () => {
    const response = await newProjectStub().fetch(SOCKET_URL, { headers: SESSION_HEADERS });
    expect(response.status).toBe(SWITCHING_PROTOCOLS_STATUS);
    expect(response.webSocket).not.toBeNull();
    response.webSocket?.accept();
  });
});

describe('ProjectStore socket broadcast', () => {
  test('a socket receives exactly changed after each write that moved the change counter', async () => {
    const stub = newProjectStub();
    const probe = await openSocket(stub);
    await addOne({ stub, title: 'First' });
    await addOne({ stub, title: 'Sentinel' });
    expect(await settled({ stub, probe, count: 2 })).toEqual([CHANGED, CHANGED]);
  });

  test('update, complete and reopen each broadcast changed', async () => {
    const stub = newProjectStub();
    await addOne({ stub, title: 'First' });
    const probe = await openSocket(stub);
    unwrap(await stub.updateTask({ actor: AGENT_ACTOR, number: 1, patch: { title: 'Renamed' } }));
    unwrap(await stub.completeTasks({ actor: AGENT_ACTOR, numbers: [1], note: null }));
    unwrap(await stub.reopenTasks({ actor: AGENT_ACTOR, numbers: [1] }));
    expect(await settled({ stub, probe, count: 3 })).toEqual([CHANGED, CHANGED, CHANGED]);
  });

  test('a failed write then a successful one sends exactly one changed before the sentinel', async () => {
    const stub = newProjectStub();
    const probe = await openSocket(stub);
    await stub.addTasks({ actor: AGENT_ACTOR, drafts: [draftOf('  ')] });
    await addOne({ stub, title: 'Written' });
    await addOne({ stub, title: 'Sentinel' });
    expect(await settled({ stub, probe, count: 2 })).toEqual([CHANGED, CHANGED]);
  });

  test('a replayed write sends nothing before the sentinel', async () => {
    const stub = newProjectStub();
    const probe = await openSocket(stub);
    const keyedDraft = { ...draftOf('Once'), idempotencyKey: 'run-1' };
    unwrap(await stub.addTasks({ actor: AGENT_ACTOR, drafts: [keyedDraft] }));
    unwrap(await stub.addTasks({ actor: AGENT_ACTOR, drafts: [keyedDraft] }));
    await addOne({ stub, title: 'Sentinel' });
    expect(await settled({ stub, probe, count: 2 })).toEqual([CHANGED, CHANGED]);
  });

  test('two sockets on one project both receive changed', async () => {
    const stub = newProjectStub();
    const first = await openSocket(stub);
    const second = await openSocket(stub);
    await addOne({ stub, title: 'Shared' });
    expect(await settled({ stub, probe: first, count: 1 })).toEqual([CHANGED]);
    expect(await settled({ stub, probe: second, count: 1 })).toEqual([CHANGED]);
  });

  test('a socket on another project receives nothing from this project', async () => {
    const writtenStub = newProjectStub();
    const otherStub = newProjectStub();
    const otherProbe = await openSocket(otherStub);
    await addOne({ stub: writtenStub, title: 'Elsewhere' });
    await addOne({ stub: otherStub, title: 'Sentinel' });
    expect(await settled({ stub: otherStub, probe: otherProbe, count: 1 })).toEqual([CHANGED]);
  });

  test('a socket the client already closed does not fail the write or starve the others', async () => {
    const stub = newProjectStub();
    const closed = await openSocket(stub);
    const open = await openSocket(stub);
    closed.socket.close();
    await addOne({ stub, title: 'After the close' });
    expect(await settled({ stub, probe: open, count: 1 })).toEqual([CHANGED]);
  });
});

describe('ProjectStore readHistory', () => {
  test('a task created and then completed has two entries', async () => {
    const stub = newProjectStub();
    await addTitled({ stub, count: 1 });
    unwrap(await stub.completeTasks({ actor: OWNER_ACTOR, numbers: [1], note: null }));
    const history = unwrap(await stub.readHistory({ number: 1 }));
    expect(history.map((entry) => ({ action: entry.action, actorKind: entry.actor.kind }))).toEqual([
      { action: HistoryAction.Created, actorKind: ActorKind.Agent },
      { action: HistoryAction.Completed, actorKind: ActorKind.Owner },
    ]);
    expect(history.every((entry) => entry.fields.every((field) => Object.values(TaskField).includes(field)))).toBe(true);
  });

  test('a missing number is task not found', async () => {
    const stub = newProjectStub();
    expect(await stub.readHistory({ number: MISSING_NUMBER })).toEqual({
      ok: false,
      failure: { kind: ProjectFailureKind.TaskNotFound, number: MISSING_NUMBER },
    });
  });
});
