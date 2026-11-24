import { ActorKind, HistoryAction, RuleIssue, TASK_BATCH_MAX_SIZE, TaskState } from '@todz/types';
import { describe, expect, test } from 'vitest';
import { HttpStatus } from '../src/http-status';
import { McpToolName } from '../src/mcp-copy';
import { ClientEra, callTool, connectClient } from './mcp-client';
import { type OwnedProject, createOwnedProject, issueMcpKey, ownerCall, projectCall, signInOwner } from './owner-client';

const OWNER_CLIENT_NAME = null;
const MISSING_NUMBER = 99;
const AGENT_CLIENT_NAME = 'Claude Code';
const INVALID_REQUEST = { error: 'invalid_request' };
const NOT_FOUND = { error: 'not_found' };

type ActorBody = { kind: ActorKind; client_name: string | null };
type TaskBody = {
  number: number;
  title: string;
  notes: string | null;
  due_date: string | null;
  state: TaskState;
  order_key: string;
  idempotency_key: string | null;
  created_by: ActorBody;
  created_at: number;
  updated_at: number;
  completed_at: number | null;
};
type AddedBody = { task: TaskBody; replayed: boolean };
type HistoryBody = { at: number; actor: ActorBody; action: HistoryAction; fields: string[]; note: string | null };

function present<Value>(value: Value | undefined): Value {
  if (value === undefined) throw new Error('the expected value is missing');
  return value;
}

function addTasks({ project, tasks }: { project: OwnedProject; tasks: unknown[] }): Promise<Response> {
  return projectCall({ project, method: 'POST', path: '/tasks', body: { tasks } });
}

async function addTitled({ project, titles }: { project: OwnedProject; titles: string[] }): Promise<TaskBody[]> {
  const response = await addTasks({ project, tasks: titles.map((title) => ({ title })) });
  expect(response.status).toBe(HttpStatus.Created);
  const { tasks } = await response.json<{ tasks: AddedBody[] }>();
  return tasks.map(({ task }) => task);
}

function updateTask({ project, number, body }: { project: OwnedProject; number: number; body: unknown }): Promise<Response> {
  return projectCall({ project, method: 'PATCH', path: `/tasks/${number}`, body });
}

async function updatedTask({ project, number, body }: { project: OwnedProject; number: number; body: unknown }): Promise<TaskBody> {
  const response = await updateTask({ project, number, body });
  expect(response.status).toBe(HttpStatus.Ok);
  return (await response.json<{ task: TaskBody }>()).task;
}

function completeTasks({ project, body }: { project: OwnedProject; body: unknown }): Promise<Response> {
  return projectCall({ project, method: 'POST', path: '/tasks/complete', body });
}

function reopenTasks({ project, body }: { project: OwnedProject; body: unknown }): Promise<Response> {
  return projectCall({ project, method: 'POST', path: '/tasks/reopen', body });
}

async function historyOf({ project, number }: { project: OwnedProject; number: number }): Promise<HistoryBody[]> {
  const response = await projectCall({ project, method: 'GET', path: `/tasks/${number}/history` });
  expect(response.status).toBe(HttpStatus.Ok);
  return (await response.json<{ history: HistoryBody[] }>()).history;
}

