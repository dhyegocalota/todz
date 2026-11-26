import {
  type Actor,
  type AddedTask,
  LimitViolation,
  type CalendarDate,
  type Clock,
  type CompletedTask,
  type DueNow,
  type HistoryEntry,
  OWNER_ACTOR,
  type ReopenedTask,
  type Task,
  type TaskDraft,
  type TaskFilter,
  type TaskList,
  type TaskPatch,
  TaskNotFoundError,
  addTasks,
  agentActor,
  completeTasks,
  dueNow,
  listTasks,
  nextTask,
  parseCalendarDate,
  reopenTasks,
  updateTask,
} from '@todz/core';
import { ActorKind, FairUseLimit, LAST_INDEX } from '@todz/types';
import { DurableObject } from 'cloudflare:workers';
import { touchWorkspaceActivity } from './directory-workspaces';
import type { Env } from './env';
import { HttpHeader } from './http-header';
import { HttpStatus } from './http-status';
import { applyProjectSchema } from './project-schema';
import { ProjectFailureKind, type ProjectResult, resultOf } from './project-result';
import { type ActivityCounts, SqliteTaskStore } from './sqlite-task-store';
import { ACTIVITY_WRITTEN_AT_KEY, isActivityWriteDue } from './workspace-activity';

export const CHANGE_PAGE_SIZE = 100;
const NO_CHANGE_NUMBER = 0;
const CHANGED_MESSAGE = 'changed';
const WEBSOCKET_UPGRADE = 'websocket';
const NORMAL_CLOSURE_CODE = 1000;
const SESSION_ENDED_REASON = 'session ended';

export type TaskChanges = { tasks: Task[]; cursor: number; hasMore: boolean };

const SYSTEM_CLOCK: Clock = { now: () => Date.now() };

function sendChanged(socket: WebSocket): void {
  try {
    socket.send(CHANGED_MESSAGE);
  } catch {
    return;
  }
}

