import { BudgetLevel } from './cloud-budget';

const MONTH_TOTALS = `SELECT (SELECT COALESCE(SUM(writes), 0) FROM owner_usage WHERE day >= ?1) AS writes,
  (SELECT COUNT(*) FROM day_emails WHERE sent_at >= ?2) + (SELECT COUNT(*) FROM cloud_queue WHERE admitted_at >= ?2) AS emails`;
const RECORD_BUDGET = `INSERT INTO cloud_budget (month, level, heavy_writes) VALUES (?1, ?2, ?3)
ON CONFLICT (month) DO UPDATE SET level = excluded.level, heavy_writes = excluded.heavy_writes`;
const CLAIM_WARNING = 'UPDATE cloud_budget SET warned_at = ?2 WHERE month = ?1 AND warned_at IS NULL RETURNING month';
const IS_HEAVY_WRITER = `SELECT 1 AS heavy FROM cloud_budget
WHERE month = ?1 AND level = ?2 AND heavy_writes < (SELECT COALESCE(SUM(writes), 0) FROM owner_usage WHERE owner_id = ?3 AND day >= ?4)`;

export type MonthTotals = { writes: number; emails: number };

export async function monthTotalsOf({
  directory,
  monthStartDay,
  monthStart,
}: {
  directory: D1Database;
  monthStartDay: string;
  monthStart: number;
}): Promise<MonthTotals> {
  const row = await directory.prepare(MONTH_TOTALS).bind(monthStartDay, monthStart).first<MonthTotals>();
  if (row === null) throw new Error('a count always answers');
  return row;
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

export async function claimWarning({ directory, month, now }: { directory: D1Database; month: string; now: number }): Promise<boolean> {
  const row = await directory.prepare(CLAIM_WARNING).bind(month, now).first();
  return row !== null;
}

export async function isHeavyWriterRefused({
  directory,
  month,
  monthStartDay,
  ownerId,
}: {
  directory: D1Database;
  month: string;
  monthStartDay: string;
  ownerId: string;
}): Promise<boolean> {
  const row = await directory.prepare(IS_HEAVY_WRITER).bind(month, BudgetLevel.Refusing, ownerId, monthStartDay).first();
  return row !== null;
}
