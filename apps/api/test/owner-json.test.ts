import { type Actor, OWNER_ACTOR, type Task, agentActor, parseCalendarDate } from '@todz/core';
import { ActorKind, HistoryAction, TaskField, TaskState } from '@todz/types';
import { describe, expect, test } from 'vitest';
import { actorJson, historyEntryJson, keyJson, ownerJson, projectJson, taskJson, workspaceJson } from '../src/owner-json';
import { CLOCK_NOW } from './task-fixtures';

const AGENT_NAME = 'Claude Code';
const DUE_DATE = parseCalendarDate('2026-12-01');

function openTask(overrides: Partial<Task> = {}): Task {
  if (DUE_DATE === null) throw new Error('the fixture date should parse');
  return {
    number: 7,
    title: 'Write the report',
    notes: 'Two pages',
    dueDate: DUE_DATE,
    state: TaskState.Open,
    orderKey: 'a0',
    idempotencyKey: 'once-7',
    createdBy: OWNER_ACTOR,
    createdAt: CLOCK_NOW,
    updatedAt: CLOCK_NOW + 1,
    completedAt: null,
    ...overrides,
  };
}

describe('ownerJson', () => {
  test('names the id, the time zone and the agent nudge in snake case', () => {
    expect(ownerJson({ id: 'owner-1', timeZone: 'America/Sao_Paulo', agentNudge: true })).toEqual({
      id: 'owner-1',
      time_zone: 'America/Sao_Paulo',
      agent_nudge: true,
    });
  });
});

describe('projectJson', () => {
  test('answers is_inbox as a boolean and the creation time in milliseconds', () => {
    expect(projectJson({ id: 'p-1', name: 'Inbox', isInbox: true, createdAt: CLOCK_NOW })).toEqual({
      id: 'p-1',
      name: 'Inbox',
      is_inbox: true,
      created_at: CLOCK_NOW,
    });
    expect(projectJson({ id: 'p-2', name: 'Inbox', isInbox: false, createdAt: CLOCK_NOW })).toMatchObject({ is_inbox: false });
  });
});

describe('workspaceJson', () => {
  test('lists its projects in the order given', () => {
    const inbox = { id: 'p-1', name: 'Inbox', isInbox: true, createdAt: CLOCK_NOW };
    const regular = { id: 'p-2', name: 'Launch', isInbox: false, createdAt: CLOCK_NOW + 1 };
    expect(workspaceJson({ workspace: { id: 'w-1', name: 'Logic Bit', createdAt: CLOCK_NOW }, projects: [inbox, regular] })).toEqual({
      id: 'w-1',
      name: 'Logic Bit',
      created_at: CLOCK_NOW,
      projects: [projectJson(inbox), projectJson(regular)],
    });
  });

  test('a workspace without projects answers an empty list', () => {
    expect(workspaceJson({ workspace: { id: 'w-1', name: 'Empty', createdAt: CLOCK_NOW }, projects: [] })).toMatchObject({ projects: [] });
  });
});

describe('keyJson', () => {
  test('names the id, the hint and the creation time and nothing else', () => {
    expect(keyJson({ id: 'k-1', hint: 'abcd', createdAt: CLOCK_NOW })).toEqual({ id: 'k-1', hint: 'abcd', created_at: CLOCK_NOW });
  });
});

describe('actorJson', () => {
  test.each<[string, Actor, unknown]>([
    ['the owner has no client name', OWNER_ACTOR, { kind: ActorKind.Owner, client_name: null }],
    ['an agent names its client', agentActor(AGENT_NAME), { kind: ActorKind.Agent, client_name: AGENT_NAME }],
  ])('%s', (_name, actor, expected) => {
    expect(actorJson(actor)).toEqual(expected);
  });
});

describe('taskJson', () => {
  test('names every field in snake case with its actor nested', () => {
    expect(taskJson(openTask())).toEqual({
      number: 7,
      title: 'Write the report',
      notes: 'Two pages',
      due_date: '2026-12-01',
      state: TaskState.Open,
      order_key: 'a0',
      idempotency_key: 'once-7',
      created_by: { kind: ActorKind.Owner, client_name: null },
      created_at: CLOCK_NOW,
      updated_at: CLOCK_NOW + 1,
      completed_at: null,
    });
  });

  test('keeps absent notes, due date and idempotency key as null', () => {
    expect(taskJson(openTask({ notes: null, dueDate: null, idempotencyKey: null }))).toMatchObject({
      notes: null,
      due_date: null,
      idempotency_key: null,
    });
  });

  test('a done task carries its completion time and an agent author', () => {
    const done = openTask({ state: TaskState.Done, completedAt: CLOCK_NOW + 2, createdBy: agentActor(AGENT_NAME) });
    expect(taskJson(done)).toMatchObject({
      state: TaskState.Done,
      completed_at: CLOCK_NOW + 2,
      created_by: { kind: ActorKind.Agent, client_name: AGENT_NAME },
    });
  });
});

describe('historyEntryJson', () => {
  test('names the time, the actor, the action, the fields and the note', () => {
    const entry = {
      at: CLOCK_NOW,
      actor: agentActor(AGENT_NAME),
      action: HistoryAction.Updated,
      fields: [TaskField.Title, TaskField.DueDate],
      note: null,
    };
    expect(historyEntryJson(entry)).toEqual({
      at: CLOCK_NOW,
      actor: { kind: ActorKind.Agent, client_name: AGENT_NAME },
      action: HistoryAction.Updated,
      fields: ['title', 'due_date'],
      note: null,
    });
  });

  test('a completion note is kept', () => {
    const entry = { at: CLOCK_NOW, actor: OWNER_ACTOR, action: HistoryAction.Completed, fields: [], note: 'Shipped' };
    expect(historyEntryJson(entry)).toMatchObject({ action: 'completed', fields: [], note: 'Shipped' });
  });
});