describe('POST /owner/projects/:projectId/tasks', () => {
  test('adds one task as the owner with empty notes and due date', async () => {
    const project = await createOwnedProject();
    const response = await addTasks({ project, tasks: [{ title: 'Write the spec' }] });
    expect(response.status).toBe(HttpStatus.Created);
    const { tasks } = await response.json<{ tasks: AddedBody[] }>();
    expect(tasks).toHaveLength(1);
    const [added] = tasks;
    expect(added?.replayed).toBe(false);
    expect(added?.task).toMatchObject({
      number: 1,
      title: 'Write the spec',
      notes: null,
      due_date: null,
      state: TaskState.Open,
      idempotency_key: null,
      created_by: { kind: ActorKind.Owner, client_name: OWNER_CLIENT_NAME },
      completed_at: null,
    });
  });

  test('keeps notes, due date and idempotency key and numbers a batch in order', async () => {
    const project = await createOwnedProject();
    const response = await addTasks({
      project,
      tasks: [{ title: 'First', notes: 'Some notes', due_date: '2026-12-01', idempotency_key: 'run-1' }, { title: 'Second' }],
    });
    const { tasks } = await response.json<{ tasks: AddedBody[] }>();
    expect(tasks.map(({ task }) => task.number)).toEqual([1, 2]);
    expect(tasks[0]?.task).toMatchObject({ notes: 'Some notes', due_date: '2026-12-01', idempotency_key: 'run-1' });
  });

  test('an idempotency key replays the task already added', async () => {
    const project = await createOwnedProject();
    const keyed = { title: 'Once', idempotency_key: 'run-1' };
    await addTasks({ project, tasks: [keyed] });
    const response = await addTasks({ project, tasks: [keyed] });
    const { tasks } = await response.json<{ tasks: AddedBody[] }>();
    expect(tasks.map(({ task, replayed }) => ({ number: task.number, replayed }))).toEqual([{ number: 1, replayed: true }]);
  });

  test('an empty batch is batch_empty and a batch of 51 is batch_too_large', async () => {
    const project = await createOwnedProject();
    const empty = await addTasks({ project, tasks: [] });
    expect(empty.status).toBe(HttpStatus.Unprocessable);
    expect(await empty.json()).toMatchObject({ error: 'rule_violated', issue: RuleIssue.BatchEmpty });
    const tooMany = Array.from({ length: TASK_BATCH_MAX_SIZE + 1 }, (_unused, index) => ({ title: `Task ${index}` }));
    const response = await addTasks({ project, tasks: tooMany });
    expect(response.status).toBe(HttpStatus.Unprocessable);
    expect(await response.json()).toMatchObject({ error: 'rule_violated', issue: RuleIssue.BatchTooLarge });
  });

  test('a blank second title is title_empty at index 1 and nothing is added', async () => {
    const project = await createOwnedProject();
    const response = await addTasks({ project, tasks: [{ title: 'Fine' }, { title: '   ' }] });
    expect(response.status).toBe(HttpStatus.Unprocessable);
    expect(await response.json()).toEqual({ error: 'rule_violated', issue: RuleIssue.TitleEmpty, index: 1 });
    const history = await projectCall({ project, method: 'GET', path: '/tasks/1/history' });
    expect(history.status).toBe(HttpStatus.NotFound);
  });

  test.each([
    ['not JSON', { rawBody: '{' }],
    ['no tasks field', { body: {} }],
    ['a task without a title', { body: { tasks: [{ notes: 'x' }] } }],
    ['a title that is not text', { body: { tasks: [{ title: 5 }] } }],
    ['a due date that is not text', { body: { tasks: [{ title: 'x', due_date: 5 }] } }],
  ])('%s answers 400 invalid_request', async (_name, payload) => {
    const project = await createOwnedProject();
    const response = await projectCall({ project, method: 'POST', path: '/tasks', ...payload });
    expect(response.status).toBe(HttpStatus.BadRequest);
    expect(await response.json()).toEqual(INVALID_REQUEST);
  });

  test('no session answers 401 and an unknown project 404 not_found', async () => {
    const project = await createOwnedProject();
    const anonymous = await ownerCall({ method: 'POST', path: `/owner/projects/${project.projectId}/tasks`, body: { tasks: [] } });
    expect(anonymous.status).toBe(HttpStatus.Unauthorized);
    const { token } = await signInOwner();
    const unknown = await ownerCall({ method: 'POST', path: `/owner/projects/${crypto.randomUUID()}/tasks`, token, body: { tasks: [] } });
    expect(unknown.status).toBe(HttpStatus.NotFound);
    expect(await unknown.json()).toEqual(NOT_FOUND);
  });
});

