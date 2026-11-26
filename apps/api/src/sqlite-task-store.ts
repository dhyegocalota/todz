import { type Actor, type HistoryEntry, OWNER_ACTOR, type Task, type TaskStore, parseCalendarDate } from '@todz/core';
import { ActorKind, HistoryAction, TaskField, TaskState } from '@todz/types';
import { enumValueOf } from './enum-value';
import { parsedJson } from './parsed-json';

type TaskRow = {
  number: number;
  title: string;
  notes: string | null;
  due_date: string | null;
  state: string;
  order_key: string;
  idempotency_key: string | null;
  created_by_kind: string;
  created_by_client: string | null;
  created_at: number;
  updated_at: number;
  completed_at: number | null;
};

type ChangedTaskRow = TaskRow & { change_number: number };

export type TaskChange = { task: Task; changeNumber: number };

export type ActivityCounts = { added: number; completed: number; agentWrites: { client: string; count: number }[] };

type HistoryRow = {
  at: number;
  actor_kind: string;
  actor_client: string | null;
  action: string;
  fields: string;
  note: string | null;
};

const TASK_COLUMNS =
  'number, title, notes, due_date, state, order_key, idempotency_key, created_by_kind, created_by_client, created_at, updated_at, completed_at';
const FIRST_CHANGE_NUMBER = 1;
const HISTORY_COLUMNS = 'at, actor_kind, actor_client, action, fields, note';
const ADDED_COUNT_QUERY = 'SELECT count(*) AS total FROM tasks WHERE created_at >= ? AND created_at < ?';
const OPEN_COUNT_QUERY = 'SELECT open_tasks AS total FROM open_counter';
const ADJUST_OPEN_COUNT = 'UPDATE open_counter SET open_tasks = open_tasks + ?';
const COMPLETED_COUNT_QUERY = 'SELECT count(*) AS total FROM tasks WHERE completed_at >= ? AND completed_at < ?';
const AGENT_WRITES_QUERY =
  'SELECT actor_client, count(*) AS total FROM task_history WHERE actor_kind = ? AND actor_client IS NOT NULL AND at >= ? AND at < ? GROUP BY actor_client';
const FIRST_ORDER_KEY_QUERY = 'SELECT order_key FROM tasks WHERE number <> ? ORDER BY order_key LIMIT 1';
const LAST_ORDER_KEY_QUERY = 'SELECT order_key FROM tasks WHERE number <> ? ORDER BY order_key DESC LIMIT 1';
const ORDER_KEY_BEFORE_QUERY = 'SELECT order_key FROM tasks WHERE order_key < ? AND number <> ? ORDER BY order_key DESC LIMIT 1';
const ORDER_KEY_AFTER_QUERY = 'SELECT order_key FROM tasks WHERE order_key > ? AND number <> ? ORDER BY order_key LIMIT 1';

function openCountOf(state: TaskState | null): number {
  if (state === TaskState.Open) return 1;
  return 0;
}

function invalidColumn({ column, taskNumber }: { column: string; taskNumber: number }): Error {
  return new Error(`${column} of task ${taskNumber} is not valid`);
}

function enumValue<Value extends string>({
  enumeration,
  raw,
  column,
  taskNumber,
}: {
  enumeration: Record<string, Value>;
  raw: string;
  column: string;
  taskNumber: number;
}): Value {
  const value = enumValueOf({ enumeration, candidate: raw });
  if (value === null) throw invalidColumn({ column, taskNumber });
  return value;
}

function actorOf({
  kind,
  client,
  kindColumn,
  clientColumn,
  taskNumber,
}: {
  kind: string;
  client: string | null;
  kindColumn: string;
  clientColumn: string;
  taskNumber: number;
}): Actor {
  const actorKind = enumValue({ enumeration: ActorKind, raw: kind, column: kindColumn, taskNumber });
  const isOwner = actorKind === ActorKind.Owner;
  if (isOwner && client !== null) throw invalidColumn({ column: clientColumn, taskNumber });
  if (isOwner) return OWNER_ACTOR;
  if (client === null) throw invalidColumn({ column: clientColumn, taskNumber });
  return { kind: ActorKind.Agent, clientName: client };
}

function clientNameOf(actor: Actor): string | null {
  if (actor.kind === ActorKind.Owner) return null;
  return actor.clientName;
}

