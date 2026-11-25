import { MILLISECONDS_PER_DAY } from '@todz/types';
import { ConfirmationState, type WaitlistRow, type WaitlistSummary } from './admin-waitlist';

export const ADMIN_WAITLIST_ROWS_MAX = 200;
export const DIGEST_ADDRESSES_MAX = 50;

const COUNTS_STATEMENT =
  'SELECT count(*) AS total, count(CASE WHEN joined_at > ? THEN 1 END) AS joined_last_day, count(confirmation_failed_at) AS failed_confirmations FROM waitlist';
const NEWEST_FIRST = 'ORDER BY joined_at DESC, rowid DESC';
const ROWS_STATEMENT = `SELECT address, joined_at, confirmation_failed_at FROM waitlist ${NEWEST_FIRST}`;
const DIGEST_COUNTS_STATEMENT =
  'SELECT count(CASE WHEN joined_at > ?1 AND joined_at <= ?2 THEN 1 END) AS joined, count(CASE WHEN joined_at <= ?2 THEN 1 END) AS total, count(CASE WHEN confirmation_failed_at > ?1 AND confirmation_failed_at <= ?2 THEN 1 END) AS failed_confirmations FROM waitlist';
const DIGEST_ADDRESSES_STATEMENT = `SELECT address FROM waitlist WHERE joined_at > ?1 AND joined_at <= ?2 ${NEWEST_FIRST} LIMIT ?3`;

type AdminLinkInsertion = {
  database: D1Database;
  digest: string;
  email: string;
  challenge: string;
  now: number;
  expiresAt: number;
  windowStart: number;
  linksPerWindowMax: number;
};

type AdminLinkSpending = { database: D1Database; digest: string; challenge: string; email: string; now: number };

type AdminSessionOpening = { database: D1Database; digest: string; email: string; now: number; expiresAt: number };

export type WaitlistDigestFacts = {
  joined: number;
  total: number;
  failedConfirmations: number;
  addresses: string[];
  moreAddresses: number;
};

type WaitlistCounts = { total: number; joined_last_day: number; failed_confirmations: number };

type DigestCounts = { joined: number; total: number; failed_confirmations: number };

type WaitlistRecord = { address: string; joined_at: number; confirmation_failed_at: number | null };

function waitlistRowOf(record: WaitlistRecord): WaitlistRow {
  const isFailed = record.confirmation_failed_at !== null;
  return {
    address: record.address,
    joinedAt: record.joined_at,
    confirmation: isFailed ? ConfirmationState.Failed : ConfirmationState.Sent,
  };
}

export async function insertAdminLinkWithinLimit({
  database,
  digest,
  email,
  challenge,
  now,
  expiresAt,
  windowStart,
  linksPerWindowMax,
}: AdminLinkInsertion): Promise<boolean> {
  await database.prepare('DELETE FROM admin_sign_in_links WHERE expires_at <= ?').bind(now).run();
  const insertion = await database
    .prepare(
      'INSERT INTO admin_sign_in_links (digest, email, challenge, created_at, expires_at) SELECT ?, ?, ?, ?, ? WHERE (SELECT count(*) FROM admin_sign_in_links WHERE email = ? AND created_at > ?) < ?',
    )
    .bind(digest, email, challenge, now, expiresAt, email, windowStart, linksPerWindowMax)
    .run();
  return insertion.meta.changes > 0;
}

export async function spendAdminLink({ database, digest, challenge, email, now }: AdminLinkSpending): Promise<boolean> {
  const spent = await database
    .prepare(
      'UPDATE admin_sign_in_links SET consumed_at = ? WHERE digest = ? AND challenge = ? AND email = ? AND consumed_at IS NULL AND expires_at > ? RETURNING digest',
    )
    .bind(now, digest, challenge, email, now)
    .first<{ digest: string }>();
  return spent !== null;
}

export async function deleteAdminLink({ database, digest }: { database: D1Database; digest: string }): Promise<void> {
  await database.prepare('DELETE FROM admin_sign_in_links WHERE digest = ?').bind(digest).run();
}

export async function openAdminSession({ database, digest, email, now, expiresAt }: AdminSessionOpening): Promise<void> {
  await database.prepare('DELETE FROM admin_sessions WHERE expires_at <= ?').bind(now).run();
  await database
    .prepare('INSERT INTO admin_sessions (digest, email, created_at, expires_at) VALUES (?, ?, ?, ?)')
    .bind(digest, email, now, expiresAt)
    .run();
}

export async function adminSessionEmail({
  database,
  digest,
  now,
}: {
  database: D1Database;
  digest: string;
  now: number;
}): Promise<string | null> {
  const session = await database
    .prepare('SELECT email FROM admin_sessions WHERE digest = ? AND expires_at > ?')
    .bind(digest, now)
    .first<{ email: string }>();
  if (session === null) return null;
  return session.email;
}

export async function deleteAdminSession({ database, digest }: { database: D1Database; digest: string }): Promise<void> {
  await database.prepare('DELETE FROM admin_sessions WHERE digest = ?').bind(digest).run();
}

export async function waitlistSummaryOf({ database, now }: { database: D1Database; now: number }): Promise<WaitlistSummary> {
  const counts = await database
    .prepare(COUNTS_STATEMENT)
    .bind(now - MILLISECONDS_PER_DAY)
    .first<WaitlistCounts>();
  if (counts === null) throw new Error('the waitlist count returned no row');
  const { results } = await database.prepare(`${ROWS_STATEMENT} LIMIT ?`).bind(ADMIN_WAITLIST_ROWS_MAX).all<WaitlistRecord>();
  return {
    total: counts.total,
    joinedLastDay: counts.joined_last_day,
    failedConfirmations: counts.failed_confirmations,
    rows: results.map(waitlistRowOf),
  };
}

export async function waitlistRowsOf({ database }: { database: D1Database }): Promise<WaitlistRow[]> {
  const { results } = await database.prepare(ROWS_STATEMENT).all<WaitlistRecord>();
  return results.map(waitlistRowOf);
}

export async function waitlistDigestFacts({
  database,
  since,
  until,
}: {
  database: D1Database;
  since: number;
  until: number;
}): Promise<WaitlistDigestFacts> {
  const [countsResult, addressesResult] = await database.batch<DigestCounts | { address: string }>([
    database.prepare(DIGEST_COUNTS_STATEMENT).bind(since, until),
    database.prepare(DIGEST_ADDRESSES_STATEMENT).bind(since, until, DIGEST_ADDRESSES_MAX),
  ]);
  const isMissingResult = countsResult === undefined || addressesResult === undefined;
  if (isMissingResult) throw new Error('the batch answers one result per statement');
  const counts = countsResult.results[0] as DigestCounts | undefined;
  if (counts === undefined) throw new Error('the digest count returned no row');
  const addresses = (addressesResult.results as { address: string }[]).map((record) => record.address);
  return {
    joined: counts.joined,
    total: counts.total,
    failedConfirmations: counts.failed_confirmations,
    addresses,
    moreAddresses: counts.joined - addresses.length,
  };
}
