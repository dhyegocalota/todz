import { MILLISECONDS_PER_HOUR, MILLISECONDS_PER_MINUTE, MILLISECONDS_PER_SECOND } from '@todz/types';
import { digestCredential } from '../credential-digest';
import { normalizedAddress } from '../email-address';
import type { Env } from '../env';
import { cookieHeaderOf, cookieValueOf } from '../request-cookie';
import { isSameOriginRequest } from '../same-origin';
import { publicOriginOf } from '../sign-in-links';
import { ADMIN_SESSION_LIFETIME_HOURS, ADMIN_SIGN_IN_LINK_LIFETIME_MINUTES } from './admin-paths';
import { adminSessionEmail } from './admin-store';

export const ADMIN_SIGN_IN_LINK_LIFETIME_MS = ADMIN_SIGN_IN_LINK_LIFETIME_MINUTES * MILLISECONDS_PER_MINUTE;
export const ADMIN_SESSION_LIFETIME_MS = ADMIN_SESSION_LIFETIME_HOURS * MILLISECONDS_PER_HOUR;

const COOKIE_ATTRIBUTES = 'Path=/; Secure; HttpOnly; SameSite=Lax';

export enum AdminCookie {
  Challenge = '__Host-todz_admin_challenge',
  Session = '__Host-todz_admin',
}

const LIFETIME_MS_OF_COOKIE: Record<AdminCookie, number> = {
  [AdminCookie.Challenge]: ADMIN_SIGN_IN_LINK_LIFETIME_MS,
  [AdminCookie.Session]: ADMIN_SESSION_LIFETIME_MS,
};

export function adminCookieHeaderOf({ cookie, value }: { cookie: AdminCookie; value: string }): string {
  const maxAgeSeconds = LIFETIME_MS_OF_COOKIE[cookie] / MILLISECONDS_PER_SECOND;
  return cookieHeaderOf({ name: cookie, value, attributes: COOKIE_ATTRIBUTES, maxAgeSeconds });
}

export function clearedAdminCookieHeaderOf({ cookie }: { cookie: AdminCookie }): string {
  return cookieHeaderOf({ name: cookie, value: '', attributes: COOKIE_ATTRIBUTES, maxAgeSeconds: 0 });
}

export function adminCookieValueOf({ request, cookie }: { request: Request; cookie: AdminCookie }): string | null {
  return cookieValueOf({ request, name: cookie });
}

export function isSameOriginPost({ request, env }: { request: Request; env: Env }): boolean {
  const siteOrigin = publicOriginOf(env.SITE_ORIGIN);
  if (siteOrigin === null) return false;
  return isSameOriginRequest({ request, origin: siteOrigin });
}

export function adminEmailOf(env: Env): string | null {
  if (env.ADMIN_EMAIL === undefined) return null;
  return normalizedAddress(env.ADMIN_EMAIL);
}

export async function hasAdminSession({ request, env, now }: { request: Request; env: Env; now: number }): Promise<boolean> {
  const adminEmail = adminEmailOf(env);
  if (adminEmail === null) return false;
  const secret = adminCookieValueOf({ request, cookie: AdminCookie.Session });
  if (secret === null) return false;
  const sessionEmail = await adminSessionEmail({ database: env.DIRECTORY, digest: await digestCredential(secret), now });
  return sessionEmail === adminEmail;
}
