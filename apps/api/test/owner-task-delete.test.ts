import { describe, expect, test } from 'vitest';
import { HttpStatus } from '../src/http-status';
import { type OwnedProject, createOwnedProject, projectCall } from './owner-client';

const NEVER_ISSUED_NUMBER = 99;
const NOT_FOUND = { error: 'not_found' };

type TaskBody = { number: number; title: string };
type ChangesBody = { tasks: TaskBody[]; deleted_numbers: number[]; cursor: number; has_more: boolean };

async function addedNumbers({ project, titles }: { project: OwnedProject; titles: string[] }): Promise<number[]> {
  const response = await projectCall({ project, method: 'POST', path: '/tasks', body: { tasks: titles.map((title) => ({ title })) } });
  expect(response.status).toBe(HttpStatus.Created);
  const { tasks } = await response.json<{ tasks: { task: TaskBody }[] }>();
  return tasks.map(({ task }) => task.number);
}

function deleteTask({ project, number }: { project: OwnedProject; number: number }): Promise<Response> {
  return projectCall({ project, method: 'DELETE', path: `/tasks/${number}` });
}

async function changesFromStart(project: OwnedProject): Promise<ChangesBody> {
  const response = await projectCall({ project, method: 'GET', path: '/changes?cursor=0' });
  expect(response.status).toBe(HttpStatus.Ok);
  return response.json<ChangesBody>();
}

describe('DELETE /owner/projects/:projectId/tasks/:number', () => {
  test('the owner deletes a task, and the feed lists its number as deleted', async () => {
    const project = await createOwnedProject();
    const [kept, deleted] = await addedNumbers({ project, titles: ['Write the brief', 'Book the venue'] });
    const response = await deleteTask({ project, number: deleted! });
    expect(response.status).toBe(HttpStatus.NoContent);
    const changes = await changesFromStart(project);
    expect(changes.tasks.map((task) => task.number)).toEqual([kept]);
    expect(changes.deleted_numbers).toEqual([deleted]);
  });

  test('a deleted or never issued number is task_not_found', async () => {
    const project = await createOwnedProject();
    const [number] = await addedNumbers({ project, titles: ['Write the brief'] });
    await deleteTask({ project, number: number! });
    const again = await deleteTask({ project, number: number! });
    expect(again.status).toBe(HttpStatus.NotFound);
    expect(await again.json()).toEqual({ error: 'task_not_found', number });
    const missing = await deleteTask({ project, number: NEVER_ISSUED_NUMBER });
    expect(missing.status).toBe(HttpStatus.NotFound);
    expect(await missing.json()).toEqual({ error: 'task_not_found', number: NEVER_ISSUED_NUMBER });
  });

  test("another owner's project is not_found and the task stays", async () => {
    const project = await createOwnedProject();
    const stranger = await createOwnedProject();
    const [number] = await addedNumbers({ project, titles: ['Write the brief'] });
    const response = await deleteTask({ project: { ...stranger, projectId: project.projectId }, number: number! });
    expect(response.status).toBe(HttpStatus.NotFound);
    expect(await response.json()).toEqual(NOT_FOUND);
    expect((await changesFromStart(project)).tasks.map((task) => task.number)).toEqual([number]);
  });
});
