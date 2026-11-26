import { RuleIssue, TASK_NOTES_MAX_LENGTH, TASK_TITLE_MAX_LENGTH } from '@todz/types';
import { describe, expect, test } from 'vitest';
import { HttpStatus } from '../src/http-status';
import { type OwnedProject, createOwnedProject, projectCall } from './owner-client';

const FOUR_BYTE_CHARACTER = '😀';
const FIRST_TASK_NUMBER = 1;

function notesOf(length: number): string {
  return FOUR_BYTE_CHARACTER.repeat(length);
}

function addWithNotes({ project, notes }: { project: OwnedProject; notes: string }): Promise<Response> {
  return projectCall({ project, method: 'POST', path: '/tasks', body: { tasks: [{ title: 'Long notes', notes }] } });
}

function updateNotes({ project, notes }: { project: OwnedProject; notes: string }): Promise<Response> {
  return projectCall({ project, method: 'PATCH', path: `/tasks/${FIRST_TASK_NUMBER}`, body: { notes } });
}

async function projectWithOneTask(): Promise<OwnedProject> {
  const project = await createOwnedProject();
  const response = await addWithNotes({ project, notes: 'short' });
  expect(response.status).toBe(HttpStatus.Created);
  return project;
}

describe('the owner API holds the largest valid task write', () => {
  test('an add with notes exactly at the cap answers 201 and one character over answers 422 notes_too_long', async () => {
    const project = await createOwnedProject();
    expect((await addWithNotes({ project, notes: notesOf(TASK_NOTES_MAX_LENGTH) })).status).toBe(HttpStatus.Created);
    const refused = await addWithNotes({ project, notes: notesOf(TASK_NOTES_MAX_LENGTH + 1) });
    expect(refused.status).toBe(HttpStatus.Unprocessable);
    expect(await refused.json()).toMatchObject({ error: 'rule_violated', issue: RuleIssue.NotesTooLong });
  });

  test('an update with notes exactly at the cap answers 200 and one character over answers 422 notes_too_long', async () => {
    const project = await projectWithOneTask();
    expect((await updateNotes({ project, notes: notesOf(TASK_NOTES_MAX_LENGTH) })).status).toBe(HttpStatus.Ok);
    const refused = await updateNotes({ project, notes: notesOf(TASK_NOTES_MAX_LENGTH + 1) });
    expect(refused.status).toBe(HttpStatus.Unprocessable);
    expect(await refused.json()).toMatchObject({ error: 'rule_violated', issue: RuleIssue.NotesTooLong });
  });

  test('a title at the cap with notes at the cap is accepted together', async () => {
    const project = await createOwnedProject();
    const response = await projectCall({
      project,
      method: 'POST',
      path: '/tasks',
      body: { tasks: [{ title: FOUR_BYTE_CHARACTER.repeat(TASK_TITLE_MAX_LENGTH), notes: notesOf(TASK_NOTES_MAX_LENGTH) }] },
    });
    expect(response.status).toBe(HttpStatus.Created);
  });
});
