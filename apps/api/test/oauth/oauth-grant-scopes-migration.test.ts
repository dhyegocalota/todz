import { env } from 'cloudflare:workers';
import { beforeAll, describe, expect, test } from 'vitest';
import { applyMigrationNamed, applyMigrationsThrough } from '../migration-directory';
import { CLOCK_NOW } from '../task-fixtures';

const LAST_NUMBER_BEFORE = '0021';
const MIGRATION_NAME = '0022_oauth_grant_scopes.sql';
const OWNER_ID = 'scopes-owner';
const WORKSPACE_ID = 'scopes-workspace';
const PROJECT_ID = 'scopes-project';
const CLIENT_ID = 'c'.repeat(43);
const PROJECT_GRANT_ID = 'project-grant';
const ACCOUNT_GRANT_ID = 'account-grant';
const PROJECT_CODE_DIGEST = 'a'.repeat(64);
const ACCOUNT_CODE_DIGEST = 'b'.repeat(64);
const CODE_CHALLENGE = 'd'.repeat(43);
const REDIRECT_URI = 'https://claude.ai/api/mcp/auth_callback';

type ScopeRow = { kind: string; workspace_id: string | null; project_id: string | null };

async function scopesOfGrant(grantId: string): Promise<ScopeRow[]> {
  const { results } = await env.MIGRATION_DIRECTORY.prepare(
    'SELECT kind, workspace_id, project_id FROM oauth_grant_scopes WHERE grant_id = ?',
  )
    .bind(grantId)
    .all<ScopeRow>();
  return results;
}

async function scopesOfCode(digest: string): Promise<unknown> {
  const row = await env.MIGRATION_DIRECTORY.prepare('SELECT scopes FROM oauth_codes WHERE digest = ?')
    .bind(digest)
    .first<{ scopes: string }>();
  return JSON.parse(row!.scopes);
}

describe('migration 0022 moves the single project of every grant and code into scopes', () => {
  beforeAll(async () => {
    await applyMigrationsThrough(LAST_NUMBER_BEFORE);
    await env.MIGRATION_DIRECTORY.batch([
      env.MIGRATION_DIRECTORY.prepare('INSERT INTO owners (id, time_zone, created_at) VALUES (?, ?, ?)').bind(OWNER_ID, 'UTC', CLOCK_NOW),
      env.MIGRATION_DIRECTORY.prepare('INSERT INTO workspaces (id, owner_id, name, created_at) VALUES (?, ?, ?, ?)').bind(
        WORKSPACE_ID,
        OWNER_ID,
        'Workspace',
        CLOCK_NOW,
      ),
      env.MIGRATION_DIRECTORY.prepare('INSERT INTO projects (id, workspace_id, name, is_inbox, created_at) VALUES (?, ?, ?, 0, ?)').bind(
        PROJECT_ID,
        WORKSPACE_ID,
        'Project',
        CLOCK_NOW,
      ),
      env.MIGRATION_DIRECTORY.prepare(
        'INSERT INTO oauth_clients (id, name, redirect_uris, created_at, active_at) VALUES (?, ?, ?, ?, ?)',
      ).bind(CLIENT_ID, 'Claude', '[]', CLOCK_NOW, CLOCK_NOW),
      env.MIGRATION_DIRECTORY.prepare(
        'INSERT INTO oauth_grants (id, client_id, owner_id, project_id, redirect_uri, created_at, last_used_at) VALUES (?, ?, ?, ?, ?, ?, ?), (?, ?, ?, NULL, ?, ?, ?)',
      ).bind(
        PROJECT_GRANT_ID,
        CLIENT_ID,
        OWNER_ID,
        PROJECT_ID,
        REDIRECT_URI,
        CLOCK_NOW,
        CLOCK_NOW,
        ACCOUNT_GRANT_ID,
        CLIENT_ID,
        OWNER_ID,
        REDIRECT_URI,
        CLOCK_NOW,
        CLOCK_NOW,
      ),
      env.MIGRATION_DIRECTORY.prepare(
        'INSERT INTO oauth_codes (digest, client_id, owner_id, project_id, redirect_uri, code_challenge, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?), (?, ?, ?, NULL, ?, ?, ?)',
      ).bind(
        PROJECT_CODE_DIGEST,
        CLIENT_ID,
        OWNER_ID,
        PROJECT_ID,
        REDIRECT_URI,
        CODE_CHALLENGE,
        CLOCK_NOW,
        ACCOUNT_CODE_DIGEST,
        CLIENT_ID,
        OWNER_ID,
        REDIRECT_URI,
        CODE_CHALLENGE,
        CLOCK_NOW,
      ),
    ]);
    await applyMigrationNamed(MIGRATION_NAME);
  });

  test('a grant of one project becomes one project scope', async () => {
    expect(await scopesOfGrant(PROJECT_GRANT_ID)).toEqual([{ kind: 'project', workspace_id: null, project_id: PROJECT_ID }]);
  });

  test('a grant of one project keeps reaching the other projects of its workspace, and the account does not', async () => {
    const { results } = await env.MIGRATION_DIRECTORY.prepare('SELECT id, reaches_workspace FROM oauth_grants ORDER BY id').all<{
      id: string;
      reaches_workspace: number;
    }>();

    expect(results).toEqual([
      { id: ACCOUNT_GRANT_ID, reaches_workspace: 0 },
      { id: PROJECT_GRANT_ID, reaches_workspace: 1 },
    ]);
  });

  test('a whole-account grant becomes one explicit account scope', async () => {
    expect(await scopesOfGrant(ACCOUNT_GRANT_ID)).toEqual([{ kind: 'account', workspace_id: null, project_id: null }]);
  });

  test('a live code of one project carries that project as its scopes', async () => {
    expect(await scopesOfCode(PROJECT_CODE_DIGEST)).toEqual([{ kind: 'project', project_id: PROJECT_ID }]);
  });

  test('a live code of the account carries the account as its scopes', async () => {
    expect(await scopesOfCode(ACCOUNT_CODE_DIGEST)).toEqual([{ kind: 'account' }]);
  });

  test('deleting the project afterwards deletes the grant that only held it and keeps the account grant', async () => {
    await env.MIGRATION_DIRECTORY.prepare('DELETE FROM projects WHERE id = ?').bind(PROJECT_ID).run();

    expect(await scopesOfGrant(PROJECT_GRANT_ID)).toEqual([]);
    const grants = await env.MIGRATION_DIRECTORY.prepare('SELECT id FROM oauth_grants ORDER BY id').all<{ id: string }>();
    expect(grants.results).toEqual([{ id: ACCOUNT_GRANT_ID }]);
  });
});
