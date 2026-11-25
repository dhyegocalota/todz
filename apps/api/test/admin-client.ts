import { env } from 'cloudflare:workers';
import { recordingLimiter } from './email-sign-in-client';

export enum AdminLimiterBinding {
  Client = 'ADMIN_LIMITER',
  Address = 'ADMIN_ADDRESS_LIMITER',
  Global = 'ADMIN_GLOBAL_LIMITER',
}

export type AdminLimiters = Partial<Record<AdminLimiterBinding, RateLimit | undefined>>;

export type RecordedAdminLimiters = { limiters: AdminLimiters; keys: Record<AdminLimiterBinding, string[]> };

export function recordedAdminLimiters({ refusing = [] }: { refusing?: AdminLimiterBinding[] } = {}): RecordedAdminLimiters {
  const recorded = Object.values(AdminLimiterBinding).map((binding) => ({
    binding,
    ...recordingLimiter({ isAllowed: !refusing.includes(binding) }),
  }));
  return {
    limiters: Object.fromEntries(recorded.map(({ binding, limiter }) => [binding, limiter])),
    keys: Object.fromEntries(recorded.map(({ binding, keys }) => [binding, keys])) as Record<AdminLimiterBinding, string[]>,
  };
}

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
