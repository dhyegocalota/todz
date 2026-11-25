import { env } from 'cloudflare:workers';
import { beforeAll, describe, expect, test } from 'vitest';
import { applyMigrationNamed, applyMigrationsThrough } from './migration-directory';
import { CLOCK_NOW } from './task-fixtures';

const LAST_NUMBER_BEFORE = '0009';
const MIGRATION_NAME = '0010_agent_nudge_default.sql';

type SeededOwner = { id: string; agentNudge: number; agentNudgeChosenAt: number | null; dayEmail: number; dayEmailChosenAt: number | null };
type OwnerRow = { agent_nudge: number; day_email: number; agent_nudge_chosen_at: number | null; day_email_chosen_at: number | null };

const SEEDED_OWNERS: SeededOwner[] = [
  { id: 'untouched-off', agentNudge: 0, agentNudgeChosenAt: null, dayEmail: 0, dayEmailChosenAt: null },
  { id: 'chosen-off', agentNudge: 0, agentNudgeChosenAt: CLOCK_NOW, dayEmail: 0, dayEmailChosenAt: CLOCK_NOW },
  { id: 'chosen-on', agentNudge: 1, agentNudgeChosenAt: CLOCK_NOW, dayEmail: 1, dayEmailChosenAt: CLOCK_NOW },
];

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
    SEEDED_OWNERS.map(({ id, agentNudge, agentNudgeChosenAt, dayEmail, dayEmailChosenAt }) =>
      env.MIGRATION_DIRECTORY.prepare(
        'INSERT INTO owners (id, time_zone, agent_nudge, agent_nudge_chosen_at, day_email, day_email_chosen_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      ).bind(id, 'UTC', agentNudge, agentNudgeChosenAt, dayEmail, dayEmailChosenAt, CLOCK_NOW),
    ),
  );
  await applyMigrationNamed(MIGRATION_NAME);
});

describe('migration 0010', () => {
  test('turns on the agent nudge of an owner who never chose', async () => {
    expect((await ownerRow('untouched-off')).agent_nudge).toBe(1);
  });

  test('leaves a nudge chosen off at off', async () => {
    expect((await ownerRow('chosen-off')).agent_nudge).toBe(0);
  });

  test('leaves a nudge chosen on at on', async () => {
    expect((await ownerRow('chosen-on')).agent_nudge).toBe(1);
  });

  test('stamps no choice time', async () => {
    expect((await ownerRow('untouched-off')).agent_nudge_chosen_at).toBeNull();
  });

  test.each(SEEDED_OWNERS)('leaves the day email of the owner $id as it was', async ({ id, dayEmail, dayEmailChosenAt }) => {
    const row = await ownerRow(id);
    expect(row.day_email).toBe(dayEmail);
    expect(row.day_email_chosen_at).toBe(dayEmailChosenAt);
  });
});
