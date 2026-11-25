import { DAY_EMAIL_RETENTION_MS } from '@todz/types';
import { SignInProviderKind } from '../sign-in-provider';

export enum DayEmailFailure {
  ReadFailed = 'read_failed',
  TooManyProjects = 'too_many_projects',
  SendFailed = 'send_failed',
}

export type OwnerIdentityRow = { time_zone: string; subject: string };

export type CandidateRow = { owner_id: string; time_zone: string; day_email_minutes: number; address: string };

const CANDIDATES_STATEMENT = `SELECT owners.id AS owner_id, owners.time_zone, owners.day_email_minutes, owner_identities.subject AS address
FROM owners
JOIN owner_identities ON owner_identities.owner_id = owners.id AND owner_identities.provider = ?
WHERE owners.day_email = 1 AND EXISTS (SELECT 1 FROM workspaces WHERE workspaces.owner_id = owners.id)
GROUP BY owners.id
HAVING count(*) = 1
ORDER BY owners.created_at, owners.rowid`;

export async function findCandidateRows({ directory }: { directory: D1Database }): Promise<CandidateRow[]> {
  const { results } = await directory.prepare(CANDIDATES_STATEMENT).bind(SignInProviderKind.Email).all<CandidateRow>();
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
  ]);
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
    .prepare('SELECT owner_id FROM day_email_reply_addresses WHERE digest = ? AND expires_at > ?')
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

export async function countRepliesSince({
  directory,
  ownerId,
  since,
}: {
  directory: D1Database;
  ownerId: string;
  since: number;
}): Promise<number> {
  const row = await directory
    .prepare('SELECT count(*) AS total FROM day_email_replies WHERE owner_id = ? AND accepted_at >= ?')
    .bind(ownerId, since)
    .first<{ total: number }>();
  if (row === null) throw new Error('the reply count is missing');
  return row.total;
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

export async function insertReply({
  directory,
  ownerId,
  messageDigest,
  now,
}: {
  directory: D1Database;
  ownerId: string;
  messageDigest: string;
  now: number;
}): Promise<void> {
  await directory
    .prepare('INSERT INTO day_email_replies (owner_id, message_digest, accepted_at) VALUES (?, ?, ?) ON CONFLICT DO NOTHING')
    .bind(ownerId, messageDigest, now)
    .run();
}
