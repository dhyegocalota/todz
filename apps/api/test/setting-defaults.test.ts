import { env } from 'cloudflare:workers';
import { beforeAll, describe, expect, test } from 'vitest';
import { seedEmailIdentity, seedOwner, seedWorkspace } from './directory-seed';
import { statementNamed } from './setting-default-statements';
import { CLOCK_NOW } from './task-fixtures';

const COUNTS_STATEMENT = 'candidate-counts.sql';
const DEFAULT_STATEMENT = 'day-email-default.sql';

type SeededOwner = { ownerId: string; address: string };
type OwnerFlags = { day_email: number; day_email_chosen_at: number | null };

async function emailOwner({ hasWorkspace }: { hasWorkspace: boolean }): Promise<SeededOwner> {
  const ownerId = await seedOwner();
  const address = `${crypto.randomUUID()}@example.com`;
  await seedEmailIdentity({ ownerId, email: address });
  if (hasWorkspace) await seedWorkspace({ ownerId });
  return { ownerId, address };
}

async function setFlags({
  ownerId,
  agentNudge,
  dayEmail,
  dayEmailChosenAt,
}: {
  ownerId: string;
  agentNudge: number;
  dayEmail: number;
  dayEmailChosenAt: number | null;
}): Promise<void> {
  await env.DIRECTORY.prepare('UPDATE owners SET agent_nudge = ?, day_email = ?, day_email_chosen_at = ? WHERE id = ?')
    .bind(agentNudge, dayEmail, dayEmailChosenAt, ownerId)
    .run();
}

async function flagsOf(ownerId: string): Promise<OwnerFlags> {
  const row = await env.DIRECTORY.prepare('SELECT day_email, day_email_chosen_at FROM owners WHERE id = ?')
    .bind(ownerId)
    .first<OwnerFlags>();
  if (row === null) throw new Error('the owner should exist');
  return row;
}

let untouched: SeededOwner;
let chosenOff: SeededOwner;
let chosenOn: SeededOwner;
let withoutWorkspace: SeededOwner;
let withoutAddress: string;

beforeAll(async () => {
  untouched = await emailOwner({ hasWorkspace: true });
  chosenOff = await emailOwner({ hasWorkspace: true });
  chosenOn = await emailOwner({ hasWorkspace: true });
  withoutWorkspace = await emailOwner({ hasWorkspace: false });
  withoutAddress = await seedOwner();
  await seedWorkspace({ ownerId: withoutAddress });
  await setFlags({ ownerId: untouched.ownerId, agentNudge: 1, dayEmail: 0, dayEmailChosenAt: null });
  await setFlags({ ownerId: chosenOff.ownerId, agentNudge: 0, dayEmail: 0, dayEmailChosenAt: CLOCK_NOW });
  await setFlags({ ownerId: chosenOn.ownerId, agentNudge: 1, dayEmail: 1, dayEmailChosenAt: CLOCK_NOW });
  await setFlags({ ownerId: withoutWorkspace.ownerId, agentNudge: 0, dayEmail: 0, dayEmailChosenAt: null });
});

async function countsRow(): Promise<Record<string, number>> {
  const row = await env.DIRECTORY.prepare(statementNamed(COUNTS_STATEMENT)).first<Record<string, number>>();
  if (row === null) throw new Error('the counts always answer a row');
  return row;
}

describe('the candidate counts', () => {
  test('answer four numbers and no address or id', async () => {
    const row = await countsRow();
    expect(Object.values(row).every((value) => typeof value === 'number')).toBe(true);
    expect(Object.keys(row)).toHaveLength(4);
  });

  test('count all owners, the owners with an email identity and a workspace, the owners with the nudge on and every email owner who never chose the day email', async () => {
    expect(Object.values(await countsRow())).toEqual([5, 3, 2, 2]);
  });
});

describe('the day email default', () => {
  test('turns on only the email owners who never chose it and leaves a chosen off at off, a chosen on at on and an owner with no email address at off', async () => {
    await env.DIRECTORY.prepare(statementNamed(DEFAULT_STATEMENT)).run();
    expect(await flagsOf(untouched.ownerId)).toEqual({ day_email: 1, day_email_chosen_at: null });
    expect(await flagsOf(withoutWorkspace.ownerId)).toEqual({ day_email: 1, day_email_chosen_at: null });
    expect(await flagsOf(withoutAddress)).toEqual({ day_email: 0, day_email_chosen_at: null });
    expect(await flagsOf(chosenOff.ownerId)).toEqual({ day_email: 0, day_email_chosen_at: CLOCK_NOW });
    expect(await flagsOf(chosenOn.ownerId)).toEqual({ day_email: 1, day_email_chosen_at: CLOCK_NOW });
  });
});
