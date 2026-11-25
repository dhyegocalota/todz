import { env } from 'cloudflare:workers';
import { beforeAll, describe, expect, test } from 'vitest';
import { applyMigrationNamed, applyMigrationsThrough } from './migration-directory';
import { CLOCK_NOW } from './task-fixtures';

const LAST_NUMBER_BEFORE = '0008';
const MIGRATION_NAME = '0009_setting_choices.sql';
const CHECK_FAILURE = 'CHECK constraint failed';
const DIGEST_LENGTH = 64;

type SeededOwner = { id: string; agentNudge: number; dayEmail: number };
type OwnerRow = { agent_nudge: number; day_email: number; agent_nudge_chosen_at: number | null; day_email_chosen_at: number | null };

const SEEDED_OWNERS: SeededOwner[] = [
  { id: 'both-off', agentNudge: 0, dayEmail: 0 },
  { id: 'nudge-on', agentNudge: 1, dayEmail: 0 },
  { id: 'both-on', agentNudge: 1, dayEmail: 1 },
];

let appliedAt = 0;

async function ownerRow(id: string): Promise<OwnerRow> {
  const row = await env.MIGRATION_DIRECTORY.prepare(
    'SELECT agent_nudge, day_email, agent_nudge_chosen_at, day_email_chosen_at FROM owners WHERE id = ?',
  )
    .bind(id)
    .first<OwnerRow>();
  if (row === null) throw new Error('the seeded owner should exist');
  return row;
}

beforeAll(async () => {
  await applyMigrationsThrough(LAST_NUMBER_BEFORE);
  await env.MIGRATION_DIRECTORY.batch(
    SEEDED_OWNERS.map(({ id, agentNudge, dayEmail }) =>
      env.MIGRATION_DIRECTORY.prepare('INSERT INTO owners (id, time_zone, agent_nudge, day_email, created_at) VALUES (?, ?, ?, ?, ?)').bind(
        id,
        'UTC',
        agentNudge,
        dayEmail,
        CLOCK_NOW,
      ),
    ),
  );
  await applyMigrationNamed(MIGRATION_NAME);
  appliedAt = Date.now();
});

describe('migration 0009', () => {
  test.each(SEEDED_OWNERS)('changes no flag of the owner $id', async ({ id, agentNudge, dayEmail }) => {
    const row = await ownerRow(id);
    expect(row.agent_nudge).toBe(agentNudge);
    expect(row.day_email).toBe(dayEmail);
  });

  test.each(SEEDED_OWNERS)('stamps each flag already on and no other, for the owner $id', async ({ id, agentNudge, dayEmail }) => {
    const row = await ownerRow(id);
    const stampOf = (isOn: number, chosenAt: number | null): void => {
      if (isOn === 0) {
        expect(chosenAt).toBeNull();
        return;
      }
      expect(chosenAt).not.toBeNull();
      expect(chosenAt).toBeLessThanOrEqual(appliedAt);
    };
    stampOf(agentNudge, row.agent_nudge_chosen_at);
    stampOf(dayEmail, row.day_email_chosen_at);
  });

  test('creates the stop link table and refuses a digest of 63 characters', async () => {
    const insertion = env.MIGRATION_DIRECTORY.prepare(
      'INSERT INTO day_email_stop_links (digest, owner_id, created_at, expires_at) VALUES (?, ?, ?, ?)',
    )
      .bind('a'.repeat(DIGEST_LENGTH - 1), 'both-on', CLOCK_NOW, CLOCK_NOW + 1)
      .run();
    await expect(insertion).rejects.toThrow(CHECK_FAILURE);
  });

  test('accepts a digest of 64 characters', async () => {
    const insertion = await env.MIGRATION_DIRECTORY.prepare(
      'INSERT INTO day_email_stop_links (digest, owner_id, created_at, expires_at) VALUES (?, ?, ?, ?)',
    )
      .bind('a'.repeat(DIGEST_LENGTH), 'both-on', CLOCK_NOW, CLOCK_NOW + 1)
      .run();
    expect(insertion.meta.changes).toBe(1);
  });
});
