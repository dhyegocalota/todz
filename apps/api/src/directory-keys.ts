import type { KeyRecord } from './owner-records';

type KeyRow = { id: string; hint: string; created_at: number };

export async function listProjectKeys({ directory, projectId }: { directory: D1Database; projectId: string }): Promise<KeyRecord[]> {
  const { results } = await directory
    .prepare('SELECT id, hint, created_at FROM project_keys WHERE project_id = ? AND revoked_at IS NULL ORDER BY created_at, rowid')
    .bind(projectId)
    .all<KeyRow>();
  return results.map((row) => ({ id: row.id, hint: row.hint, createdAt: row.created_at }));
}

export async function revokeProjectKey({
  directory,
  keyId,
  projectId,
}: {
  directory: D1Database;
  keyId: string;
  projectId: string;
}): Promise<boolean> {
  const [, revocation] = await directory.batch([
    directory
      .prepare(
        'DELETE FROM mcp_sessions WHERE key_digest IN (SELECT digest FROM project_keys WHERE id = ? AND project_id = ? AND revoked_at IS NULL)',
      )
      .bind(keyId, projectId),
    directory.prepare('DELETE FROM project_keys WHERE id = ? AND project_id = ? AND revoked_at IS NULL').bind(keyId, projectId),
  ]);
  if (revocation === undefined) throw new Error('the batch answers one result per statement');
  return revocation.meta.changes > 0;
}
