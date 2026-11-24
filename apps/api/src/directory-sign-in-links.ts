export async function insertSignInLinkWithinLimit({
  directory,
  digest,
  email,
  challenge,
  now,
  expiresAt,
  windowStart,
  linksPerWindowMax,
}: {
  directory: D1Database;
  digest: string;
  email: string;
  challenge: string;
  now: number;
  expiresAt: number;
  windowStart: number;
  linksPerWindowMax: number;
}): Promise<boolean> {
  await directory.prepare('DELETE FROM sign_in_links WHERE expires_at <= ?').bind(now).run();
  const insertion = await directory
    .prepare(
      'INSERT INTO sign_in_links (digest, email, challenge, created_at, expires_at) SELECT ?, ?, ?, ?, ? WHERE (SELECT count(*) FROM sign_in_links WHERE email = ? AND created_at > ?) < ?',
    )
    .bind(digest, email, challenge, now, expiresAt, email, windowStart, linksPerWindowMax)
    .run();
  return insertion.meta.changes > 0;
}

export async function spendSignInLink({
  directory,
  digest,
  challenge,
  now,
}: {
  directory: D1Database;
  digest: string;
  challenge: string;
  now: number;
}): Promise<string | null> {
  const row = await directory
    .prepare(
      'UPDATE sign_in_links SET consumed_at = ? WHERE digest = ? AND consumed_at IS NULL AND expires_at > ? AND challenge = ? RETURNING email',
    )
    .bind(now, digest, now, challenge)
    .first<{ email: string }>();
  if (row === null) return null;
  return row.email;
}

export async function deleteSignInLink({ directory, digest }: { directory: D1Database; digest: string }): Promise<void> {
  await directory.prepare('DELETE FROM sign_in_links WHERE digest = ?').bind(digest).run();
}
