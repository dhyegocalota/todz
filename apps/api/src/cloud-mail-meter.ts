import { CLOUD_MAILS_PER_ADDRESS_DAY_MAX, MILLISECONDS_PER_DAY } from '@todz/types';
import { cloudAccountsMaxOf } from './cloud-accounts-max';
import type { Env } from './env';

const RECORD_MAIL = 'INSERT INTO mail_meter (address, sent_at) VALUES (?1, ?2)';
const COUNT_TO_ADDRESS = 'SELECT COUNT(*) AS mails FROM mail_meter WHERE address = ?1 AND sent_at >= ?2';
const COUNT_SINCE = 'SELECT COUNT(*) AS mails FROM mail_meter WHERE sent_at >= ?1';
const PRUNE_BEFORE = 'DELETE FROM mail_meter WHERE sent_at < ?1';

async function countOf({ statement }: { statement: D1PreparedStatement }): Promise<number> {
  const row = await statement.first<{ mails: number }>();
  if (row === null) throw new Error('a count always answers');
  return row.mails;
}

// NB ADR 0099: only the todz cloud meters its mail; a self-hosted server pays no statement for it.
export function mailMeterOf(env: Env): D1Database | null {
  if (cloudAccountsMaxOf(env) === null) return null;
  return env.DIRECTORY;
}

export async function recordMail({ directory, address, now }: { directory: D1Database; address: string; now: number }): Promise<void> {
  await directory.prepare(RECORD_MAIL).bind(address, now).run();
}

export async function isAddressMailBudgetSpent({
  directory,
  address,
  now,
}: {
  directory: D1Database;
  address: string;
  now: number;
}): Promise<boolean> {
  const statement = directory.prepare(COUNT_TO_ADDRESS).bind(address, now - MILLISECONDS_PER_DAY);
  return (await countOf({ statement })) >= CLOUD_MAILS_PER_ADDRESS_DAY_MAX;
}

export function countMailsSince({ directory, since }: { directory: D1Database; since: number }): Promise<number> {
  return countOf({ statement: directory.prepare(COUNT_SINCE).bind(since) });
}

export async function pruneMailsBefore({ directory, before }: { directory: D1Database; before: number }): Promise<void> {
  await directory.prepare(PRUNE_BEFORE).bind(before).run();
}
