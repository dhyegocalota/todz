import { APP_VERSION_HEADER, MINIMUM_APP_VERSION } from '@todz/types';
import { env, exports } from 'cloudflare:workers';
import { describe, expect, test } from 'vitest';

const WORKER_ORIGIN = 'http://localhost:8787';
const APP_VERSION_HEADERS = { [APP_VERSION_HEADER]: MINIMUM_APP_VERSION };
const OK_STATUS = 200;
const NOT_FOUND_STATUS = 404;
const UNAVAILABLE_STATUS = 503;
const UNAUTHORIZED_STATUS = 401;
const DIRECTORY_TABLES = [
  'admin_sessions',
  'admin_sign_in_links',
  'cloud_budget',
  'cloud_queue',
  'day_email_replies',
  'day_email_reply_addresses',
  'day_email_stop_links',
  'day_emails',
  'mail_meter',
  'metrics_daily',
  'oauth_clients',
  'oauth_codes',
  'oauth_grants',
  'oauth_sessions',
  'oauth_tokens',
  'owner_identities',
  'owner_usage',
  'owners',
  'projects',
  'sessions',
  'sign_in_code_misses',
  'sign_in_links',
  'sign_up_usage',
  'workspaces',
];
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

  test('POST /mcp with an unknown bearer answers 401 and points to the OAuth connect docs', async () => {
    const response = await exports.default.fetch(`${WORKER_ORIGIN}/mcp`, { method: 'POST', headers: { Authorization: 'Bearer secret' } });
    expect(response.status).toBe(UNAUTHORIZED_STATUS);
    expect(await response.json()).toMatchObject({ error: 'invalid_token' });
  });
});

describe('the handler routes the paths the static assets never answer (the asset side is pinned in the repository shape)', () => {
  test('GET /sign-in answers the sign-in page from the Worker', async () => {
    const response = await exports.default.fetch(`${WORKER_ORIGIN}/sign-in`);
    expect(response.status).toBe(OK_STATUS);
    expect(response.headers.get('Content-Type')).toContain('text/html');
  });

  test('GET /owner without a session answers 401 from the Worker', async () => {
    const response = await exports.default.fetch(`${WORKER_ORIGIN}/owner`, { headers: APP_VERSION_HEADERS });
    expect(response.status).toBe(UNAUTHORIZED_STATUS);
  });

  test('POST /owner/sign-in-links answers from the Worker', async () => {
    const response = await exports.default.fetch(`${WORKER_ORIGIN}/owner/sign-in-links`, { method: 'POST', headers: APP_VERSION_HEADERS });
    expect(response.status).toBe(UNAVAILABLE_STATUS);
  });

  test('POST /mcp answers from the Worker', async () => {
    const response = await exports.default.fetch(`${WORKER_ORIGIN}/mcp`, { method: 'POST' });
    expect(response.status).toBe(UNAUTHORIZED_STATUS);
  });
});

describe('the directory', () => {
  test('lists exactly the twenty-four directory tables', async () => {
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
