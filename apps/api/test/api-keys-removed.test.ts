import { OAUTH_ACCESS_TOKEN_PREFIX } from '@todz/types';
import { env, exports } from 'cloudflare:workers';
import { beforeAll, describe, expect, test } from 'vitest';
import { generateCredentialSecret } from '../src/credential-secret';
import { DOCS_CONNECT_URL } from '../src/site/site-urls';
import { applyMigrationNamed, applyMigrationsThrough } from './migration-directory';
import { mcpRequest } from './oauth/oauth-client';
import { ownerCall, signInOwner } from './owner-client';
import { CLOCK_NOW } from './task-fixtures';

const LAST_NUMBER_BEFORE = '0017';
const MIGRATION_NAME = '0018_drop_api_keys.sql';
const UNAUTHORIZED_STATUS = 401;
const NOT_FOUND_STATUS = 404;
const JSON_MEDIA_TYPE = 'application/json';
const INVALID_TOKEN = 'invalid_token';
const INITIALIZE_BODY = { jsonrpc: '2.0', id: 1, method: 'initialize', params: {} };
const KEY_TABLES = ['project_keys', 'owner_keys', 'mcp_sessions'];
const OAUTH_TABLES = ['oauth_clients', 'oauth_sessions', 'oauth_grants', 'oauth_codes', 'oauth_tokens'];
const FORMER_KEY_PREFIXES = ['todz_', 'todz-owner_'];
const KEY_PATHS = [
  { method: 'GET', path: '/owner/keys' },
  { method: 'POST', path: '/owner/keys' },
  { method: 'DELETE', path: '/owner/keys/a-key-id' },
  { method: 'GET', path: '/owner/projects/a-project-id/keys' },
  { method: 'POST', path: '/owner/projects/a-project-id/keys' },
  { method: 'DELETE', path: '/owner/projects/a-project-id/keys/a-key-id' },
];

async function tableNames(): Promise<string[]> {
  const { results } = await env.MIGRATION_DIRECTORY.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all<{ name: string }>();
  return results.map(({ name }) => name);
}

describe.each(FORMER_KEY_PREFIXES)('a former key starting with %s on /mcp', (prefix) => {
  test('answers 401 with the invalid token challenge and a body that points to the OAuth connect docs', async () => {
    const response = await exports.default.fetch(mcpRequest({ token: `${prefix}${generateCredentialSecret()}`, body: INITIALIZE_BODY }));

    expect(response.status).toBe(UNAUTHORIZED_STATUS);
    expect(response.headers.get('WWW-Authenticate')).toContain(`error="${INVALID_TOKEN}"`);
    expect(response.headers.get('Content-Type')).toContain(JSON_MEDIA_TYPE);
    const body = await response.json<{ error: string; error_description: string }>();
    expect(body.error).toBe(INVALID_TOKEN);
    expect(body.error_description).toContain(DOCS_CONNECT_URL);
  });
});

describe('an unknown OAuth access token on /mcp', () => {
  test('keeps its empty 401 so the client refreshes it', async () => {
    const response = await exports.default.fetch(
      mcpRequest({ token: `${OAUTH_ACCESS_TOKEN_PREFIX}${generateCredentialSecret()}`, body: INITIALIZE_BODY }),
    );

    expect(response.status).toBe(UNAUTHORIZED_STATUS);
    expect(await response.text()).toBe('');
  });
});

describe('the owner API once keys are gone', () => {
  test.each(KEY_PATHS)('$method $path answers 404 for a signed-in owner', async ({ method, path }) => {
    const { token } = await signInOwner();

    const response = await ownerCall({ method, path, token });

    expect(response.status).toBe(NOT_FOUND_STATUS);
  });
});

describe('the migration that drops the keys', () => {
  beforeAll(async () => {
    await applyMigrationsThrough(LAST_NUMBER_BEFORE);
    await env.MIGRATION_DIRECTORY.prepare('INSERT INTO owners (id, time_zone, created_at) VALUES (?, ?, ?)')
      .bind('owner', 'UTC', CLOCK_NOW)
      .run();
    await env.MIGRATION_DIRECTORY.prepare('INSERT INTO owner_keys (digest, id, hint, owner_id, created_at) VALUES (?, ?, ?, ?, ?)')
      .bind('a'.repeat(64), 'owner-key', 'abcd', 'owner', CLOCK_NOW)
      .run();
    await applyMigrationNamed(MIGRATION_NAME);
  });

  test('leaves no key table and no table of MCP sessions', async () => {
    expect((await tableNames()).filter((name) => KEY_TABLES.includes(name))).toEqual([]);
  });

  test('keeps the OAuth tables and the owners', async () => {
    expect(await tableNames()).toEqual(expect.arrayContaining([...OAUTH_TABLES, 'owners', 'projects', 'workspaces', 'sessions']));
  });
});
