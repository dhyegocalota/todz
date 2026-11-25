// NB ADR 0050: one statement inserts the address and claims its one confirmation mail, so a known address claims nothing.
export async function joinWaitlist({ database, address, now }: { database: D1Database; address: string; now: number }): Promise<boolean> {
  const insertion = await database
    .prepare('INSERT INTO waitlist (address, joined_at, confirmation_claimed_at) VALUES (?1, ?2, ?2) ON CONFLICT (address) DO NOTHING')
    .bind(address, now)
    .run();
  return insertion.meta.changes === 1;
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
