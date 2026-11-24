import { runInDurableObject } from 'cloudflare:test';
import { describe, expect, test } from 'vitest';
import { PROJECT_SCHEMA_VERSION, VERSION_ONE_STATEMENTS, applyProjectSchema } from '../src/project-schema';
import { newProjectStub } from './task-fixtures';

const UPGRADED_VERSION = 2;
const VERSION_ONE = 1;
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
  test('the schema version is 2', () => {
    expect(PROJECT_SCHEMA_VERSION).toBe(UPGRADED_VERSION);
  });

  test('a new store is at version 2 with a change number column and an empty counter', async () => {
    const observed = await runInDurableObject(newProjectStub(), (_instance, state) => ({
      versions: state.storage.sql.exec<{ version: number }>('SELECT version FROM schema_version').toArray(),
      columns: state.storage.sql
        .exec<ColumnRow>('SELECT name FROM pragma_table_info(?)', 'tasks')
        .toArray()
        .map((column) => column.name),
      counter: changeCounterRows(state.storage.sql),
    }));
    expect(observed.versions).toEqual([{ version: UPGRADED_VERSION }]);
    expect(observed.columns).toContain('change_number');
    expect(observed.counter).toEqual([]);
  });

  test('a version 1 store with tasks 1 and 2 upgrades to version 2 numbered by task number', async () => {
    const observed = await runInDurableObject(newProjectStub(), (_instance, state) => {
      versionOneStore({ sql: state.storage.sql, taskCount: 2 });
      applyProjectSchema(state.storage);
      return {
        versions: state.storage.sql.exec<{ version: number }>('SELECT version FROM schema_version').toArray(),
        rows: changeRows(state.storage.sql),
        counter: changeCounterRows(state.storage.sql),
      };
    });
    expect(observed.versions).toEqual([{ version: UPGRADED_VERSION }]);
    expect(observed.rows).toEqual([
      { number: 1, change_number: 1 },
      { number: 2, change_number: 2 },
    ]);
    expect(observed.counter).toEqual([2]);
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
});
