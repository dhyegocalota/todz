import { DAY_EMAIL_STOP_LINK_LIFETIME_MS } from '@todz/types';
import { digestCredential } from '../credential-digest';
import { generateStopSecret } from '../credential-secret';
import { insertStopLink } from './day-email-store';

export async function issueStopLink({ directory, ownerId, now }: { directory: D1Database; ownerId: string; now: number }): Promise<string> {
  const secret = generateStopSecret();
  const digest = await digestCredential(secret);
  await insertStopLink({ directory, digest, ownerId, now, expiresAt: now + DAY_EMAIL_STOP_LINK_LIFETIME_MS });
  return secret;
}
