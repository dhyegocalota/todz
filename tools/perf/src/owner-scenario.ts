import { booleanOf, fieldOf, listOf, numberOf, textOf } from './json-reader';

export type OwnerConnection = { origin: string; token: string; fetch: typeof fetch };

export type WorkspaceListing = { id: string; name: string; projectIds: string[] };

export type ChangePage = { taskNumbers: number[]; cursor: number; hasMore: boolean };

type OwnerCall = { connection: OwnerConnection; method: string; path: string; body?: unknown };

const JSON_MEDIA_TYPE = 'application/json';
const TIME_ZONE = 'UTC';

async function answerOf({ connection, method, path, body }: OwnerCall): Promise<unknown> {
  const headers = { Authorization: `Bearer ${connection.token}`, 'Content-Type': JSON_MEDIA_TYPE };
  const response = await connection.fetch(`${connection.origin}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`${method} ${path} answered ${response.status}`);
  return response.json();
}

function projectPath(projectId: string): string {
  return `/owner/projects/${projectId}`;
}

function taskNumbersOf(answer: unknown): number[] {
  return listOf(fieldOf({ value: answer, name: 'tasks' })).map((entry) =>
    numberOf(fieldOf({ value: fieldOf({ value: entry, name: 'task' }), name: 'number' })),
  );
}

export async function signInOwner({
  origin,
  fetch,
  identity,
}: {
  origin: string;
  fetch: typeof globalThis.fetch;
  identity: string;
}): Promise<OwnerConnection> {
  const response = await fetch(`${origin}/owner/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': JSON_MEDIA_TYPE },
    body: JSON.stringify({ identity_token: identity, time_zone: TIME_ZONE }),
  });
  if (!response.ok) throw new Error(`POST /owner/sessions answered ${response.status}`);
  const token = textOf(fieldOf({ value: await response.json(), name: 'session_token' }));
  return { origin, token, fetch };
}

export async function listWorkspaces(connection: OwnerConnection): Promise<WorkspaceListing[]> {
  const answer = await answerOf({ connection, method: 'GET', path: '/owner/workspaces' });
  return listOf(fieldOf({ value: answer, name: 'workspaces' })).map((workspace) => ({
    id: textOf(fieldOf({ value: workspace, name: 'id' })),
    name: textOf(fieldOf({ value: workspace, name: 'name' })),
    projectIds: listOf(fieldOf({ value: workspace, name: 'projects' })).map((project) => textOf(fieldOf({ value: project, name: 'id' }))),
  }));
}

export async function readChanges({
  connection,
  projectId,
  cursor,
}: {
  connection: OwnerConnection;
  projectId: string;
  cursor: number;
}): Promise<ChangePage> {
  const answer = await answerOf({ connection, method: 'GET', path: `${projectPath(projectId)}/changes?cursor=${cursor}` });
  return {
    taskNumbers: listOf(fieldOf({ value: answer, name: 'tasks' })).map((task) => numberOf(fieldOf({ value: task, name: 'number' }))),
    cursor: numberOf(fieldOf({ value: answer, name: 'cursor' })),
    hasMore: booleanOf(fieldOf({ value: answer, name: 'has_more' })),
  };
}

export async function addOwnerTasks({
  connection,
  projectId,
  titles,
}: {
  connection: OwnerConnection;
  projectId: string;
  titles: string[];
}): Promise<number[]> {
  const body = { tasks: titles.map((title) => ({ title })) };
  return taskNumbersOf(await answerOf({ connection, method: 'POST', path: `${projectPath(projectId)}/tasks`, body }));
}

export async function completeOwnerTasks({
  connection,
  projectId,
  numbers,
}: {
  connection: OwnerConnection;
  projectId: string;
  numbers: number[];
}): Promise<void> {
  await answerOf({ connection, method: 'POST', path: `${projectPath(projectId)}/tasks/complete`, body: { numbers } });
}

export async function createWorkspace({
  connection,
  name,
}: {
  connection: OwnerConnection;
  name: string;
}): Promise<{ workspaceId: string; inboxId: string }> {
  const answer = await answerOf({ connection, method: 'POST', path: '/owner/workspaces', body: { name } });
  const workspace = fieldOf({ value: answer, name: 'workspace' });
  const [inbox] = listOf(fieldOf({ value: workspace, name: 'projects' }));
  return { workspaceId: textOf(fieldOf({ value: workspace, name: 'id' })), inboxId: textOf(fieldOf({ value: inbox, name: 'id' })) };
}

export async function createProject({
  connection,
  workspaceId,
  name,
}: {
  connection: OwnerConnection;
  workspaceId: string;
  name: string;
}): Promise<string> {
  const answer = await answerOf({ connection, method: 'POST', path: `/owner/workspaces/${workspaceId}/projects`, body: { name } });
  return textOf(fieldOf({ value: fieldOf({ value: answer, name: 'project' }), name: 'id' }));
}

export async function issueKey({ connection, projectId }: { connection: OwnerConnection; projectId: string }): Promise<string> {
  const answer = await answerOf({ connection, method: 'POST', path: `${projectPath(projectId)}/keys` });
  return textOf(fieldOf({ value: answer, name: 'secret' }));
}
