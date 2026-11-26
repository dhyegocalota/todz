import { RuleIssue, TaskPlacement, TaskState } from '@todz/types';
import { runInDurableObject } from 'cloudflare:test';
import { describe, expect, test } from 'vitest';
import { ProjectFailureKind } from '../src/project-result';
import { AGENT_ACTOR, TODAY, draftOf, newProjectStub, openTasksFilter, unwrap } from './task-fixtures';

type ProjectStub = ReturnType<typeof newProjectStub>;

const SECRET_NOTES = 'the secret notes';
const COMPLETION_NOTE = 'the secret completion note';
const IDEMPOTENCY_KEY = 'import-1';
const MISSING_NUMBER = 9;

async function projectWith({ titles }: { titles: string[] }): Promise<ProjectStub> {
  const stub = newProjectStub();
  unwrap(await stub.addTasks({ actor: AGENT_ACTOR, drafts: titles.map(draftOf) }));
  return stub;
}

async function openTitles(stub: ProjectStub): Promise<string[]> {
  const list = unwrap(await stub.listTasks({ today: TODAY, filter: openTasksFilter() }));
  return list.tasks.map((task) => task.title);
}

describe('ProjectStore deleteTask', () => {
  test('a confirmation equal to the title removes the task from every read and returns it', async () => {
    const stub = await projectWith({ titles: ['Keep', 'Remove me', 'Keep too'] });
    const removed = unwrap(await stub.deleteTask({ number: 2, confirmation: 'Remove me' }));
    expect(removed).toMatchObject({ number: 2, title: 'Remove me' });
    expect(await openTitles(stub)).toEqual(['Keep', 'Keep too']);
    expect(await stub.readTask({ number: 2 })).toEqual({ ok: false, failure: { kind: ProjectFailureKind.TaskNotFound, number: 2 } });
    expect(await stub.deleteTask({ number: 2, confirmation: 'Remove me' })).toEqual({
      ok: false,
      failure: { kind: ProjectFailureKind.TaskNotFound, number: 2 },
    });
  });

  test('a wrong confirmation is ConfirmationMismatch and the task stays', async () => {
    const stub = await projectWith({ titles: ['Remove me'] });
    expect(await stub.deleteTask({ number: 1, confirmation: 'remove me' })).toEqual({
      ok: false,
      failure: { kind: ProjectFailureKind.RuleViolated, issue: RuleIssue.ConfirmationMismatch, index: null },
    });
    expect(await openTitles(stub)).toEqual(['Remove me']);
  });

  test('a missing number is task not found', async () => {
    const stub = await projectWith({ titles: ['Only'] });
    expect(await stub.deleteTask({ number: MISSING_NUMBER, confirmation: 'Only' })).toEqual({
      ok: false,
      failure: { kind: ProjectFailureKind.TaskNotFound, number: MISSING_NUMBER },
    });
  });

  test('the next task skips a removed first task and a placement ignores its order key', async () => {
    const stub = await projectWith({ titles: ['First', 'Second', 'Third'] });
    unwrap(await stub.deleteTask({ number: 1, confirmation: 'First' }));
    expect(unwrap(await stub.nextTask({ today: TODAY }))).toMatchObject({ number: 2 });
    unwrap(await stub.updateTask({ actor: AGENT_ACTOR, number: 3, patch: { placement: { kind: TaskPlacement.First } } }));
    expect(await openTitles(stub)).toEqual(['Third', 'Second']);
  });

  test('the row keeps its number but loses its title, notes, idempotency key and completion notes', async () => {
    const stub = newProjectStub();
    unwrap(
      await stub.addTasks({
        actor: AGENT_ACTOR,
        drafts: [{ title: 'Remove me', notes: SECRET_NOTES, dueDate: null, idempotencyKey: IDEMPOTENCY_KEY }],
      }),
    );
    unwrap(await stub.completeTasks({ actor: AGENT_ACTOR, numbers: [1], note: COMPLETION_NOTE }));
    unwrap(await stub.deleteTask({ number: 1, confirmation: 'Remove me' }));
    const stored = await runInDurableObject(stub, (_instance, state) => ({
      task: state.storage.sql.exec('SELECT * FROM tasks').toArray(),
      history: state.storage.sql.exec('SELECT note FROM task_history').toArray(),
    }));
    expect(JSON.stringify(stored)).not.toContain('Remove me');
    expect(JSON.stringify(stored)).not.toContain(SECRET_NOTES);
    expect(JSON.stringify(stored)).not.toContain(COMPLETION_NOTE);
    expect(JSON.stringify(stored)).not.toContain(IDEMPOTENCY_KEY);
    expect(stored.task).toHaveLength(1);
  });

  test('the idempotency key of a removed task adds a new task instead of replaying it', async () => {
    const stub = newProjectStub();
    const draft = { title: 'Import', notes: null, dueDate: null, idempotencyKey: IDEMPOTENCY_KEY };
    unwrap(await stub.addTasks({ actor: AGENT_ACTOR, drafts: [draft] }));
    unwrap(await stub.deleteTask({ number: 1, confirmation: 'Import' }));
    const [added] = unwrap(await stub.addTasks({ actor: AGENT_ACTOR, drafts: [draft] }));
    expect(added).toMatchObject({ replayed: false, task: { number: 2 } });
  });

  test('the change feed reports the removed number once and keeps it out of the tasks', async () => {
    const stub = await projectWith({ titles: ['A', 'B'] });
    unwrap(await stub.deleteTask({ number: 1, confirmation: 'A' }));
    const changes = unwrap(await stub.readChanges({ cursor: 0 }));
    expect(changes.tasks.map((task) => task.number)).toEqual([2]);
    expect(changes.deletedNumbers).toEqual([1]);
    const later = unwrap(await stub.readChanges({ cursor: changes.cursor }));
    expect(later).toEqual({ tasks: [], deletedNumbers: [], cursor: changes.cursor, hasMore: false });
  });

  test('a removed done task leaves the done list', async () => {
    const stub = await projectWith({ titles: ['Done one'] });
    unwrap(await stub.completeTasks({ actor: AGENT_ACTOR, numbers: [1], note: null }));
    unwrap(await stub.deleteTask({ number: 1, confirmation: 'Done one' }));
    const list = unwrap(await stub.listTasks({ today: TODAY, filter: { ...openTasksFilter(), state: TaskState.Done } }));
    expect(list.tasks).toEqual([]);
  });
});

describe('ProjectStore readTask', () => {
  test('returns the task with its notes', async () => {
    const stub = newProjectStub();
    unwrap(
      await stub.addTasks({ actor: AGENT_ACTOR, drafts: [{ title: 'Read me', notes: SECRET_NOTES, dueDate: null, idempotencyKey: null }] }),
    );
    expect(unwrap(await stub.readTask({ number: 1 }))).toMatchObject({ title: 'Read me', notes: SECRET_NOTES });
  });

  test('a missing number is task not found', async () => {
    expect(await newProjectStub().readTask({ number: MISSING_NUMBER })).toEqual({
      ok: false,
      failure: { kind: ProjectFailureKind.TaskNotFound, number: MISSING_NUMBER },
    });
  });
});
