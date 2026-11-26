import { CLOUD_ADMISSION_LAPSE_DAYS, CLOUD_INACTIVE_DAYS, MILLISECONDS_PER_DAY } from '@todz/types';
import { SignInProviderKind } from './sign-in-provider';
import { utcDayOf } from './telemetry/telemetry-day';

export function activeOwnerSql({ sinceMilliseconds, sinceDay }: { sinceMilliseconds: string; sinceDay: string }): string {
  return `(owners.created_at >= ${sinceMilliseconds}
  OR owners.last_seen_day >= ${sinceDay}
  OR EXISTS (SELECT 1 FROM sessions WHERE sessions.owner_id = owners.id AND sessions.created_at >= ${sinceMilliseconds})
  OR EXISTS (SELECT 1 FROM owner_usage WHERE owner_usage.owner_id = owners.id AND owner_usage.day >= ${sinceDay}))`;
}

export function outstandingAdmissionSql({
  sinceMilliseconds,
  sinceDay,
  admissionSince,
  provider,
}: {
  sinceMilliseconds: string;
  sinceDay: string;
  admissionSince: string;
  provider: string;
}): string {
  return `(cloud_queue.admitted_at >= ${admissionSince} AND NOT EXISTS (
  SELECT 1 FROM owner_identities JOIN owners ON owners.id = owner_identities.owner_id
  WHERE owner_identities.provider = ${provider} AND owner_identities.subject = cloud_queue.email AND ${activeOwnerSql({ sinceMilliseconds, sinceDay })}))`;
}

const ACTIVE_OWNER = activeOwnerSql({ sinceMilliseconds: '?1', sinceDay: '?2' });
const COUNT_ACTIVE = `SELECT COUNT(*) AS accounts FROM owners WHERE ${ACTIVE_OWNER}`;
const IS_ACTIVE = `SELECT 1 AS active FROM owners WHERE owners.id = ?3 AND ${ACTIVE_OWNER}`;
const ENQUEUE = `INSERT INTO cloud_queue (email, created_at) VALUES (?1, ?2)
ON CONFLICT (email) DO UPDATE SET created_at = excluded.created_at, notified_at = NULL, admitted_at = NULL
WHERE cloud_queue.admitted_at IS NOT NULL AND cloud_queue.admitted_at < ?3`;
const IS_ADMITTED = 'SELECT 1 AS admitted FROM cloud_queue WHERE email = ?1 AND admitted_at >= ?2';
const WAITING = 'SELECT email, created_at FROM cloud_queue WHERE admitted_at IS NULL ORDER BY created_at, email LIMIT ?1';
const ADMIT_NEXT = `UPDATE cloud_queue SET admitted_at = ?1
WHERE email IN (SELECT email FROM cloud_queue WHERE admitted_at IS NULL ORDER BY created_at, email LIMIT ?2) RETURNING email`;
const ADMIT_ONE = 'UPDATE cloud_queue SET admitted_at = ?1 WHERE email = ?2 AND admitted_at IS NULL RETURNING email';
const COUNT_OUTSTANDING_ADMISSIONS = `SELECT COUNT(*) AS admissions FROM cloud_queue WHERE ${outstandingAdmissionSql({
  sinceMilliseconds: '?1',
  sinceDay: '?2',
  admissionSince: '?3',
  provider: '?4',
})}`;
const DIGEST = `SELECT COUNT(*) AS waiting, COALESCE(SUM(notified_at IS NULL), 0) AS fresh,
  (SELECT email FROM cloud_queue WHERE admitted_at IS NULL AND created_at <= ?1 ORDER BY created_at DESC, email DESC LIMIT 1) AS newest
FROM cloud_queue WHERE admitted_at IS NULL AND created_at <= ?1`;
const STAMP_NOTIFIED = 'UPDATE cloud_queue SET notified_at = ?1 WHERE notified_at IS NULL AND admitted_at IS NULL AND created_at <= ?2';

export type QueuedAddress = { email: string; createdAt: number };

