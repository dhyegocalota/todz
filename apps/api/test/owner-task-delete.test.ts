import { describe, expect, test } from 'vitest';
import { HttpStatus } from '../src/http-status';
import { type OwnedProject, createOwnedProject, projectCall } from './owner-client';

const NEVER_ISSUED_NUMBER = 99;
const NOT_FOUND = { error: 'not_found' };
const INVALID_REQUEST = { error: 'invalid_request' };
const SHOWN_TITLE = 'Write the brief';

type TaskBody = { number: number; title: string };
type ChangesBody = { tasks: TaskBody[]; deleted_numbers: number[]; cursor: number; has_more: boolean };

async function addedNumbers({ project, titles }: { project: OwnedProject; titles: string[] }): Promise<number[]> {
  const response = await projectCall({ project, method: 'POST', path: '/tasks', body: { tasks: titles.map((title) => ({ title })) } });
  expect(response.status).toBe(HttpStatus.Created);
  const { tasks } = await response.json<{ tasks: { task: TaskBody }[] }>();
  return tasks.map(({ task }) => task.number);
}

function deleteTask({ project, number, title }: { project: OwnedProject; number: number; title: string }): Promise<Response> {
  return projectCall({ project, method: 'DELETE', path: `/tasks/${number}`, body: { title } });
}

async function changesFromStart(project: OwnedProject): Promise<ChangesBody> {
  const response = await projectCall({ project, method: 'GET', path: '/changes?cursor=0' });
  expect(response.status).toBe(HttpStatus.Ok);
  return response.json<ChangesBody>();
}

describe('DELETE /owner/projects/:projectId/tasks/:number', () => {
  test('the owner deletes a task, and the feed lists its number as deleted', async () => {
    const project = await createOwnedProject();
    const [kept, deleted] = await addedNumbers({ project, titles: ['Book the venue', SHOWN_TITLE] });
    const response = await deleteTask({ project, number: deleted!, title: SHOWN_TITLE });
    expect(response.status).toBe(HttpStatus.NoContent);
    const changes = await changesFromStart(project);
    expect(changes.tasks.map((task) => task.number)).toEqual([kept]);
    expect(changes.deleted_numbers).toEqual([deleted]);
  });

  test('a title other than the one the app showed is refused, and the task stays', async () => {
    const project = await createOwnedProject();
    const [number] = await addedNumbers({ project, titles: [SHOWN_TITLE] });
    await projectCall({ project, method: 'PATCH', path: `/tasks/${number}`, body: { title: 'Renamed by an agent' } });
    const response = await deleteTask({ project, number: number!, title: SHOWN_TITLE });
    expect(response.status).toBe(HttpStatus.Unprocessable);
    expect(await response.json()).toEqual({ error: 'rule_violated', issue: 'confirmation_mismatch', index: null });
    expect((await changesFromStart(project)).tasks.map((task) => task.number)).toEqual([number]);
  });

  test('a delete without the shown title is an invalid request', async () => {
    const project = await createOwnedProject();
    const [number] = await addedNumbers({ project, titles: [SHOWN_TITLE] });
    const response = await projectCall({ project, method: 'DELETE', path: `/tasks/${number}` });
    expect(response.status).toBe(HttpStatus.BadRequest);
    expect(await response.json()).toEqual(INVALID_REQUEST);
  });

  test('a deleted or never issued number is task_not_found', async () => {
    const project = await createOwnedProject();
    const [number] = await addedNumbers({ project, titles: [SHOWN_TITLE] });
    await deleteTask({ project, number: number!, title: SHOWN_TITLE });
    const again = await deleteTask({ project, number: number!, title: SHOWN_TITLE });
    expect(again.status).toBe(HttpStatus.NotFound);
    expect(await again.json()).toEqual({ error: 'task_not_found', number });
    const missing = await deleteTask({ project, number: NEVER_ISSUED_NUMBER, title: SHOWN_TITLE });
    expect(missing.status).toBe(HttpStatus.NotFound);
    expect(await missing.json()).toEqual({ error: 'task_not_found', number: NEVER_ISSUED_NUMBER });
  });

  test("another owner's project is not_found and the task stays", async () => {
    const project = await createOwnedProject();
    const stranger = await createOwnedProject();
    const [number] = await addedNumbers({ project, titles: [SHOWN_TITLE] });
    const response = await deleteTask({ project: { ...stranger, projectId: project.projectId }, number: number!, title: SHOWN_TITLE });
    expect(response.status).toBe(HttpStatus.NotFound);
    expect(await response.json()).toEqual(NOT_FOUND);
    expect((await changesFromStart(project)).tasks.map((task) => task.number)).toEqual([number]);
  });
});
