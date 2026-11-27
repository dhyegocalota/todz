import { MILLISECONDS_PER_DAY } from '@todz/types';
import { env } from 'cloudflare:workers';
import { beforeAll, describe, expect, test } from 'vitest';
import { applyMigrationNamed, applyMigrationsThrough } from '../migration-directory';
import { CLOCK_NOW } from '../task-fixtures';

const LAST_NUMBER_BEFORE = '0020';
const MIGRATION_NAME = '0021_oauth_token_lineage.sql';
const OWNER_ID = 'lineage-owner';
const CLIENT_ID = 'c'.repeat(43);
const GRANT_ID = 'lineage-grant';
const FIRST_DIGEST = '1'.repeat(64);
const SECOND_DIGEST = '2'.repeat(64);
const THIRD_DIGEST = '3'.repeat(64);
const ROTATED_AT = CLOCK_NOW + 1;
const ROTATED_AGAIN_AT = CLOCK_NOW + 2;

async function parentOf(digest: string): Promise<string | null> {
  const row = await env.MIGRATION_DIRECTORY.prepare('SELECT parent_digest FROM oauth_tokens WHERE digest = ?')
    .bind(digest)
    .first<{ parent_digest: string | null }>();
  return row!.parent_digest;
}

describe('migration 0021 links the refresh tokens issued before it to the token each was issued from', () => {
  beforeAll(async () => {
    await applyMigrationsThrough(LAST_NUMBER_BEFORE);
    const expiresAt = CLOCK_NOW + MILLISECONDS_PER_DAY;
    await env.MIGRATION_DIRECTORY.batch([
      env.MIGRATION_DIRECTORY.prepare('INSERT INTO owners (id, time_zone, created_at) VALUES (?, ?, ?)').bind(OWNER_ID, 'UTC', CLOCK_NOW),
      env.MIGRATION_DIRECTORY.prepare(
        'INSERT INTO oauth_clients (id, name, redirect_uris, created_at, active_at) VALUES (?, ?, ?, ?, ?)',
      ).bind(CLIENT_ID, 'Claude', '[]', CLOCK_NOW, CLOCK_NOW),
      env.MIGRATION_DIRECTORY.prepare(
        'INSERT INTO oauth_grants (id, client_id, owner_id, project_id, redirect_uri, created_at, last_used_at) VALUES (?, ?, ?, NULL, ?, ?, ?)',
      ).bind(GRANT_ID, CLIENT_ID, OWNER_ID, 'https://claude.ai/api/mcp/auth_callback', CLOCK_NOW, CLOCK_NOW),
      env.MIGRATION_DIRECTORY.prepare(
        "INSERT INTO oauth_tokens (digest, grant_id, kind, created_at, expires_at, spent_at) VALUES (?, ?, 'refresh', ?, ?, ?), (?, ?, 'refresh', ?, ?, ?), (?, ?, 'refresh', ?, ?, NULL)",
      ).bind(
        FIRST_DIGEST,
        GRANT_ID,
        CLOCK_NOW,
        expiresAt,
        ROTATED_AT,
        SECOND_DIGEST,
        GRANT_ID,
        ROTATED_AT,
        expiresAt,
        ROTATED_AGAIN_AT,
        THIRD_DIGEST,
        GRANT_ID,
        ROTATED_AGAIN_AT,
        expiresAt,
      ),
    ]);
    await applyMigrationNamed(MIGRATION_NAME);
  });

  test('the token issued by the code keeps no parent', async () => {
    expect(await parentOf(FIRST_DIGEST)).toBeNull();
  });

  test('each rotated token names the token spent at the moment it was issued', async () => {
    expect(await parentOf(SECOND_DIGEST)).toBe(FIRST_DIGEST);
    expect(await parentOf(THIRD_DIGEST)).toBe(SECOND_DIGEST);
  });
});
