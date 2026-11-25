import { MILLISECONDS_PER_HOUR, MILLISECONDS_PER_MINUTE, MILLISECONDS_PER_SECOND } from '@todz/types';
import { digestCredential } from '../credential-digest';
import { normalizedAddress } from '../email-address';
import type { Env } from '../env';
import { HttpHeader } from '../http-header';
import { publicOriginOf } from '../sign-in-links';
import { ADMIN_SESSION_LIFETIME_HOURS, ADMIN_SIGN_IN_LINK_LIFETIME_MINUTES } from './admin-paths';
import { adminSessionEmail } from './admin-store';

export const ADMIN_SIGN_IN_LINK_LIFETIME_MS = ADMIN_SIGN_IN_LINK_LIFETIME_MINUTES * MILLISECONDS_PER_MINUTE;
export const ADMIN_SESSION_LIFETIME_MS = ADMIN_SESSION_LIFETIME_HOURS * MILLISECONDS_PER_HOUR;

const COOKIE_ATTRIBUTES = 'Path=/; Secure; HttpOnly; SameSite=Lax';
const COOKIE_SEPARATOR = ';';
const COOKIE_VALUE_SEPARATOR = '=';
const SAME_ORIGIN_FETCH_SITE = 'same-origin';

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
  return `${cookie}${COOKIE_VALUE_SEPARATOR}${value}; ${COOKIE_ATTRIBUTES}; Max-Age=${maxAgeSeconds}`;
}

export function clearedAdminCookieHeaderOf({ cookie }: { cookie: AdminCookie }): string {
  return `${cookie}${COOKIE_VALUE_SEPARATOR}; ${COOKIE_ATTRIBUTES}; Max-Age=0`;
}

export function adminCookieValueOf({ request, cookie }: { request: Request; cookie: AdminCookie }): string | null {
  const header = request.headers.get(HttpHeader.Cookie);
  if (header === null) return null;
  const namePrefix = `${cookie}${COOKIE_VALUE_SEPARATOR}`;
  const values = header
    .split(COOKIE_SEPARATOR)
    .map((pair) => pair.trim())
    .filter((pair) => pair.startsWith(namePrefix))
    .map((pair) => pair.slice(namePrefix.length));
  const [value, ...duplicates] = values;
  const isUnique = value !== undefined && duplicates.length === 0;
  if (!isUnique || value === '') return null;
  return value;
}

// NB ADR 0051: a post is same-origin by Sec-Fetch-Site when sent, else by an Origin equal to SITE_ORIGIN, else refused.
export function isSameOriginPost({ request, env }: { request: Request; env: Env }): boolean {
  const siteOrigin = publicOriginOf(env.SITE_ORIGIN);
  if (siteOrigin === null) return false;
  const fetchSite = request.headers.get(HttpHeader.SecFetchSite);
  if (fetchSite !== null) return fetchSite === SAME_ORIGIN_FETCH_SITE;
  return request.headers.get(HttpHeader.Origin) === siteOrigin;
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
