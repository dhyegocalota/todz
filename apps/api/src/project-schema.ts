export const PROJECT_SCHEMA_VERSION = 1;

const SCHEMA_VERSION_TABLE = 'CREATE TABLE IF NOT EXISTS schema_version (version INTEGER NOT NULL) STRICT';

export const VERSION_ONE_STATEMENTS = [
  `CREATE TABLE tasks (
    number INTEGER PRIMARY KEY,
    title TEXT NOT NULL,
    notes TEXT,
    due_date TEXT,
    state TEXT NOT NULL,
    order_key TEXT NOT NULL COLLATE BINARY,
    idempotency_key TEXT UNIQUE,
    created_by_kind TEXT NOT NULL,
    created_by_client TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    completed_at INTEGER
  ) STRICT`,
  `CREATE TABLE task_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_number INTEGER NOT NULL REFERENCES tasks (number),
    at INTEGER NOT NULL,
    actor_kind TEXT NOT NULL,
    actor_client TEXT,
    action TEXT NOT NULL,
    fields TEXT NOT NULL,
    note TEXT
  ) STRICT`,
  'CREATE TABLE task_counter (last_issued_number INTEGER NOT NULL) STRICT',
];

export function applyProjectSchema(storage: DurableObjectStorage): void {
  const sql = storage.sql;
  sql.exec(SCHEMA_VERSION_TABLE);
  const isApplied = sql.exec('SELECT version FROM schema_version').toArray().length > 0;
  if (isApplied) return;
  VERSION_ONE_STATEMENTS.forEach((statement) => sql.exec(statement));
  sql.exec('INSERT INTO schema_version (version) VALUES (?)', PROJECT_SCHEMA_VERSION);
}