function dueDateOf({ raw, taskNumber }: { raw: string | null; taskNumber: number }): Task['dueDate'] {
  if (raw === null) return null;
  const dueDate = parseCalendarDate(raw);
  if (dueDate === null) throw invalidColumn({ column: 'tasks.due_date', taskNumber });
  return dueDate;
}

function fieldsOf({ raw, taskNumber }: { raw: string; taskNumber: number }): TaskField[] {
  const column = 'task_history.fields';
  const parsed = parsedJson(raw);
  if (!Array.isArray(parsed)) throw invalidColumn({ column, taskNumber });
  return parsed.map((field) => enumValue({ enumeration: TaskField, raw: String(field), column, taskNumber }));
}

function taskOf(row: TaskRow): Task {
  const taskNumber = row.number;
  return {
    number: taskNumber,
    title: row.title,
    notes: row.notes,
    dueDate: dueDateOf({ raw: row.due_date, taskNumber }),
    state: enumValue({ enumeration: TaskState, raw: row.state, column: 'tasks.state', taskNumber }),
    orderKey: row.order_key,
    idempotencyKey: row.idempotency_key,
    createdBy: actorOf({
      kind: row.created_by_kind,
      client: row.created_by_client,
      kindColumn: 'tasks.created_by_kind',
      clientColumn: 'tasks.created_by_client',
      taskNumber,
    }),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at,
  };
}

function historyEntryOf({ row, taskNumber }: { row: HistoryRow; taskNumber: number }): HistoryEntry {
  return {
    at: row.at,
    actor: actorOf({
      kind: row.actor_kind,
      client: row.actor_client,
      kindColumn: 'task_history.actor_kind',
      clientColumn: 'task_history.actor_client',
      taskNumber,
    }),
    action: enumValue({ enumeration: HistoryAction, raw: row.action, column: 'task_history.action', taskNumber }),
    fields: fieldsOf({ raw: row.fields, taskNumber }),
    note: row.note,
  };
}

export class SqliteTaskStore implements TaskStore {
  constructor(private readonly sql: SqlStorage) {}

  findTask(number: number): Task | null {
    const [row] = this.sql.exec<TaskRow>(`SELECT ${TASK_COLUMNS} FROM tasks WHERE number = ?`, number).toArray();
    if (row === undefined) return null;
    return taskOf(row);
  }

  findTaskByIdempotencyKey(idempotencyKey: string): Task | null {
    const [row] = this.sql.exec<TaskRow>(`SELECT ${TASK_COLUMNS} FROM tasks WHERE idempotency_key = ?`, idempotencyKey).toArray();
    if (row === undefined) return null;
    return taskOf(row);
  }

  listTasksInState(state: TaskState): Task[] {
    return this.sql.exec<TaskRow>(`SELECT ${TASK_COLUMNS} FROM tasks WHERE state = ? ORDER BY order_key`, state).toArray().map(taskOf);
  }

  lastIssuedTaskNumber(): number | null {
    const [row] = this.sql.exec<{ last_issued_number: number }>('SELECT last_issued_number FROM task_counter').toArray();
    if (row === undefined) return null;
    return row.last_issued_number;
  }

  firstOrderKey({ excludingNumber }: { excludingNumber: number }): string | null {
    return this.orderKeyOf({ query: FIRST_ORDER_KEY_QUERY, bindings: [excludingNumber] });
  }

  lastOrderKey({ excludingNumber }: { excludingNumber: number }): string | null {
    return this.orderKeyOf({ query: LAST_ORDER_KEY_QUERY, bindings: [excludingNumber] });
  }

  orderKeyBefore({ orderKey, excludingNumber }: { orderKey: string; excludingNumber: number }): string | null {
    return this.orderKeyOf({ query: ORDER_KEY_BEFORE_QUERY, bindings: [orderKey, excludingNumber] });
  }

  orderKeyAfter({ orderKey, excludingNumber }: { orderKey: string; excludingNumber: number }): string | null {
    return this.orderKeyOf({ query: ORDER_KEY_AFTER_QUERY, bindings: [orderKey, excludingNumber] });
  }

  lastChangeNumber(): number | null {
    const [row] = this.sql.exec<{ last_change_number: number }>('SELECT last_change_number FROM change_counter').toArray();
    if (row === undefined) return null;
    return row.last_change_number;
  }

