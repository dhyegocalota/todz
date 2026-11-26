import type { KeyRecord } from './owner-records';

type KeyRow = { id: string; hint: string; created_at: number };
type OwnerKeyRow = { owner_id: string };

export async function insertOwnerKey({
  directory,
  digest,
  id,
  hint,
  ownerId,
  now,
  liveKeysPerOwnerMax,
}: {
  directory: D1Database;
  digest: string;
  id: string;
  hint: string;
  ownerId: string;
  now: number;
  liveKeysPerOwnerMax: number;
}): Promise<boolean> {
  const insertion = await directory
    .prepare(
      'INSERT INTO owner_keys (digest, id, hint, owner_id, created_at, revoked_at) SELECT ?, ?, ?, ?, ?, NULL WHERE (SELECT count(*) FROM owner_keys WHERE owner_id = ? AND revoked_at IS NULL) < ?',
    )
    .bind(digest, id, hint, ownerId, now, ownerId, liveKeysPerOwnerMax)
    .run();
  return insertion.meta.changes > 0;
}

export async function listOwnerKeys({ directory, ownerId }: { directory: D1Database; ownerId: string }): Promise<KeyRecord[]> {
  const { results } = await directory
    .prepare('SELECT id, hint, created_at FROM owner_keys WHERE owner_id = ? AND revoked_at IS NULL ORDER BY created_at, rowid')
    .bind(ownerId)
    .all<KeyRow>();
  return results.map((row) => ({ id: row.id, hint: row.hint, createdAt: row.created_at }));
}

export async function revokeOwnerKey({
  directory,
  keyId,
  ownerId,
}: {
  directory: D1Database;
  keyId: string;
  ownerId: string;
}): Promise<boolean> {
  const revocation = await directory
    .prepare('DELETE FROM owner_keys WHERE id = ? AND owner_id = ? AND revoked_at IS NULL')
    .bind(keyId, ownerId)
    .run();
  return revocation.meta.changes > 0;
}

export async function findKeyOwner({ directory, digest }: { directory: D1Database; digest: string }): Promise<string | null> {
  const row = await directory
    .prepare(
      'SELECT owner_keys.owner_id FROM owner_keys JOIN owners ON owners.id = owner_keys.owner_id WHERE owner_keys.digest = ? AND owner_keys.revoked_at IS NULL',
    )
    .bind(digest)
    .first<OwnerKeyRow>();
  if (row === null) return null;
  return row.owner_id;
}
