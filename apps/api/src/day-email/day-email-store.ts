import {
  DAY_EMAIL_CATCH_UP_MINUTES,
  DAY_EMAIL_RETENTION_MS,
  MILLISECONDS_PER_DAY,
  MILLISECONDS_PER_MINUTE,
  REPLY_DAILY_MAX,
} from '@todz/types';
import { SignInProviderKind } from '../sign-in-provider';

export enum DayEmailFailure {
  ReadFailed = 'read_failed',
  TooManyProjects = 'too_many_projects',
  SendFailed = 'send_failed',
}

export type OwnerIdentityRow = { time_zone: string; subject: string };

export type CandidateRow = { owner_id: string; time_zone: string; day_email_minutes: number; language: string; address: string };

const CANDIDATES_STATEMENT = `SELECT owners.id AS owner_id, owners.time_zone, owners.day_email_minutes, owners.language, owner_identities.subject AS address
FROM owners
JOIN owner_identities ON owner_identities.owner_id = owners.id AND owner_identities.provider = ?
WHERE owners.day_email = 1
  AND EXISTS (SELECT 1 FROM workspaces WHERE workspaces.owner_id = owners.id)
  AND NOT EXISTS (SELECT 1 FROM day_emails WHERE day_emails.owner_id = owners.id AND day_emails.claimed_at > ?)
GROUP BY owners.id
HAVING count(*) = 1
ORDER BY owners.created_at, owners.rowid`;

// NB ADR 0063: an owner claimed within the catch-up window is already past its due day, so later ticks of the window skip it.
export async function findCandidateRows({ directory, now }: { directory: D1Database; now: number }): Promise<CandidateRow[]> {
  const { results } = await directory
    .prepare(CANDIDATES_STATEMENT)
    .bind(SignInProviderKind.Email, now - DAY_EMAIL_CATCH_UP_MINUTES * MILLISECONDS_PER_MINUTE)
    .all<CandidateRow>();
  return results;
}

export async function claimDay({
  directory,
  ownerId,
  day,
  now,
}: {
  directory: D1Database;
  ownerId: string;
  day: string;
  now: number;
}): Promise<boolean> {
  const result = await directory
    .prepare('INSERT INTO day_emails (owner_id, day, claimed_at) VALUES (?, ?, ?) ON CONFLICT DO NOTHING')
    .bind(ownerId, day, now)
    .run();
  return result.meta.changes > 0;
}

export async function markSent({
  directory,
  ownerId,
  day,
  now,
}: {
  directory: D1Database;
  ownerId: string;
  day: string;
  now: number;
}): Promise<void> {
  await directory.prepare('UPDATE day_emails SET sent_at = ? WHERE owner_id = ? AND day = ?').bind(now, ownerId, day).run();
}

export async function markFailed({
  directory,
  ownerId,
  day,
  now,
  failure,
}: {
  directory: D1Database;
  ownerId: string;
  day: string;
  now: number;
  failure: DayEmailFailure;
}): Promise<void> {
  await directory
    .prepare('UPDATE day_emails SET failed_at = ?, failure = ? WHERE owner_id = ? AND day = ?')
    .bind(now, failure, ownerId, day)
    .run();
}

export async function pruneDayEmails({ directory, now }: { directory: D1Database; now: number }): Promise<void> {
  const retainedSince = now - DAY_EMAIL_RETENTION_MS;
  await directory.batch([
    directory.prepare('DELETE FROM day_emails WHERE claimed_at < ?').bind(retainedSince),
    directory.prepare('DELETE FROM day_email_replies WHERE accepted_at < ?').bind(retainedSince),
    directory.prepare('DELETE FROM day_email_reply_addresses WHERE expires_at < ?').bind(now),
    directory.prepare('DELETE FROM day_email_stop_links WHERE expires_at < ?').bind(now),
  ]);
}

export async function insertStopLink({
  directory,
  digest,
  ownerId,
  now,
  expiresAt,
}: {
  directory: D1Database;
  digest: string;
  ownerId: string;
  now: number;
  expiresAt: number;
}): Promise<void> {
  await directory
    .prepare('INSERT INTO day_email_stop_links (digest, owner_id, created_at, expires_at) VALUES (?, ?, ?, ?)')
    .bind(digest, ownerId, now, expiresAt)
    .run();
}

export async function insertReplyAddress({
  directory,
  digest,
  ownerId,
  now,
  expiresAt,
}: {
  directory: D1Database;
  digest: string;
  ownerId: string;
  now: number;
  expiresAt: number;
}): Promise<void> {
  await directory
    .prepare('INSERT INTO day_email_reply_addresses (digest, owner_id, created_at, expires_at) VALUES (?, ?, ?, ?)')
    .bind(digest, ownerId, now, expiresAt)
    .run();
}