function closeEndedSession(socket: WebSocket): void {
  try {
    socket.close(NORMAL_CLOSURE_CODE, SESSION_ENDED_REASON);
  } catch {
    return;
  }
}

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

  addTasks({ actor, drafts, openTasksMax }: { actor: Actor; drafts: TaskDraft[]; openTasksMax: number }): ProjectResult<AddedTask[]> {
    return this.runWrite(() => {
      this.requireOpenTaskRoom({ incoming: drafts.length, openTasksMax });
      return addTasks({ store: this.store, clock: SYSTEM_CLOCK, actor: trustedActor(actor), drafts });
    });
  }

  updateTask({ actor, number, patch }: { actor: Actor; number: number; patch: TaskPatch }): ProjectResult<Task> {
    return this.runWrite(() => updateTask({ store: this.store, clock: SYSTEM_CLOCK, actor: trustedActor(actor), number, patch }));
  }

  completeTasks({ actor, numbers, note }: { actor: Actor; numbers: number[]; note: string | null }): ProjectResult<CompletedTask[]> {
    return this.runWrite(() => completeTasks({ store: this.store, clock: SYSTEM_CLOCK, actor: trustedActor(actor), numbers, note }));
  }

  reopenTasks({ actor, numbers, openTasksMax }: { actor: Actor; numbers: number[]; openTasksMax: number }): ProjectResult<ReopenedTask[]> {
    return this.runWrite(() => {
      this.requireOpenTaskRoom({ incoming: numbers.length, openTasksMax });
      return reopenTasks({ store: this.store, clock: SYSTEM_CLOCK, actor: trustedActor(actor), numbers });
    });
  }

  listTasks({ today, filter }: { today: string; filter: TaskFilter }): ProjectResult<TaskList> {
    return this.run(() => listTasks({ store: this.store, today: trustedToday(today), filter }));
  }

  nextTask({ today }: { today: string }): ProjectResult<Task | null> {
    return this.run(() => nextTask({ store: this.store, today: trustedToday(today) }));
  }

  dueNow({ today }: { today: string }): ProjectResult<DueNow> {
    return this.run(() => dueNow({ store: this.store, today: trustedToday(today) }));
  }

  fetch(request: Request): Response {
    const isSocketUpgrade = request.headers.get('Upgrade')?.toLowerCase() === WEBSOCKET_UPGRADE;
    if (!isSocketUpgrade) return new Response(null, { status: HttpStatus.UpgradeRequired, headers: { Upgrade: WEBSOCKET_UPGRADE } });
    const sessionDigest = request.headers.get(HttpHeader.SessionDigest);
    if (sessionDigest === null) return new Response(null, { status: HttpStatus.BadRequest });
    const { 0: client, 1: server } = new WebSocketPair();
    this.ctx.acceptWebSocket(server, [sessionDigest]);
    return new Response(null, { status: HttpStatus.SwitchingProtocols, webSocket: client });
  }

  closeSessionSockets({ sessionDigest }: { sessionDigest: string }): void {
    this.ctx.getWebSockets(sessionDigest).forEach(closeEndedSession);
  }

  async wipe(): Promise<void> {
    this.ctx.getWebSockets().forEach(sendChanged);
    this.ctx.getWebSockets().forEach(closeEndedSession);
    await this.ctx.storage.deleteAll();
  }

  webSocketMessage(): void {}

  readChanges({ cursor }: { cursor: number }): ProjectResult<TaskChanges> {
    const lastChangeNumber = this.store.lastChangeNumber();
    const newestChangeNumber = lastChangeNumber === null ? NO_CHANGE_NUMBER : lastChangeNumber;
    const isCursorAhead = cursor > newestChangeNumber;
    if (isCursorAhead) return { ok: false, failure: { kind: ProjectFailureKind.CursorAhead } };
    const changes = this.store.listChangesSince({ cursor, limit: CHANGE_PAGE_SIZE + 1 });
    const page = changes.slice(0, CHANGE_PAGE_SIZE);
    const lastOnPage = page.at(LAST_INDEX);
    const nextCursor = lastOnPage === undefined ? cursor : lastOnPage.changeNumber;
    return { ok: true, value: { tasks: page.map(({ task }) => task), cursor: nextCursor, hasMore: changes.length > CHANGE_PAGE_SIZE } };
  }

  readHistory({ number }: { number: number }): ProjectResult<HistoryEntry[]> {
    return resultOf(() => {
      if (this.store.findTask(number) === null) throw new TaskNotFoundError(number);
      return this.store.listHistory(number);
    });
  }

  countActivity({ since, until }: { since: number; until: number }): ActivityCounts {
    return this.store.countActivity({ since, until });
  }

  private requireOpenTaskRoom({ incoming, openTasksMax }: { incoming: number; openTasksMax: number }): void {
    if (this.store.countOpenTasks() + incoming > openTasksMax)
      throw new LimitViolation({ limit: FairUseLimit.OpenTasks, max: openTasksMax });
  }

  private run<Value>(useCase: () => Value): ProjectResult<Value> {
    return resultOf(() => this.ctx.storage.transactionSync(useCase));
  }

  private runWrite<Value>(useCase: () => Value): ProjectResult<Value> {
    const projectId = this.ctx.id.name;
    if (projectId === undefined) throw new Error('the project store was opened without its project name');
    const changeNumberBefore = this.store.lastChangeNumber();
    const result = this.run(useCase);
    const hasMovedChangeNumber = result.ok && this.store.lastChangeNumber() !== changeNumberBefore;
    if (!hasMovedChangeNumber) return result;
    this.ctx.getWebSockets().forEach(sendChanged);
    this.recordActivity(projectId);
    return result;
  }

  private recordActivity(projectId: string): void {
    const now = SYSTEM_CLOCK.now();
    const writtenAt = this.ctx.storage.kv.get<number>(ACTIVITY_WRITTEN_AT_KEY);
    if (!isActivityWriteDue({ writtenAt: writtenAt === undefined ? null : writtenAt, now })) return;
    this.ctx.storage.kv.put(ACTIVITY_WRITTEN_AT_KEY, now);
    const write = touchWorkspaceActivity({ directory: this.env.DIRECTORY, projectId, now }).catch(() => {
      this.ctx.storage.kv.delete(ACTIVITY_WRITTEN_AT_KEY);
    });
    this.ctx.waitUntil(write);
  }
}
