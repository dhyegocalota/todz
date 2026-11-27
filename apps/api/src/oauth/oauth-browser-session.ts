import { MILLISECONDS_PER_SECOND } from '@todz/types';
import { digestCredential } from '../credential-digest';
import { generateCredentialSecret } from '../credential-secret';
import type { Env } from '../env';
import { cookieHeaderOf, cookieValueOf } from '../request-cookie';
import { SIGN_IN_LINK_LIFETIME_MS } from '../sign-in-links';
import { OAUTH_SESSION_LIFETIME_MS } from './oauth-paths';
import { findOAuthSessionOwner, insertOAuthSession } from './oauth-store';

const COOKIE_ATTRIBUTES = 'Path=/oauth; Secure; HttpOnly; SameSite=Lax';

export enum OAuthCookie {
  Challenge = '__Secure-todz_oauth_challenge',
  Session = '__Secure-todz_oauth',
}

const LIFETIME_MS_OF_COOKIE: Record<OAuthCookie, number> = {
  [OAuthCookie.Challenge]: SIGN_IN_LINK_LIFETIME_MS,
  [OAuthCookie.Session]: OAUTH_SESSION_LIFETIME_MS,
};

export type OAuthBrowserSession = { ownerId: string; secret: string };

// NB ADR 0109: the browser session is a host-only cookie for /oauth alone, never an owner API session.
export function oauthCookieHeaderOf({ cookie, value }: { cookie: OAuthCookie; value: string }): string {
  const maxAgeSeconds = LIFETIME_MS_OF_COOKIE[cookie] / MILLISECONDS_PER_SECOND;
  return cookieHeaderOf({ name: cookie, value, attributes: COOKIE_ATTRIBUTES, maxAgeSeconds });
}

export function clearedOAuthCookieHeaderOf(cookie: OAuthCookie): string {
  return cookieHeaderOf({ name: cookie, value: '', attributes: COOKIE_ATTRIBUTES, maxAgeSeconds: 0 });
}

export function oauthCookieValueOf({ request, cookie }: { request: Request; cookie: OAuthCookie }): string | null {
  return cookieValueOf({ request, name: cookie });
}

export async function openOAuthSession({
  directory,
  ownerId,
  now,
}: {
  directory: D1Database;
  ownerId: string;
  now: number;
}): Promise<string> {
  const secret = generateCredentialSecret();
  await insertOAuthSession({ directory, digest: await digestCredential(secret), ownerId, now, expiresAt: now + OAUTH_SESSION_LIFETIME_MS });
  return secret;
}

export async function oauthSessionOf({
  request,
  env,
  now,
}: {
  request: Request;
  env: Env;
  now: number;
}): Promise<OAuthBrowserSession | null> {
  const secret = oauthCookieValueOf({ request, cookie: OAuthCookie.Session });
  if (secret === null) return null;
  const ownerId = await findOAuthSessionOwner({ directory: env.DIRECTORY, digest: await digestCredential(secret), now });
  if (ownerId === null) return null;
  return { ownerId, secret };
}
