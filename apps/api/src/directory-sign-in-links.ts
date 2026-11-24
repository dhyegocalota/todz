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

export async function deleteSignInLink({ directory, digest }: { directory: D1Database; digest: string }): Promise<void> {
  await directory.prepare('DELETE FROM sign_in_links WHERE digest = ?').bind(digest).run();
}