describe('PATCH /owner/projects/:projectId/tasks/:number', () => {
  test('patches notes and due date, then a title alone keeps both', async () => {
    const project = await createOwnedProject();
    await addTitled({ project, titles: ['Old title'] });
    const patched = await updatedTask({ project, number: 1, body: { notes: 'Details', due_date: '2026-12-01' } });
    expect(patched).toMatchObject({ title: 'Old title', notes: 'Details', due_date: '2026-12-01' });
    const renamed = await updatedTask({ project, number: 1, body: { title: 'New title' } });
    expect(renamed).toMatchObject({ title: 'New title', notes: 'Details', due_date: '2026-12-01' });
  });

  test('null notes clear the notes and keep the due date', async () => {
    const project = await createOwnedProject();
    await addTitled({ project, titles: ['Task'] });
    await updatedTask({ project, number: 1, body: { notes: 'Details', due_date: '2026-12-01' } });
    const cleared = await updatedTask({ project, number: 1, body: { notes: null } });
    expect(cleared).toMatchObject({ notes: null, due_date: '2026-12-01' });
  });

  test('null due date clears the due date and keeps the notes', async () => {
    const project = await createOwnedProject();
    await addTitled({ project, titles: ['Task'] });
    await updatedTask({ project, number: 1, body: { notes: 'Details', due_date: '2026-12-01' } });
    const cleared = await updatedTask({ project, number: 1, body: { due_date: null } });
    expect(cleared).toMatchObject({ notes: 'Details', due_date: null });
  });

  test('an empty patch is nothing_to_update', async () => {
    const project = await createOwnedProject();
    await addTitled({ project, titles: ['Task'] });
    const response = await updateTask({ project, number: 1, body: {} });
    expect(response.status).toBe(HttpStatus.Unprocessable);
    expect(await response.json()).toMatchObject({ error: 'rule_violated', issue: RuleIssue.NothingToUpdate });
  });

  test('placement after an anchor puts the order key between the anchor and its successor', async () => {
    const project = await createOwnedProject();
    const [, second, third] = await addTitled({ project, titles: ['One', 'Two', 'Three'] });
    const moved = await updatedTask({ project, number: 1, body: { placement: { kind: 'after', anchor: 2 } } });
    expect(moved.order_key > present(second).order_key).toBe(true);
    expect(moved.order_key < present(third).order_key).toBe(true);
  });

  test('placement first and last are accepted without an anchor', async () => {
    const project = await createOwnedProject();
    const [first, second] = await addTitled({ project, titles: ['One', 'Two', 'Three'] });
    const movedFirst = await updatedTask({ project, number: 3, body: { placement: { kind: 'first' } } });
    expect(movedFirst.order_key < present(first).order_key).toBe(true);
    const movedLast = await updatedTask({ project, number: 1, body: { placement: { kind: 'last' } } });
    expect(movedLast.order_key > present(second).order_key).toBe(true);
  });

  test('placing a task relative to itself is placement_anchor_invalid', async () => {
    const project = await createOwnedProject();
    await addTitled({ project, titles: ['One', 'Two'] });
    const response = await updateTask({ project, number: 2, body: { placement: { kind: 'after', anchor: 2 } } });
    expect(response.status).toBe(HttpStatus.Unprocessable);
    expect(await response.json()).toMatchObject({ error: 'rule_violated', issue: RuleIssue.PlacementAnchorInvalid });
  });

  test('a missing task answers 404 task_not_found with its number', async () => {
    const project = await createOwnedProject();
    const response = await updateTask({ project, number: MISSING_NUMBER, body: { title: 'Nope' } });
    expect(response.status).toBe(HttpStatus.NotFound);
    expect(await response.json()).toEqual({ error: 'task_not_found', number: MISSING_NUMBER });
  });

  test.each([
    ['not JSON', { rawBody: '{' }],
    ['a title that is not text', { body: { title: 5 } }],
    ['a placement kind that does not exist', { body: { placement: { kind: 'middle' } } }],
    ['a before placement without an anchor', { body: { placement: { kind: 'before' } } }],
    ['an anchor that is not a number', { body: { placement: { kind: 'before', anchor: 'T-1' } } }],
  ])('%s answers 400 invalid_request', async (_name, payload) => {
    const project = await createOwnedProject();
    await addTitled({ project, titles: ['Task'] });
    const response = await projectCall({ project, method: 'PATCH', path: '/tasks/1', ...payload });
    expect(response.status).toBe(HttpStatus.BadRequest);
    expect(await response.json()).toEqual(INVALID_REQUEST);
  });
});

