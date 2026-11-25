import type { OwnerRecord } from './owner-records';

type IdentityRow = { owner_id: string };
type OwnerRow = { id: string; time_zone: string };

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
    directory.prepare('INSERT INTO owners (id, time_zone, created_at) VALUES (?, ?, ?)').bind(ownerId, timeZone, now),
    directory
      .prepare('INSERT INTO owner_identities (provider, subject, owner_id, created_at) VALUES (?, ?, ?, ?)')
      .bind(provider, subject, ownerId, now),
  ]);
}

export async function updateOwnerTimeZone({
  directory,
  ownerId,
  timeZone,
}: {
  directory: D1Database;
  ownerId: string;
  timeZone: string;
}): Promise<void> {
  await directory.prepare('UPDATE owners SET time_zone = ? WHERE id = ?').bind(timeZone, ownerId).run();
}

export async function findOwner({ directory, ownerId }: { directory: D1Database; ownerId: string }): Promise<OwnerRecord | null> {
  const row = await directory.prepare('SELECT id, time_zone FROM owners WHERE id = ?').bind(ownerId).first<OwnerRow>();
  if (row === null) return null;
  return { id: row.id, timeZone: row.time_zone, agentNudge: false };
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
