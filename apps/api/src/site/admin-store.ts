type AdminLinkInsertion = {
  database: D1Database;
  digest: string;
  codeDigest: string;
  codeSalt: string;
  email: string;
  challenge: string;
  now: number;
  expiresAt: number;
  windowStart: number;
  linksPerWindowMax: number;
};

type AdminLinkSpending = { database: D1Database; digest: string; challenge: string; email: string; now: number };

type AdminSessionOpening = { database: D1Database; digest: string; email: string; now: number; expiresAt: number };

export async function insertAdminLinkWithinLimit({
  database,
  digest,
  codeDigest,
  codeSalt,
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
      'INSERT INTO admin_sign_in_links (digest, email, challenge, created_at, expires_at, code_digest, code_salt) SELECT ?, ?, ?, ?, ?, ?, ? WHERE (SELECT count(*) FROM admin_sign_in_links WHERE email = ? AND created_at > ?) < ?',
    )
    .bind(digest, email, challenge, now, expiresAt, codeDigest, codeSalt, email, windowStart, linksPerWindowMax)
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
