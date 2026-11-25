import { DAY_EMAIL_REPLY_ADDRESS_LIFETIME_MS } from '@todz/types';
import { digestCredential } from '../credential-digest';
import { generateReplySecret } from '../credential-secret';
import { insertReplyAddress } from './day-email-store';
import { replyAddressOf } from './reply-recipient';

export async function issueReplyAddress({
  directory,
  ownerId,
  now,
}: {
  directory: D1Database;
  ownerId: string;
  now: number;
}): Promise<string> {
  const secret = generateReplySecret();
  const digest = await digestCredential(secret);
  await insertReplyAddress({ directory, digest, ownerId, now, expiresAt: now + DAY_EMAIL_REPLY_ADDRESS_LIFETIME_MS });
  return replyAddressOf(secret);
}