describe('POST /owner/projects/:projectId/tasks/complete and /reopen', () => {
  test('completes with a note, reports already_done on the second call and reopens', async () => {
    const project = await createOwnedProject();
    await addTitled({ project, titles: ['One', 'Two'] });
    const first = await completeTasks({ project, body: { numbers: [1, 2], note: 'Shipped' } });
    expect(first.status).toBe(HttpStatus.Ok);
    const firstAnswer = await first.json<{ tasks: { task: TaskBody; already_done: boolean }[] }>();
    expect(firstAnswer.tasks.map(({ task, already_done }) => ({ state: task.state, already_done }))).toEqual([
      { state: TaskState.Done, already_done: false },
      { state: TaskState.Done, already_done: false },
    ]);
    const again = await completeTasks({ project, body: { numbers: [1] } });
    const againAnswer = await again.json<{ tasks: { already_done: boolean }[] }>();
    expect(againAnswer.tasks.map(({ already_done }) => already_done)).toEqual([true]);
    const reopened = await reopenTasks({ project, body: { numbers: [1, 2] } });
    expect(reopened.status).toBe(HttpStatus.Ok);
    const reopenedAnswer = await reopened.json<{ tasks: { task: TaskBody; already_open: boolean }[] }>();
    expect(reopenedAnswer.tasks.map(({ task, already_open }) => ({ state: task.state, already_open }))).toEqual([
      { state: TaskState.Open, already_open: false },
      { state: TaskState.Open, already_open: false },
    ]);
    const reopenedAgain = await reopenTasks({ project, body: { numbers: [1] } });
    const reopenedAgainAnswer = await reopenedAgain.json<{ tasks: { already_open: boolean }[] }>();
    expect(reopenedAgainAnswer.tasks.map(({ already_open }) => already_open)).toEqual([true]);
  });

  test('a missing number answers 404 task_not_found and completes nothing', async () => {
    const project = await createOwnedProject();
    await addTitled({ project, titles: ['One'] });
    const response = await completeTasks({ project, body: { numbers: [1, MISSING_NUMBER] } });
    expect(response.status).toBe(HttpStatus.NotFound);
    expect(await response.json()).toEqual({ error: 'task_not_found', number: MISSING_NUMBER });
    const history = await historyOf({ project, number: 1 });
    expect(history.map((entry) => entry.action)).toEqual([HistoryAction.Created]);
  });

  test('an empty list of numbers is batch_empty', async () => {
    const project = await createOwnedProject();
    const response = await completeTasks({ project, body: { numbers: [] } });
    expect(response.status).toBe(HttpStatus.Unprocessable);
    expect(await response.json()).toMatchObject({ error: 'rule_violated', issue: RuleIssue.BatchEmpty });
  });

  test.each([
    ['complete without numbers', '/tasks/complete', {}],
    ['complete with numbers that are not numbers', '/tasks/complete', { numbers: ['1'] }],
    ['complete with a note that is not text', '/tasks/complete', { numbers: [1], note: 5 }],
    ['reopen without numbers', '/tasks/reopen', {}],
    ['reopen with numbers that are not numbers', '/tasks/reopen', { numbers: ['1'] }],
  ])('%s answers 400 invalid_request', async (_name, path, body) => {
    const project = await createOwnedProject();
    const response = await projectCall({ project, method: 'POST', path, body });
    expect(response.status).toBe(HttpStatus.BadRequest);
    expect(await response.json()).toEqual(INVALID_REQUEST);
  });
});

describe('GET /owner/projects/:projectId/tasks/:number/history', () => {
  test('lists created, updated, completed and reopened in order, naming the owner and carrying the note', async () => {
    const project = await createOwnedProject();
    await addTitled({ project, titles: ['Task'] });
    await updatedTask({ project, number: 1, body: { title: 'Renamed' } });
    await completeTasks({ project, body: { numbers: [1], note: 'All done' } });
    await reopenTasks({ project, body: { numbers: [1] } });
    const history = await historyOf({ project, number: 1 });
    expect(history.map((entry) => entry.action)).toEqual([
      HistoryAction.Created,
      HistoryAction.Updated,
      HistoryAction.Completed,
      HistoryAction.Reopened,
    ]);
    expect(history.every((entry) => entry.actor.kind === ActorKind.Owner && entry.actor.client_name === OWNER_CLIENT_NAME)).toBe(true);
    expect(history[1]?.fields).toEqual(['title']);
    expect(history[2]?.note).toBe('All done');
  });

  test('a missing task answers 404 task_not_found with its number', async () => {
    const project = await createOwnedProject();
    const response = await projectCall({ project, method: 'GET', path: `/tasks/${MISSING_NUMBER}/history` });
    expect(response.status).toBe(HttpStatus.NotFound);
    expect(await response.json()).toEqual({ error: 'task_not_found', number: MISSING_NUMBER });
  });

  test('a task an agent added names the agent and its client', async () => {
    const project = await createOwnedProject();
    const key = await issueMcpKey({ token: project.token, projectId: project.projectId });
    const client = await connectClient({ era: ClientEra.Legacy, key });
    await callTool({ client, name: McpToolName.Add, args: { tasks: [{ title: 'From the agent' }] } });
    const history = await historyOf({ project, number: 1 });
    expect(history.map((entry) => entry.actor)).toEqual([{ kind: ActorKind.Agent, client_name: AGENT_CLIENT_NAME }]);
  });
});
