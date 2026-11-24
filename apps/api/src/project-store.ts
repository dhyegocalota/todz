import {
  type Actor,
  type AddedTask,
  type CalendarDate,
  type Clock,
  type CompletedTask,
  type HistoryEntry,
  OWNER_ACTOR,
  type ReopenedTask,
  type Task,
  type TaskDraft,
  type TaskFilter,
  type TaskList,
  type TaskPatch,
  addTasks,
  agentActor,
  completeTasks,
  listTasks,
  nextTask,
  parseCalendarDate,
  reopenTasks,
  updateTask,
} from '@todz/core';
import { ActorKind } from '@todz/types';
import { DurableObject } from 'cloudflare:workers';
import type { Env } from './env';
import { applyProjectSchema } from './project-schema';
import { ProjectFailureKind, type ProjectResult, resultOf } from './project-result';
import { SqliteTaskStore } from './sqlite-task-store';

export const CHANGE_PAGE_SIZE = 100;

export type TaskChanges = { tasks: Task[]; cursor: number; hasMore: boolean };

const SYSTEM_CLOCK: Clock = { now: () => Date.now() };

function trustedActor(actor: Actor): Actor {
  if (actor.kind === ActorKind.Owner) return OWNER_ACTOR;
  if (actor.kind === ActorKind.Agent) return agentActor(actor.clientName);
  throw new Error('the actor kind is not known');
}

function trustedToday(today: string): CalendarDate {
  const calendarDate = parseCalendarDate(today);
  if (calendarDate === null) throw new Error('today is not a calendar date');
  return calendarDate;
}

export class ProjectStore extends DurableObject<Env> {
  private readonly store: SqliteTaskStore;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.store = new SqliteTaskStore(ctx.storage.sql);
    ctx.blockConcurrencyWhile(async () => applyProjectSchema(ctx.storage));
  }

  addTasks({ actor, drafts }: { actor: Actor; drafts: TaskDraft[] }): ProjectResult<AddedTask[]> {
    return this.run(() => addTasks({ store: this.store, clock: SYSTEM_CLOCK, actor: trustedActor(actor), drafts }));
  }

  updateTask({ actor, number, patch }: { actor: Actor; number: number; patch: TaskPatch }): ProjectResult<Task> {
    return this.run(() => updateTask({ store: this.store, clock: SYSTEM_CLOCK, actor: trustedActor(actor), number, patch }));
  }

  completeTasks({ actor, numbers, note }: { actor: Actor; numbers: number[]; note: string | null }): ProjectResult<CompletedTask[]> {
    return this.run(() => completeTasks({ store: this.store, clock: SYSTEM_CLOCK, actor: trustedActor(actor), numbers, note }));
  }

  reopenTasks({ actor, numbers }: { actor: Actor; numbers: number[] }): ProjectResult<ReopenedTask[]> {
    return this.run(() => reopenTasks({ store: this.store, clock: SYSTEM_CLOCK, actor: trustedActor(actor), numbers }));
  }

  listTasks({ today, filter }: { today: string; filter: TaskFilter }): ProjectResult<TaskList> {
    return this.run(() => listTasks({ store: this.store, today: trustedToday(today), filter }));
  }

  nextTask({ today }: { today: string }): ProjectResult<Task | null> {
    return this.run(() => nextTask({ store: this.store, today: trustedToday(today) }));
  }

  readChanges({ cursor }: { cursor: number }): ProjectResult<TaskChanges> {
    return { ok: false, failure: { kind: ProjectFailureKind.TaskNotFound, number: cursor } };
  }

  readHistory({ number }: { number: number }): ProjectResult<HistoryEntry[]> {
    return { ok: false, failure: { kind: ProjectFailureKind.TaskNotFound, number } };
  }

  private run<Value>(useCase: () => Value): ProjectResult<Value> {
    return resultOf(() => this.ctx.storage.transactionSync(useCase));
  }
}
