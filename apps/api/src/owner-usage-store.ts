import { FairUseLimit } from '@todz/types';
import type { FairUseLimits } from './fair-use-limits';
import { SignInProviderKind } from './sign-in-provider';

export enum WriteRefusal {
  Suspended = 'suspended',
  DailyWrites = 'daily_writes',
  StoredBytes = 'stored_bytes',
}

export type OwnerUsageRow = { owner_id: string; writes: number; bytes: number; suspended_at: number | null; email: string | null };

export type OwnerUsageRecord = { ownerId: string; writes: number; bytes: number; email: string | null; isSuspended: boolean };

export enum UsageRanking {
  Writes = 'writes',
  Bytes = 'bytes',
}

const STORED_BYTES_SUM = 'SELECT COALESCE(SUM(bytes), 0) FROM owner_usage WHERE owner_id = ?1';

const RESERVE_WRITES = `INSERT INTO owner_usage (owner_id, day, writes, bytes)
SELECT ?1, ?2, ?3, ?4 FROM owners
WHERE id = ?1 AND suspended_at IS NULL AND ?3 <= ?5 AND (${STORED_BYTES_SUM}) + ?4 <= ?6
ON CONFLICT (owner_id, day) DO UPDATE SET writes = owner_usage.writes + excluded.writes, bytes = owner_usage.bytes + excluded.bytes
WHERE owner_usage.writes + excluded.writes <= ?5 AND (${STORED_BYTES_SUM}) + excluded.bytes <= ?6
RETURNING writes`;

const DIAGNOSIS = `SELECT owners.suspended_at AS suspended_at,
  COALESCE((SELECT writes FROM owner_usage WHERE owner_id = owners.id AND day = ?2), 0) AS writes_today,
  (${STORED_BYTES_SUM.replace('?1', 'owners.id')}) AS stored_bytes
FROM owners WHERE owners.id = ?1`;

const USAGE_SINCE = (
  ranking: UsageRanking,
): string => `SELECT usage.owner_id AS owner_id, SUM(usage.writes) AS writes, SUM(usage.bytes) AS bytes,
  owners.suspended_at AS suspended_at,
  (SELECT owner_identities.subject FROM owner_identities WHERE owner_identities.owner_id = usage.owner_id AND owner_identities.provider = ?2) AS email
FROM owner_usage AS usage JOIN owners ON owners.id = usage.owner_id
WHERE usage.day >= ?1
GROUP BY usage.owner_id
ORDER BY ${ranking} DESC, usage.owner_id
LIMIT ?3`;

const PRUNE_SIGN_UPS = 'DELETE FROM sign_up_usage WHERE day < ?';
const RESERVE_SIGN_UP = `INSERT INTO sign_up_usage (client_key, day, accounts) VALUES (?1, ?2, 1)
ON CONFLICT (client_key, day) DO UPDATE SET accounts = sign_up_usage.accounts + 1 WHERE sign_up_usage.accounts < ?3
RETURNING accounts`;

type DiagnosisRow = { suspended_at: number | null; writes_today: number; stored_bytes: number };

export async function reserveOwnerWrites({
  directory,
  ownerId,
  day,
  writes,
  bytes,
  limits,
}: {
  directory: D1Database;
  ownerId: string;
  day: string;
  writes: number;
  bytes: number;
  limits: FairUseLimits;
}): Promise<WriteRefusal | null> {
  const reserved = await directory
    .prepare(RESERVE_WRITES)
    .bind(ownerId, day, writes, bytes, limits[FairUseLimit.DailyWrites], limits[FairUseLimit.StoredBytes])
    .first<{ writes: number }>();
  if (reserved !== null) return null;
  return diagnoseWriteRefusal({ directory, ownerId, day, writes, limits });
}

async function diagnoseWriteRefusal({
  directory,
  ownerId,
  day,
  writes,
  limits,
}: {
  directory: D1Database;
  ownerId: string;
  day: string;
  writes: number;
  limits: FairUseLimits;
}): Promise<WriteRefusal> {
  const row = await directory.prepare(DIAGNOSIS).bind(ownerId, day).first<DiagnosisRow>();
  if (row === null) throw new Error('a refused reservation names an owner with no row');
  if (row.suspended_at !== null) return WriteRefusal.Suspended;
  if (row.writes_today + writes > limits[FairUseLimit.DailyWrites]) return WriteRefusal.DailyWrites;
  return WriteRefusal.StoredBytes;
}

export async function setOwnerSuspension({
  directory,
  ownerId,
  suspendedAt,
}: {
  directory: D1Database;
  ownerId: string;
  suspendedAt: number | null;
}): Promise<boolean> {
  const result = await directory.prepare('UPDATE owners SET suspended_at = ? WHERE id = ?').bind(suspendedAt, ownerId).run();
  return result.meta.changes > 0;
}

export async function findOwnerSuspension({ directory, ownerId }: { directory: D1Database; ownerId: string }): Promise<boolean> {
  const row = await directory
    .prepare('SELECT suspended_at FROM owners WHERE id = ?')
    .bind(ownerId)
    .first<{ suspended_at: number | null }>();
  if (row === null) throw new Error('a session names an owner with no row');
  return row.suspended_at !== null;
}

export async function topOwnerUsage({
  directory,
  sinceDay,
  ranking,
  limit,
}: {
  directory: D1Database;
  sinceDay: string;
  ranking: UsageRanking;
  limit: number;
}): Promise<OwnerUsageRecord[]> {
  const { results } = await directory.prepare(USAGE_SINCE(ranking)).bind(sinceDay, SignInProviderKind.Email, limit).all<OwnerUsageRow>();
  return results.map((row) => ({
    ownerId: row.owner_id,
    writes: row.writes,
    bytes: row.bytes,
    email: row.email,
    isSuspended: row.suspended_at !== null,
  }));
}

export async function reserveSignUp({
  directory,
  clientKey,
  day,
  limit,
}: {
  directory: D1Database;
  clientKey: string;
  day: string;
  limit: number;
}): Promise<boolean> {
  const [, reservation] = await directory.batch([
    directory.prepare(PRUNE_SIGN_UPS).bind(day),
    directory.prepare(RESERVE_SIGN_UP).bind(clientKey, day, limit),
  ]);
  if (reservation === undefined) throw new Error('the batch answers one result per statement');
  return reservation.results.length > 0;
}