export type QueueDigest = { waiting: number; newest: string };

type ActivityBounds = { sinceMilliseconds: number; sinceDay: string };

export function admissionSinceOf(now: number): number {
  return now - CLOUD_ADMISSION_LAPSE_DAYS * MILLISECONDS_PER_DAY;
}

export function activityBoundsOf(now: number): ActivityBounds {
  const sinceMilliseconds = now - CLOUD_INACTIVE_DAYS * MILLISECONDS_PER_DAY;
  return { sinceMilliseconds, sinceDay: utcDayOf(sinceMilliseconds) };
}

export async function countActiveAccounts({ directory, now }: { directory: D1Database; now: number }): Promise<number> {
  const { sinceMilliseconds, sinceDay } = activityBoundsOf(now);
  const row = await directory.prepare(COUNT_ACTIVE).bind(sinceMilliseconds, sinceDay).first<{ accounts: number }>();
  if (row === null) throw new Error('a count always answers');
  return row.accounts;
}

export async function countOutstandingAdmissions({ directory, now }: { directory: D1Database; now: number }): Promise<number> {
  const { sinceMilliseconds, sinceDay } = activityBoundsOf(now);
  const row = await directory
    .prepare(COUNT_OUTSTANDING_ADMISSIONS)
    .bind(sinceMilliseconds, sinceDay, admissionSinceOf(now), SignInProviderKind.Email)
    .first<{ admissions: number }>();
  if (row === null) throw new Error('a count always answers');
  return row.admissions;
}

export async function isActiveOwner({
  directory,
  ownerId,
  now,
}: {
  directory: D1Database;
  ownerId: string;
  now: number;
}): Promise<boolean> {
  const { sinceMilliseconds, sinceDay } = activityBoundsOf(now);
  const row = await directory.prepare(IS_ACTIVE).bind(sinceMilliseconds, sinceDay, ownerId).first();
  return row !== null;
}

export async function enqueueAddress({ directory, email, now }: { directory: D1Database; email: string; now: number }): Promise<void> {
  await directory.prepare(ENQUEUE).bind(email, now, admissionSinceOf(now)).run();
}

export async function isAdmittedAddress({
  directory,
  email,
  now,
}: {
  directory: D1Database;
  email: string;
  now: number;
}): Promise<boolean> {
  const row = await directory.prepare(IS_ADMITTED).bind(email, admissionSinceOf(now)).first();
  return row !== null;
}

export async function waitingAddresses({ directory, limit }: { directory: D1Database; limit: number }): Promise<QueuedAddress[]> {
  const { results } = await directory.prepare(WAITING).bind(limit).all<{ email: string; created_at: number }>();
  return results.map((row) => ({ email: row.email, createdAt: row.created_at }));
}

export async function admitNextAddresses({
  directory,
  count,
  now,
}: {
  directory: D1Database;
  count: number;
  now: number;
}): Promise<string[]> {
  const { results } = await directory.prepare(ADMIT_NEXT).bind(now, count).all<{ email: string }>();
  return results.map((row) => row.email);
}

export async function admitAddress({ directory, email, now }: { directory: D1Database; email: string; now: number }): Promise<string[]> {
  const { results } = await directory.prepare(ADMIT_ONE).bind(now, email).all<{ email: string }>();
  return results.map((row) => row.email);
}

export async function queueDigestThrough({ directory, through }: { directory: D1Database; through: number }): Promise<QueueDigest | null> {
  const row = await directory.prepare(DIGEST).bind(through).first<{ waiting: number; fresh: number; newest: string | null }>();
  if (row === null) throw new Error('a count always answers');
  const { fresh, newest, waiting } = row;
  if (fresh === 0 || newest === null) return null;
  return { waiting, newest };
}

export async function stampQueueDigest({
  directory,
  now,
  through,
}: {
  directory: D1Database;
  now: number;
  through: number;
}): Promise<void> {
  await directory.prepare(STAMP_NOTIFIED).bind(now, through).run();
}
