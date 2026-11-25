import { MILLISECONDS_PER_DAY } from '@todz/types';
import { type EmailSender, emailSenderOf } from '../email-sender';
import { waitlistDigestMail } from '../emails/waitlist-digest-mail';
import type { Env } from '../env';
import { publicOriginOf } from '../sign-in-links';
import { adminEmailOf } from './admin-session';
import { waitlistDigestFacts } from './admin-store';

export enum DigestMissingPiece {
  AdminEmail = 'admin_email',
  SiteOrigin = 'site_origin',
  EmailSender = 'email_sender',
}

type DigestRun = { scheduledTime: number; env: Env };

function emailSenderForDigest({ env, siteOrigin }: { env: Env; siteOrigin: string | null }): EmailSender | null {
  if (siteOrigin === null) return null;
  return emailSenderOf({ configured: env.EMAIL_SENDER, publicOrigin: siteOrigin, requestUrl: siteOrigin, binding: env.EMAIL });
}

export async function runWaitlistDigest({ scheduledTime, env }: DigestRun): Promise<void> {
  const recipient = adminEmailOf(env);
  const siteOrigin = publicOriginOf(env.SITE_ORIGIN);
  const sender = emailSenderForDigest({ env, siteOrigin });
  const isPresent: Record<DigestMissingPiece, boolean> = {
    [DigestMissingPiece.AdminEmail]: recipient !== null,
    [DigestMissingPiece.SiteOrigin]: siteOrigin !== null,
    [DigestMissingPiece.EmailSender]: sender !== null,
  };
  const isUnready = recipient === null || siteOrigin === null || sender === null;
  if (isUnready) {
    const missingPieces = Object.values(DigestMissingPiece).filter((piece) => !isPresent[piece]);
    throw new Error(`the waitlist digest is missing ${missingPieces.join(', ')}`);
  }
  const facts = await waitlistDigestFacts({ database: env.DIRECTORY, since: scheduledTime - MILLISECONDS_PER_DAY, until: scheduledTime });
  await sender.send(waitlistDigestMail({ to: recipient, facts, origin: siteOrigin }));
}
