import { OWNER_ACTOR, addTasks, completeTasks, listTasks, updateTask } from '@todz/core';
import { TaskPlacement, TaskState } from '@todz/types';
import { runInDurableObject } from 'cloudflare:test';
import { describe, expect, test } from 'vitest';
import { MIGRATIONS, PROJECT_SCHEMA_VERSION, VERSION_ONE_STATEMENTS, applyMigrations, applyProjectSchema } from '../src/project-schema';
import { SqliteTaskStore } from '../src/sqlite-task-store';
import { CLOCK_NOW, TODAY, buildTask, calendarDate, draftOf, newProjectStub, openTasksFilter } from './task-fixtures';

const LIST_LIMIT = 10;
const LATEST_VERSION = 4;
const VERSION_TWO = 2;
const VERSION_ONE = 1;
const VERSION_TWO_MIGRATIONS = MIGRATIONS.filter(({ version }) => version <= VERSION_TWO);
const VERSION_THREE_INDEXES = ['task_history_task', 'tasks_order', 'tasks_state_order'];
const READ_ONLY_STATEMENT = /^(SELECT|CREATE TABLE IF NOT EXISTS)/;
const SCENARIO_CLOCK = { now: () => CLOCK_NOW };
const TABLES_TO_DROP = ['task_history', 'tasks', 'task_counter', 'change_counter', 'schema_version'];

type ColumnRow = { name: string };
type ChangeRow = { number: number; change_number: number };

function versionOneStore({ sql, taskCount }: { sql: SqlStorage; taskCount: number }): void {
  TABLES_TO_DROP.forEach((table) => sql.exec(`DROP TABLE IF EXISTS ${table}`));
  sql.exec('CREATE TABLE schema_version (version INTEGER NOT NULL) STRICT');
  VERSION_ONE_STATEMENTS.forEach((statement) => sql.exec(statement));
  sql.exec('INSERT INTO schema_version (version) VALUES (?)', VERSION_ONE);
  Array.from({ length: taskCount }, (_unused, index) => index + 1).forEach((number) => {
    sql.exec(
      'INSERT INTO tasks (number, title, state, order_key, created_by_kind, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      number,
      `Task ${number}`,
      'open',
      `a${number}`,
      'owner',
      number,
      number,
    );
    sql.exec('DELETE FROM task_counter');
    sql.exec('INSERT INTO task_counter (last_issued_number) VALUES (?)', number);
  });
}

function versionTwoStore({ storage, taskCount }: { storage: DurableObjectStorage; taskCount: number }): void {
  versionOneStore({ sql: storage.sql, taskCount });
  Array.from({ length: taskCount }, (_unused, index) => index + 1).forEach((number) => {
    storage.sql.exec(
      "INSERT INTO task_history (task_number, at, actor_kind, action, fields) VALUES (?, ?, 'owner', 'created', '[]')",
      number,
      number,
    );
  });
  applyMigrations({ storage, migrations: VERSION_TWO_MIGRATIONS });
}

function indexNames(sql: SqlStorage): string[] {
  return sql
    .exec<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'index' AND name NOT LIKE 'sqlite_%' ORDER BY name")
    .toArray()
    .map((row) => row.name);
}

function rowsOf({ sql, table }: { sql: SqlStorage; table: string }): unknown[] {
  return sql.exec(`SELECT * FROM ${table} ORDER BY 1`).toArray();
}

function storedVersions(sql: SqlStorage): number[] {
  return sql
    .exec<{ version: number }>('SELECT version FROM schema_version')
    .toArray()
    .map((row) => row.version);
}

function statementsRunBy({ storage, run }: { storage: DurableObjectStorage; run: (recorded: DurableObjectStorage) => void }): string[] {
  const statements: string[] = [];
  const recordedSql = new Proxy(storage.sql, {
    get(target, property) {
      const member = Reflect.get(target, property);
      if (property !== 'exec') return member;
      return (query: string, ...bindings: unknown[]) => {
        statements.push(query.trim());
        return target.exec(query, ...bindings);
      };
    },
  });
  const recorded = new Proxy(storage, {
    get(target, property) {
      if (property === 'sql') return recordedSql;
      const member = Reflect.get(target, property);
      if (typeof member !== 'function') return member;
      return member.bind(target);
    },
  });
  run(recorded);
  return statements;
}

function scenarioAnswers(store: SqliteTaskStore): unknown {
  const actor = OWNER_ACTOR;
  addTasks({ store, clock: SCENARIO_CLOCK, actor, drafts: ['A', 'B', 'C', 'D'].map(draftOf) });
  updateTask({ store, clock: SCENARIO_CLOCK, actor, number: 4, patch: { placement: { kind: TaskPlacement.First } } });
  updateTask({ store, clock: SCENARIO_CLOCK, actor, number: 1, patch: { placement: { kind: TaskPlacement.After, anchor: 3 } } });
  updateTask({ store, clock: SCENARIO_CLOCK, actor, number: 2, patch: { placement: { kind: TaskPlacement.Before, anchor: 4 } } });
  completeTasks({ store, clock: SCENARIO_CLOCK, actor, numbers: [3], note: null });
  const today = calendarDate(TODAY);
  return {
    open: listTasks({ store, today, filter: openTasksFilter() }),
    done: listTasks({ store, today, filter: { ...openTasksFilter(), state: TaskState.Done } }),
    history: [1, 2, 3, 4].map((number) => store.listHistory(number)),
    changes: store.listChangesSince({ cursor: 0, limit: LIST_LIMIT }),
  };
}

