import { AGENT_NUDGE_BY_DEFAULT, DAY_EMAIL_BY_DEFAULT } from '@todz/types';
import type { OwnerRecord } from './owner-records';

const OWNER_COLUMNS = 'id, time_zone, agent_nudge, day_email, day_email_minutes';

type IdentityRow = { owner_id: string };
type OwnerRow = { id: string; time_zone: string; agent_nudge: number; day_email: number; day_email_minutes: number };

export async function findIdentityOwner({
  directory,
  provider,
  subject,
}: {
  directory: D1Database;
  provider: string;
  subject: string;
}): Promise<string | null> {
  const row = await directory
    .prepare('SELECT owner_id FROM owner_identities WHERE provider = ? AND subject = ?')
    .bind(provider, subject)
    .first<IdentityRow>();
  if (row === null) return null;
  return row.owner_id;
}

export async function insertOwnerWithIdentity({
  directory,
  ownerId,
  provider,
  subject,
  timeZone,
  now,
}: {
  directory: D1Database;
  ownerId: string;
  provider: string;
  subject: string;
  timeZone: string;
  now: number;
}): Promise<void> {
  await directory.batch([
    directory
      .prepare('INSERT INTO owners (id, time_zone, agent_nudge, day_email, created_at) VALUES (?, ?, ?, ?, ?)')
      .bind(ownerId, timeZone, Number(AGENT_NUDGE_BY_DEFAULT), Number(DAY_EMAIL_BY_DEFAULT), now),
    directory
      .prepare('INSERT INTO owner_identities (provider, subject, owner_id, created_at) VALUES (?, ?, ?, ?)')
      .bind(provider, subject, ownerId, now),
  ]);
}

function flagOf(flag: boolean | null): number | null {
  if (flag === null) return null;
  return Number(flag);
}

function ownerRecordOf(row: OwnerRow): OwnerRecord {
  return {
    id: row.id,
    timeZone: row.time_zone,
    agentNudge: row.agent_nudge === 1,
    dayEmail: row.day_email === 1,
    dayEmailMinutes: row.day_email_minutes,
  };
}

export async function storeOwnerChanges({
  directory,
  ownerId,
  timeZone,
  agentNudge,
  dayEmail,
  dayEmailMinutes,
}: {
  directory: D1Database;
  ownerId: string;
  timeZone: string | null;
  agentNudge: boolean | null;
  dayEmail: boolean | null;
  dayEmailMinutes: number | null;
}): Promise<OwnerRecord | null> {
  const update = directory
    .prepare(
      `UPDATE owners SET time_zone = COALESCE(?, time_zone), agent_nudge = COALESCE(?, agent_nudge), day_email = COALESCE(?, day_email), day_email_minutes = COALESCE(?, day_email_minutes) WHERE id = ? RETURNING ${OWNER_COLUMNS}`,
    )
    .bind(timeZone, flagOf(agentNudge), flagOf(dayEmail), dayEmailMinutes, ownerId);
  const deleteReplyAddresses = directory.prepare('DELETE FROM day_email_reply_addresses WHERE owner_id = ?').bind(ownerId);
  const statements = dayEmail === false ? [update, deleteReplyAddresses] : [update];
  const [updated] = await directory.batch<OwnerRow>(statements);
  if (updated === undefined) throw new Error('a batch answers one result per statement');
  const [row] = updated.results;
  if (row === undefined) return null;
  return ownerRecordOf(row);
}

export async function findOwner({ directory, ownerId }: { directory: D1Database; ownerId: string }): Promise<OwnerRecord | null> {
  const row = await directory.prepare(`SELECT ${OWNER_COLUMNS} FROM owners WHERE id = ?`).bind(ownerId).first<OwnerRow>();
  if (row === null) return null;
  return ownerRecordOf(row);
}

export async function insertOwnerSession({
  directory,
  digest,
  ownerId,
  now,
  expiresAt,
  sessionsPerOwnerMax,
}: {
  directory: D1Database;
  digest: string;
  ownerId: string;
  now: number;
  expiresAt: number;
  sessionsPerOwnerMax: number;
}): Promise<void> {
  await directory.batch([
    directory.prepare('DELETE FROM sessions WHERE owner_id = ? AND expires_at <= ?').bind(ownerId, now),
    directory
      .prepare('INSERT INTO sessions (digest, owner_id, created_at, expires_at) VALUES (?, ?, ?, ?)')
      .bind(digest, ownerId, now, expiresAt),
    directory
      .prepare(
        'DELETE FROM sessions WHERE owner_id = ? AND digest <> ? AND digest NOT IN (SELECT digest FROM sessions WHERE owner_id = ? AND digest <> ? ORDER BY created_at DESC, rowid DESC LIMIT ?)',
      )
      .bind(ownerId, digest, ownerId, digest, sessionsPerOwnerMax - 1),
  ]);
}

export async function deleteOwnerSession({ directory, digest }: { directory: D1Database; digest: string }): Promise<void> {
  await directory.prepare('DELETE FROM sessions WHERE digest = ?').bind(digest).run();
}
