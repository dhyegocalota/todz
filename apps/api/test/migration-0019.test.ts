import { Language } from '@todz/types';
import { env } from 'cloudflare:workers';
import { beforeAll, describe, expect, test } from 'vitest';
import { applyMigrationNamed, applyMigrationsThrough } from './migration-directory';
import { CLOCK_NOW } from './task-fixtures';

const LAST_NUMBER_BEFORE = '0018';
const MIGRATION_NAME = '0019_owner_language.sql';
const EXISTING_OWNER_ID = 'existing-owner';
const NEW_OWNER_ID = 'new-owner';

type LanguageRow = { language: string };

async function languageOf(id: string): Promise<string> {
  const row = await env.MIGRATION_DIRECTORY.prepare('SELECT language FROM owners WHERE id = ?').bind(id).first<LanguageRow>();
  if (row === null) throw new Error('the seeded owner should exist');
  return row.language;
}

beforeAll(async () => {
  await applyMigrationsThrough(LAST_NUMBER_BEFORE);
  await env.MIGRATION_DIRECTORY.prepare('INSERT INTO owners (id, time_zone, created_at) VALUES (?, ?, ?)')
    .bind(EXISTING_OWNER_ID, 'UTC', CLOCK_NOW)
    .run();
  await applyMigrationNamed(MIGRATION_NAME);
});

describe('migration 0019', () => {
  test('leaves an owner that existed before in English', async () => {
    expect(await languageOf(EXISTING_OWNER_ID)).toBe(Language.English);
  });

  test('gives an owner inserted without a language English', async () => {
    await env.MIGRATION_DIRECTORY.prepare('INSERT INTO owners (id, time_zone, created_at) VALUES (?, ?, ?)')
      .bind(NEW_OWNER_ID, 'UTC', CLOCK_NOW)
      .run();
    expect(await languageOf(NEW_OWNER_ID)).toBe(Language.English);
  });
});