  countActivity({ since, until }: { since: number; until: number }): ActivityCounts {
    const added = this.totalOf({ query: ADDED_COUNT_QUERY, bindings: [since, until] });
    const completed = this.totalOf({ query: COMPLETED_COUNT_QUERY, bindings: [since, until] });
    const agentWrites = this.sql
      .exec<{ actor_client: string; total: number }>(AGENT_WRITES_QUERY, ActorKind.Agent, since, until)
      .toArray()
      .map((row) => ({ client: row.actor_client, count: row.total }));
    return { added, completed, agentWrites };
  }

  countOpenTasks(): number {
    return this.totalOf({ query: OPEN_COUNT_QUERY, bindings: [] });
  }

  private adjustOpenCount(delta: number): void {
    if (delta === 0) return;
    this.sql.exec(ADJUST_OPEN_COUNT, delta);
  }

  private totalOf({ query, bindings }: { query: string; bindings: SqlStorageValue[] }): number {
    const [row] = this.sql.exec<{ total: number }>(query, ...bindings).toArray();
    if (row === undefined) throw new Error('a count returned no row');
    return row.total;
  }

  listChangesSince({ cursor, limit }: { cursor: number; limit: number }): TaskChange[] {
    return this.sql
      .exec<ChangedTaskRow>(
        `SELECT ${TASK_COLUMNS}, change_number FROM tasks WHERE change_number > ? ORDER BY change_number LIMIT ?`,
        cursor,
        limit,
      )
      .toArray()
      .map((row) => ({ task: taskOf(row), changeNumber: row.change_number }));
  }

  insertTask(task: Task): void {
    this.sql.exec(
      `INSERT INTO tasks (${TASK_COLUMNS}, change_number) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      task.number,
      task.title,
      task.notes,
      task.dueDate,
      task.state,
      task.orderKey,
      task.idempotencyKey,
      task.createdBy.kind,
      clientNameOf(task.createdBy),
      task.createdAt,
      task.updatedAt,
      task.completedAt,
      this.takeChangeNumber(),
    );
    this.raiseCounterTo(task.number);
    this.adjustOpenCount(openCountOf(task.state));
  }

  replaceTask(task: Task): void {
    const previous = this.findTask(task.number);
    this.sql.exec(
      'UPDATE tasks SET title = ?, notes = ?, due_date = ?, state = ?, order_key = ?, updated_at = ?, completed_at = ?, change_number = ? WHERE number = ?',
      task.title,
      task.notes,
      task.dueDate,
      task.state,
      task.orderKey,
      task.updatedAt,
      task.completedAt,
      this.takeChangeNumber(),
      task.number,
    );
    this.adjustOpenCount(openCountOf(task.state) - openCountOf(previous === null ? null : previous.state));
  }

  appendHistory({ number, entry }: { number: number; entry: HistoryEntry }): void {
    this.sql.exec(
      `INSERT INTO task_history (task_number, ${HISTORY_COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      number,
      entry.at,
      entry.actor.kind,
      clientNameOf(entry.actor),
      entry.action,
      JSON.stringify(entry.fields),
      entry.note,
    );
  }

  listHistory(number: number): HistoryEntry[] {
    return this.sql
      .exec<HistoryRow>(`SELECT ${HISTORY_COLUMNS} FROM task_history WHERE task_number = ? ORDER BY id`, number)
      .toArray()
      .map((row) => historyEntryOf({ row, taskNumber: number }));
  }

  private orderKeyOf({ query, bindings }: { query: string; bindings: SqlStorageValue[] }): string | null {
    const [row] = this.sql.exec<{ order_key: string }>(query, ...bindings).toArray();
    if (row === undefined) return null;
    return row.order_key;
  }

  private takeChangeNumber(): number {
    const lastChangeNumber = this.lastChangeNumber();
    const changeNumber = lastChangeNumber === null ? FIRST_CHANGE_NUMBER : lastChangeNumber + 1;
    this.sql.exec('DELETE FROM change_counter');
    this.sql.exec('INSERT INTO change_counter (last_change_number) VALUES (?)', changeNumber);
    return changeNumber;
  }

  private raiseCounterTo(number: number): void {
    const lastIssuedNumber = this.lastIssuedTaskNumber();
    const isAlreadyIssued = lastIssuedNumber !== null && lastIssuedNumber >= number;
    if (isAlreadyIssued) return;
    this.sql.exec('DELETE FROM task_counter');
    this.sql.exec('INSERT INTO task_counter (last_issued_number) VALUES (?)', number);
  }
}
