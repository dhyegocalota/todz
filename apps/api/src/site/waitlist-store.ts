import { MILLISECONDS_PER_DAY, WAITLIST_DAILY_JOINS_MAX } from '@todz/types';

export enum WaitlistJoin {
  Claimed = 'claimed',
  Known = 'known',
  Full = 'full',
}

// NB ADR 0050: one statement inserts the address and claims its one confirmation mail, so a known address claims nothing.
export async function joinWaitlistWithinLimit({
  database,
  address,
  now,
}: {
  database: D1Database;
  address: string;
  now: number;
}): Promise<WaitlistJoin> {
  const insertion = await database
    .prepare(
      'INSERT INTO waitlist (address, joined_at, confirmation_claimed_at) SELECT ?1, ?2, ?2 WHERE (SELECT count(*) FROM waitlist WHERE joined_at > ?3) < ?4 ON CONFLICT (address) DO NOTHING',
    )
    .bind(address, now, now - MILLISECONDS_PER_DAY, WAITLIST_DAILY_JOINS_MAX)
    .run();
  if (insertion.meta.changes === 1) return WaitlistJoin.Claimed;
  const known = await database.prepare('SELECT address FROM waitlist WHERE address = ?').bind(address).first();
  if (known === null) return WaitlistJoin.Full;
  return WaitlistJoin.Known;
}

export async function recordConfirmationFailure({
  database,
  address,
  now,
}: {
  database: D1Database;
  address: string;
  now: number;
}): Promise<void> {
  await database.prepare('UPDATE waitlist SET confirmation_failed_at = ? WHERE address = ?').bind(now, address).run();
}
