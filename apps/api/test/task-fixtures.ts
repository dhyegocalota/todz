import { env } from 'cloudflare:workers';
import {
  type Actor,
  type CalendarDate,
  OWNER_ACTOR,
  type Task,
  type TaskDraft,
  type TaskFilter,
  agentActor,
  parseCalendarDate,
} from '@todz/core';
import { LIST_LIMIT_MAX, TaskState } from '@todz/types';
import type { ProjectResult } from '../src/project-result';
import type { ProjectStore } from '../src/project-store';

export const CLOCK_NOW = 1_795_446_000_000;
export const TODAY = '2026-11-23';
export const AGENT_ACTOR: Actor = agentActor('Claude Code');

export function unwrap<Value>(result: ProjectResult<Value>): Value {
  if (!result.ok) throw new Error(`expected an ok result, got ${JSON.stringify(result.failure)}`);
  return result.value;
}

export function draftOf(title: string): TaskDraft {
  return { title, notes: null, dueDate: null, idempotencyKey: null };
}

export function openTasksFilter(): TaskFilter {
  return { state: TaskState.Open, dueWindows: [], text: null, limit: LIST_LIMIT_MAX };
}

export function calendarDate(text: string): CalendarDate {
  const date = parseCalendarDate(text);
  if (date === null) throw new Error(`${text} is not a calendar date`);
  return date;
}

export function newProjectStub(): DurableObjectStub<ProjectStore> {
  return env.PROJECT_STORE.get(env.PROJECT_STORE.idFromName(crypto.randomUUID()));
}

export function buildTask(overrides: Partial<Task> = {}): Task {
  return {
    number: 1,
    title: 'Write the spec',
    notes: null,
    dueDate: null,
    state: TaskState.Open,
    orderKey: 'a0',
    idempotencyKey: null,
    createdBy: OWNER_ACTOR,
    createdAt: CLOCK_NOW,
    updatedAt: CLOCK_NOW,
    completedAt: null,
    ...overrides,
  };
}
