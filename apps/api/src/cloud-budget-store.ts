import { BudgetLevel } from './cloud-budget';
import type { BudgetSource } from './cloud-budget-source';
import { SignInProviderKind } from './sign-in-provider';

const MONTH_WRITES = 'SELECT COALESCE(SUM(writes), 0) AS writes FROM owner_usage WHERE day >= ?1';
const RECORD_BUDGET = `INSERT INTO cloud_budget (month, level, heavy_writes, source, source_reason) VALUES (?1, ?2, ?3, ?4, ?5)
ON CONFLICT (month) DO UPDATE SET level = excluded.level, heavy_writes = excluded.heavy_writes,
  source = excluded.source, source_reason = excluded.source_reason`;
const READ_SOURCE = 'SELECT source, source_reason FROM cloud_budget WHERE month = ?1';
const READ_LEVEL = 'SELECT level FROM cloud_budget WHERE month = ?1';
const IS_WARNED = 'SELECT 1 AS warned FROM cloud_budget WHERE month = ?1 AND warned_at IS NOT NULL';
const STAMP_WARNING = 'UPDATE cloud_budget SET warned_at = ?2 WHERE month = ?1 AND warned_at IS NULL';
const IS_HEAVY_WRITER = `SELECT 1 AS heavy FROM cloud_budget
WHERE month = ?1 AND level = ?2 AND heavy_writes < (SELECT COALESCE(SUM(writes), 0) FROM owner_usage WHERE owner_id = ?3 AND day >= ?4)
AND NOT EXISTS (SELECT 1 FROM owner_identities WHERE owner_id = ?3 AND provider = ?5 AND subject = ?6)`;

export type RecordedSource = { source: BudgetSource; reason: string | null };

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
  source,
  reason,
}: {
  directory: D1Database;
  month: string;
  level: BudgetLevel;
  heavyWrites: number;
  source: BudgetSource;
  reason: string | null;
}): Promise<void> {
  await directory.prepare(RECORD_BUDGET).bind(month, level, heavyWrites, source, reason).run();
}

export async function recordedSourceOf({ directory, month }: { directory: D1Database; month: string }): Promise<RecordedSource | null> {
  const row = await directory.prepare(READ_SOURCE).bind(month).first<{ source: BudgetSource; source_reason: string | null }>();
  if (row === null) return null;
  return { source: row.source, reason: row.source_reason };
}

export async function recordedLevelOf({ directory, month }: { directory: D1Database; month: string }): Promise<BudgetLevel | null> {
  const row = await directory.prepare(READ_LEVEL).bind(month).first<{ level: BudgetLevel }>();
  if (row === null) return null;
  return row.level;
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
}: {
  directory: D1Database;
  month: string;
  monthStartDay: string;
  ownerId: string;
  exemptAddress: string | null;
}): Promise<boolean> {
  const row = await directory
    .prepare(IS_HEAVY_WRITER)
    .bind(month, BudgetLevel.Refusing, ownerId, monthStartDay, SignInProviderKind.Email, exemptAddress)
    .first();
  return row !== null;
}
