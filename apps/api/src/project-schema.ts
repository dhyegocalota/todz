const EMPTY_STORE_VERSION = 0;

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

const VERSION_TWO_STATEMENTS = [
  'ALTER TABLE tasks ADD COLUMN change_number INTEGER NOT NULL DEFAULT 0',
  'UPDATE tasks SET change_number = number',
  'CREATE TABLE change_counter (last_change_number INTEGER NOT NULL) STRICT',
  'INSERT INTO change_counter (last_change_number) SELECT number FROM tasks ORDER BY number DESC LIMIT 1',
  'CREATE UNIQUE INDEX tasks_change_number ON tasks (change_number)',
];

type Migration = { version: number; statements: string[] };

export const MIGRATIONS: Migration[] = [
  { version: 1, statements: VERSION_ONE_STATEMENTS },
  { version: 2, statements: VERSION_TWO_STATEMENTS },
];

export const PROJECT_SCHEMA_VERSION = MIGRATIONS.length;

export function applyMigrations({ storage, migrations }: { storage: DurableObjectStorage; migrations: Migration[] }): void {
  const sql = storage.sql;
  storage.transactionSync(() => {
    sql.exec(SCHEMA_VERSION_TABLE);
    const [storedRow] = sql.exec<{ version: number }>('SELECT version FROM schema_version').toArray();
    if (storedRow === undefined) sql.exec('INSERT INTO schema_version (version) VALUES (?)', EMPTY_STORE_VERSION);
    const storedVersion = storedRow === undefined ? EMPTY_STORE_VERSION : storedRow.version;
    migrations
      .filter(({ version }) => version > storedVersion)
      .forEach(({ version, statements }) => {
        statements.forEach((statement) => sql.exec(statement));
        sql.exec('UPDATE schema_version SET version = ?', version);
      });
  });
}

export function applyProjectSchema(storage: DurableObjectStorage): void {
  applyMigrations({ storage, migrations: MIGRATIONS });
}
