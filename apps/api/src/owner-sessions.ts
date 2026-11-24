import { MILLISECONDS_PER_DAY } from '@todz/types';
import { digestCredential } from './credential-digest';
import { generateCredentialSecret } from './credential-secret';
import { deleteOwnerSession, insertOwnerSession } from './directory-owners';

const OWNER_SESSION_LIFETIME_DAYS = 90;
const OWNER_SESSION_LIFETIME_MS = OWNER_SESSION_LIFETIME_DAYS * MILLISECONDS_PER_DAY;
export const OWNER_SESSIONS_PER_OWNER_MAX = 20;

// NB ADR 0021: a session lasts 90 days from sign-in and an owner keeps at most 20.
export async function openOwnerSession({
  directory,
  ownerId,
  now,
}: {
  directory: D1Database;
  ownerId: string;
  now: number;
}): Promise<string> {
  const secret = generateCredentialSecret();
  await insertOwnerSession({
    directory,
    digest: await digestCredential(secret),
    ownerId,
    now,
    expiresAt: now + OWNER_SESSION_LIFETIME_MS,
    sessionsPerOwnerMax: OWNER_SESSIONS_PER_OWNER_MAX,
  });
  return secret;
}

export async function closeOwnerSession({ directory, secret }: { directory: D1Database; secret: string }): Promise<void> {
  await deleteOwnerSession({ directory, digest: await digestCredential(secret) });
}