const LIVE_STOP_LINK_OWNER = 'SELECT owner_id FROM day_email_stop_links WHERE digest = ?1 AND expires_at > ?2';

export async function isStopLinkLive({ directory, digest, now }: { directory: D1Database; digest: string; now: number }): Promise<boolean> {
  const row = await directory.prepare(LIVE_STOP_LINK_OWNER).bind(digest, now).first<{ owner_id: string }>();
  return row !== null;
}

export async function stopDayEmail({ directory, digest, now }: { directory: D1Database; digest: string; now: number }): Promise<boolean> {
  const [turnedOff] = await directory.batch([
    directory.prepare(`UPDATE owners SET day_email = 0, day_email_chosen_at = ?2 WHERE id = (${LIVE_STOP_LINK_OWNER})`).bind(digest, now),
    directory.prepare(`DELETE FROM day_email_reply_addresses WHERE owner_id = (${LIVE_STOP_LINK_OWNER})`).bind(digest, now),
    directory.prepare(`DELETE FROM day_email_stop_links WHERE owner_id = (${LIVE_STOP_LINK_OWNER})`).bind(digest, now),
  ]);
  if (turnedOff === undefined) throw new Error('a batch answers one result per statement');
  return turnedOff.meta.changes > 0;
}

export async function findReplyAddressOwner({
  directory,
  digest,
  now,
}: {
  directory: D1Database;
  digest: string;
  now: number;
}): Promise<string | null> {
  const row = await directory
    .prepare(
      'SELECT day_email_reply_addresses.owner_id FROM day_email_reply_addresses JOIN owners ON owners.id = day_email_reply_addresses.owner_id WHERE day_email_reply_addresses.digest = ? AND day_email_reply_addresses.expires_at > ? AND owners.day_email = 1',
    )
    .bind(digest, now)
    .first<{ owner_id: string }>();
  if (row === null) return null;
  return row.owner_id;
}

export async function findOwnerEmailIdentities({
  directory,
  ownerId,
}: {
  directory: D1Database;
  ownerId: string;
}): Promise<OwnerIdentityRow[]> {
  const { results } = await directory
    .prepare(
      'SELECT owners.time_zone, owner_identities.subject FROM owner_identities JOIN owners ON owners.id = owner_identities.owner_id WHERE owner_identities.owner_id = ? AND owner_identities.provider = ?',
    )
    .bind(ownerId, SignInProviderKind.Email)
    .all<OwnerIdentityRow>();
  return results;
}

export async function findFirstInboxId({ directory, ownerId }: { directory: D1Database; ownerId: string }): Promise<string | null> {
  const row = await directory
    .prepare(
      'SELECT projects.id FROM projects JOIN workspaces ON workspaces.id = projects.workspace_id WHERE workspaces.owner_id = ? AND projects.is_inbox = 1 ORDER BY workspaces.created_at, workspaces.rowid LIMIT 1',
    )
    .bind(ownerId)
    .first<{ id: string }>();
  if (row === null) return null;
  return row.id;
}

const CLAIM_REPLY_STATEMENT = `INSERT INTO day_email_replies (owner_id, message_digest, accepted_at)
SELECT ?1, ?2, ?3
WHERE (SELECT count(*) FROM day_email_replies WHERE owner_id = ?1 AND accepted_at >= ?4) < ?5
ON CONFLICT DO NOTHING`;

export enum ReplyClaim {
  Claimed = 'claimed',
  Known = 'known',
  DailyMaximum = 'daily_maximum',
}

export async function claimReply({
  directory,
  ownerId,
  messageDigest,
  now,
}: {
  directory: D1Database;
  ownerId: string;
  messageDigest: string;
  now: number;
}): Promise<ReplyClaim> {
  const claimed = await directory
    .prepare(CLAIM_REPLY_STATEMENT)
    .bind(ownerId, messageDigest, now, now - MILLISECONDS_PER_DAY, REPLY_DAILY_MAX)
    .run();
  if (claimed.meta.changes > 0) return ReplyClaim.Claimed;
  const known = await directory
    .prepare('SELECT 1 AS present FROM day_email_replies WHERE owner_id = ? AND message_digest = ?')
    .bind(ownerId, messageDigest)
    .first<{ present: number }>();
  if (known === null) return ReplyClaim.DailyMaximum;
  return ReplyClaim.Known;
}
