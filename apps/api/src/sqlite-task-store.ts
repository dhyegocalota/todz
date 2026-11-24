import { type Actor, type HistoryEntry, OWNER_ACTOR, type Task, type TaskStore, parseCalendarDate } from '@todz/core';
import { ActorKind, HistoryAction, TaskField, TaskState } from '@todz/types';
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
const HISTORY_COLUMNS = 'at, actor_kind, actor_client, action, fields, note';

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
  const value = Object.values(enumeration).find((candidate) => candidate === raw);
  if (value === undefined) throw invalidColumn({ column, taskNumber });
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

  insertTask(task: Task): void {
    this.sql.exec(
      `INSERT INTO tasks (${TASK_COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
    );
    this.raiseCounterTo(task.number);
  }

  replaceTask(task: Task): void {
    this.sql.exec(
      'UPDATE tasks SET title = ?, notes = ?, due_date = ?, state = ?, order_key = ?, updated_at = ?, completed_at = ? WHERE number = ?',
      task.title,
      task.notes,
      task.dueDate,
      task.state,
      task.orderKey,
      task.updatedAt,
      task.completedAt,
      task.number,
    );
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

  private raiseCounterTo(number: number): void {
    const lastIssuedNumber = this.lastIssuedTaskNumber();
    const isAlreadyIssued = lastIssuedNumber !== null && lastIssuedNumber >= number;
    if (isAlreadyIssued) return;
    this.sql.exec('DELETE FROM task_counter');
    this.sql.exec('INSERT INTO task_counter (last_issued_number) VALUES (?)', number);
  }
}
