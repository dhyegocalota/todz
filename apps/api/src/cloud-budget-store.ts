import { BudgetLevel } from './cloud-budget';

const MONTH_WRITES = 'SELECT COALESCE(SUM(writes), 0) AS writes FROM owner_usage WHERE day >= ?1';
const RECORD_BUDGET = `INSERT INTO cloud_budget (month, level, heavy_writes) VALUES (?1, ?2, ?3)
ON CONFLICT (month) DO UPDATE SET level = excluded.level, heavy_writes = excluded.heavy_writes`;
const IS_WARNED = 'SELECT 1 AS warned FROM cloud_budget WHERE month = ?1 AND warned_at IS NOT NULL';
const STAMP_WARNING = 'UPDATE cloud_budget SET warned_at = ?2 WHERE month = ?1 AND warned_at IS NULL';
const IS_HEAVY_WRITER = `SELECT 1 AS heavy FROM cloud_budget
WHERE month = ?1 AND level = ?2 AND heavy_writes < (SELECT COALESCE(SUM(writes), 0) FROM owner_usage WHERE owner_id = ?3 AND day >= ?4)
AND NOT EXISTS (SELECT 1 FROM owner_identities WHERE owner_id = ?3 AND provider = ?5 AND subject = ?6)`;

export async function monthWritesOf({ directory, monthStartDay }: { directory: D1Database; monthStartDay: string }): Promise<number> {
  const row = await directory.prepare(MONTH_WRITES).bind(monthStartDay).first<{ writes: number }>();
  if (row === null) throw new Error('a count always answers');
  return row.writes;
}

export async function recordBudget({
  directory,
  month,
  level,
  heavyWrites,
}: {
  directory: D1Database;
  month: string;
  level: BudgetLevel;
  heavyWrites: number;
}): Promise<void> {
  await directory.prepare(RECORD_BUDGET).bind(month, level, heavyWrites).run();
}

export async function isWarned({ directory, month }: { directory: D1Database; month: string }): Promise<boolean> {
  const row = await directory.prepare(IS_WARNED).bind(month).first();
  return row !== null;
}

export async function stampWarning({ directory, month, now }: { directory: D1Database; month: string; now: number }): Promise<void> {
  await directory.prepare(STAMP_WARNING).bind(month, now).run();
}

export async function isHeavyWriterRefused({
  directory,
  month,
  monthStartDay,
  ownerId,
  exemptAddress,
  provider,
}: {
  directory: D1Database;
  month: string;
  monthStartDay: string;
  ownerId: string;
  exemptAddress: string | null;
  provider: string;
}): Promise<boolean> {
  const row = await directory
    .prepare(IS_HEAVY_WRITER)
    .bind(month, BudgetLevel.Refusing, ownerId, monthStartDay, provider, exemptAddress)
    .first();
  return row !== null;
}
