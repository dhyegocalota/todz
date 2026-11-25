import { env } from 'cloudflare:workers';

export type AdminLinkRow = {
  digest: string;
  email: string;
  challenge: string;
  created_at: number;
  expires_at: number;
  consumed_at: number | null;
};

export type AdminSessionRow = { digest: string; email: string; created_at: number; expires_at: number };

export async function adminLinkRows(email: string): Promise<AdminLinkRow[]> {
  const { results } = await env.DIRECTORY.prepare(
    'SELECT digest, email, challenge, created_at, expires_at, consumed_at FROM admin_sign_in_links WHERE email = ? ORDER BY created_at, rowid',
  )
    .bind(email)
    .all<AdminLinkRow>();
  return results;
}

export async function adminSessionRows(): Promise<AdminSessionRow[]> {
  const { results } = await env.DIRECTORY.prepare(
    'SELECT digest, email, created_at, expires_at FROM admin_sessions ORDER BY created_at, rowid',
  ).all<AdminSessionRow>();
  return results;
}
