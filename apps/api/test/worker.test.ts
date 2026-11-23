import { env, exports } from 'cloudflare:workers';
import { describe, expect, test } from 'vitest';

const WORKER_ORIGIN = 'https://api.todz.test';
const NOT_FOUND_STATUS = 404;
const DIRECTORY_TABLES = ['owners', 'project_keys', 'projects', 'sessions', 'workspaces'];
const TASK_COLUMNS = ['title', 'notes', 'note', 'due_date', 'order_key'];

type TableRow = { name: string };
type ColumnRow = { table_name: string; column_name: string };

async function directoryTables(): Promise<string[]> {
  const { results } = await env.DIRECTORY.prepare(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name <> 'd1_migrations' ORDER BY name",
  ).all<TableRow>();
  return results.map((row) => row.name);
}

describe('the worker', () => {
  test('GET / answers 404 with an empty body', async () => {
    const response = await exports.default.fetch(`${WORKER_ORIGIN}/`);
    expect(response.status).toBe(NOT_FOUND_STATUS);
    expect(await response.text()).toBe('');
  });

  test('POST /mcp with a bearer header answers 404 with an empty body', async () => {
    const response = await exports.default.fetch(`${WORKER_ORIGIN}/mcp`, { method: 'POST', headers: { Authorization: 'Bearer secret' } });
    expect(response.status).toBe(NOT_FOUND_STATUS);
    expect(await response.text()).toBe('');
  });
});

describe('the directory', () => {
  test('lists exactly the five directory tables', async () => {
    expect(await directoryTables()).toEqual(DIRECTORY_TABLES);
  });

  test('has no column that holds a task field', async () => {
    const tables = await directoryTables();
    const columns = await Promise.all(
      tables.map(async (table) => {
        const { results } = await env.DIRECTORY.prepare('SELECT ? AS table_name, name AS column_name FROM pragma_table_info(?)')
          .bind(table, table)
          .all<ColumnRow>();
        return results;
      }),
    );
    const taskColumns = columns.flat().filter((row) => TASK_COLUMNS.includes(row.column_name));
    expect(taskColumns).toEqual([]);
  });
});