function changeRows(sql: SqlStorage): ChangeRow[] {
  return sql.exec<ChangeRow>('SELECT number, change_number FROM tasks ORDER BY number').toArray();
}

function changeCounterRows(sql: SqlStorage): number[] {
  return sql
    .exec<{ last_change_number: number }>('SELECT last_change_number FROM change_counter')
    .toArray()
    .map((row) => row.last_change_number);
}

describe('applyProjectSchema', () => {
  test('the schema version is 4', () => {
    expect(PROJECT_SCHEMA_VERSION).toBe(LATEST_VERSION);
  });

  test('a new store is at version 4 with a change number column, a deleted_at column and an empty counter', async () => {
    const observed = await runInDurableObject(newProjectStub(), (_instance, state) => ({
      versions: state.storage.sql.exec<{ version: number }>('SELECT version FROM schema_version').toArray(),
      columns: state.storage.sql
        .exec<ColumnRow>('SELECT name FROM pragma_table_info(?)', 'tasks')
        .toArray()
        .map((column) => column.name),
      counter: changeCounterRows(state.storage.sql),
    }));
    expect(observed.versions).toEqual([{ version: LATEST_VERSION }]);
    expect(observed.columns).toContain('change_number');
    expect(observed.columns).toContain('deleted_at');
    expect(observed.counter).toEqual([]);
  });

  test('a version 1 store with tasks 1 and 2 upgrades to version 4 numbered by task number', async () => {
    const observed = await runInDurableObject(newProjectStub(), (_instance, state) => {
      versionOneStore({ sql: state.storage.sql, taskCount: 2 });
      applyProjectSchema(state.storage);
      return {
        versions: state.storage.sql.exec<{ version: number }>('SELECT version FROM schema_version').toArray(),
        rows: changeRows(state.storage.sql),
        counter: changeCounterRows(state.storage.sql),
      };
    });
    expect(observed.versions).toEqual([{ version: LATEST_VERSION }]);
    expect(observed.rows).toEqual([
      { number: 1, change_number: 1 },
      { number: 2, change_number: 2 },
    ]);
    expect(observed.counter).toEqual([2]);
  });

  test('an upgraded store returns both tasks at cursor 0, reports change 2 and stamps the next task 3', async () => {
    const observed = await runInDurableObject(newProjectStub(), (_instance, state) => {
      versionOneStore({ sql: state.storage.sql, taskCount: 2 });
      applyProjectSchema(state.storage);
      const store = new SqliteTaskStore(state.storage.sql);
      const lastBefore = store.lastChangeNumber();
      const atCursorZero = store.listChangesSince({ cursor: 0, limit: LIST_LIMIT }).map(({ task }) => task.number);
      store.insertTask(buildTask({ number: 3, orderKey: 'a3' }));
      return {
        lastBefore,
        atCursorZero,
        afterTwo: store.listChangesSince({ cursor: 2, limit: LIST_LIMIT }).map(({ changeNumber }) => changeNumber),
      };
    });
    expect(observed).toEqual({ lastBefore: 2, atCursorZero: [1, 2], afterTwo: [3] });
  });

  test('a version 1 store without tasks upgrades with an empty counter', async () => {
    const counter = await runInDurableObject(newProjectStub(), (_instance, state) => {
      versionOneStore({ sql: state.storage.sql, taskCount: 0 });
      applyProjectSchema(state.storage);
      return changeCounterRows(state.storage.sql);
    });
    expect(counter).toEqual([]);
  });

  test('applying the schema twice changes nothing', async () => {
    const observed = await runInDurableObject(newProjectStub(), (_instance, state) => {
      versionOneStore({ sql: state.storage.sql, taskCount: 2 });
      applyProjectSchema(state.storage);
      applyProjectSchema(state.storage);
      return { rows: changeRows(state.storage.sql), counter: changeCounterRows(state.storage.sql) };
    });
    expect(observed.rows.map((row) => row.change_number)).toEqual([1, 2]);
    expect(observed.counter).toEqual([2]);
  });

  test('two tasks given one change number are refused by the unique index', async () => {
    const message = await runInDurableObject(newProjectStub(), (_instance, state) => {
      versionOneStore({ sql: state.storage.sql, taskCount: 2 });
      applyProjectSchema(state.storage);
      try {
        state.storage.sql.exec('UPDATE tasks SET change_number = 1 WHERE number = 2');
      } catch (error) {
        if (error instanceof Error) return error.message;
        throw error;
      }
      throw new Error('expected the update to throw');
    });
    expect(message).toContain('UNIQUE');
  });

  test('a half-applied upgrade does not persist', async () => {
    const observed = await runInDurableObject(newProjectStub(), (_instance, state) => {
      versionOneStore({ sql: state.storage.sql, taskCount: 2 });
      state.storage.sql.exec('CREATE TABLE change_counter (last_change_number INTEGER NOT NULL, extra INTEGER NOT NULL) STRICT');
      const failure = (() => {
        try {
          applyProjectSchema(state.storage);
        } catch (error) {
          if (error instanceof Error) return error.message;
          throw error;
        }
        return null;
      })();
      return {
        failure,
        versions: state.storage.sql.exec<{ version: number }>('SELECT version FROM schema_version').toArray(),
        columns: state.storage.sql
          .exec<ColumnRow>('SELECT name FROM pragma_table_info(?)', 'tasks')
          .toArray()
          .map((column) => column.name),
      };
    });
    expect(observed.failure).not.toBeNull();
    expect(observed.versions).toEqual([{ version: VERSION_ONE }]);
    expect(observed.columns).not.toContain('change_number');
  });

  test('a new store has the three version 3 indexes', async () => {
    const names = await runInDurableObject(newProjectStub(), (_instance, state) => indexNames(state.storage.sql));
    expect(names).toEqual(expect.arrayContaining(VERSION_THREE_INDEXES));
  });

  test('a version 2 store with tasks and history migrates to 3, gets the three indexes and keeps every row', async () => {
    const observed = await runInDurableObject(newProjectStub(), (_instance, state) => {
      versionTwoStore({ storage: state.storage, taskCount: 3 });
      const before = {
        tasks: rowsOf({ sql: state.storage.sql, table: 'tasks' }),
        history: rowsOf({ sql: state.storage.sql, table: 'task_history' }),
        indexes: indexNames(state.storage.sql),
      };
      applyProjectSchema(state.storage);
      return {
        before,
        versions: storedVersions(state.storage.sql),
        tasks: rowsOf({ sql: state.storage.sql, table: 'tasks' }),
        history: rowsOf({ sql: state.storage.sql, table: 'task_history' }),
        indexes: indexNames(state.storage.sql),
      };
    });
    expect(observed.before.indexes).not.toEqual(expect.arrayContaining(VERSION_THREE_INDEXES));
    expect(observed.versions).toEqual([LATEST_VERSION]);
    expect(observed.indexes).toEqual(expect.arrayContaining(VERSION_THREE_INDEXES));
    expect(observed.tasks).toEqual(observed.before.tasks);
    expect(observed.history).toEqual(observed.before.history);
  });

  test('a store already at version 3 is left alone: no statement writes', async () => {
    const written = await runInDurableObject(newProjectStub(), (_instance, state) => {
      const statements = statementsRunBy({ storage: state.storage, run: applyProjectSchema });
      return statements.filter((statement) => !READ_ONLY_STATEMENT.test(statement));
    });
    expect(written).toEqual([]);
  });

  test('a version 3 store opened by the version 2 migration list runs no write and keeps its indexes and rows', async () => {
    const observed = await runInDurableObject(newProjectStub(), (_instance, state) => {
      const before = { indexes: indexNames(state.storage.sql), counter: rowsOf({ sql: state.storage.sql, table: 'task_counter' }) };
      const statements = statementsRunBy({
        storage: state.storage,
        run: (recorded) => applyMigrations({ storage: recorded, migrations: VERSION_TWO_MIGRATIONS }),
      });
      return {
        written: statements.filter((statement) => !READ_ONLY_STATEMENT.test(statement)),
        versions: storedVersions(state.storage.sql),
        indexes: indexNames(state.storage.sql),
        counter: rowsOf({ sql: state.storage.sql, table: 'task_counter' }),
        before,
      };
    });
    expect(observed.written).toEqual([]);
    expect(observed.versions).toEqual([LATEST_VERSION]);
    expect(observed.indexes).toEqual(observed.before.indexes);
    expect(observed.counter).toEqual(observed.before.counter);
  });

  test('every use case answers on a version 3 store exactly as on a version 2 store', async () => {
    const onVersionTwo = await runInDurableObject(newProjectStub(), (_instance, state) => {
      versionTwoStore({ storage: state.storage, taskCount: 0 });
      return scenarioAnswers(new SqliteTaskStore(state.storage.sql));
    });
    const onVersionThree = await runInDurableObject(newProjectStub(), (_instance, state) => {
      versionTwoStore({ storage: state.storage, taskCount: 0 });
      applyProjectSchema(state.storage);
      return scenarioAnswers(new SqliteTaskStore(state.storage.sql));
    });
    expect(onVersionThree).toEqual(onVersionTwo);
  });
});
