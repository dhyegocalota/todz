import { MILLISECONDS_PER_MINUTE } from '@todz/types';
import { z } from 'zod';
import { digestCredential } from './credential-digest';
import { generateCredentialSecret } from './credential-secret';
import { deleteSignInLink, insertSignInLinkWithinLimit } from './directory-sign-in-links';
import { emailSenderOf } from './email-sender';
import { HttpStatus } from './http-status';
import { OwnerErrorCode, errorResponse } from './owner-errors';
import { type OwnerContext, parsedPublicBody } from './owner-request';
import { SIGN_IN_MAIL_SUBJECT, signInMailText } from './sign-in-mail-copy';
import { SIGN_IN_PAGE_PATH } from './sign-in-page';
import { SignInProviderKind, signInKindOf } from './sign-in-provider';

const SIGN_IN_LINK_LIFETIME_MINUTES = 15;
const SIGN_IN_LINK_LIFETIME_MS = SIGN_IN_LINK_LIFETIME_MINUTES * MILLISECONDS_PER_MINUTE;
const SIGN_IN_LINKS_PER_ADDRESS_MAX = 5;
const ADDRESS_LENGTH_MAX = 254;
const ADDRESS_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LINK_CHALLENGE_PATTERN = /^[0-9a-f]{64}$/;

const RequestBodySchema = z.object({ email: z.string(), link_challenge: z.string() });

function publicOriginOf(configured: string | undefined): string | null {
  if (configured === undefined) return null;
  if (!URL.canParse(configured)) return null;
  if (new URL(configured).origin !== configured) return null;
  return configured;
}

function normalizedAddress(email: string): string | null {
  const address = email.trim().toLowerCase();
  const isAddress = address.length <= ADDRESS_LENGTH_MAX && ADDRESS_PATTERN.test(address);
  if (!isAddress) return null;
  return address;
}

// NB ADR 0040: a link lasts 15 minutes, an address gets five in that window, and one statement counts and inserts.
export async function requestSignInLink({ request, env, now }: OwnerContext): Promise<Response> {
  const publicOrigin = publicOriginOf(env.PUBLIC_ORIGIN);
  const isEmailProvider = signInKindOf(env.SIGN_IN_PROVIDER) === SignInProviderKind.Email;
  const isLinkUnsendable = !isEmailProvider || publicOrigin === null;
  if (isLinkUnsendable) return errorResponse(OwnerErrorCode.SignInUnavailable);
  const sender = emailSenderOf({ configured: env.EMAIL_SENDER, publicOrigin });
  if (sender === null) return errorResponse(OwnerErrorCode.SignInUnavailable);
  const body = await parsedPublicBody({ request, schema: RequestBodySchema });
  if (body === null) return errorResponse(OwnerErrorCode.InvalidRequest);
  const address = normalizedAddress(body.email);
  const isMalformedAsk = address === null || !LINK_CHALLENGE_PATTERN.test(body.link_challenge);
  if (isMalformedAsk) return errorResponse(OwnerErrorCode.InvalidRequest);
  const token = generateCredentialSecret();
  const digest = await digestCredential(token);
  const isWithinLimit = await insertSignInLinkWithinLimit({
    directory: env.DIRECTORY,
    digest,
    email: address,
    challenge: body.link_challenge,
    now,
    expiresAt: now + SIGN_IN_LINK_LIFETIME_MS,
    windowStart: now - SIGN_IN_LINK_LIFETIME_MS,
    linksPerWindowMax: SIGN_IN_LINKS_PER_ADDRESS_MAX,
  });
  if (!isWithinLimit) return errorResponse(OwnerErrorCode.TooManyLinks);
  try {
    await sender.send({
      to: address,
      subject: SIGN_IN_MAIL_SUBJECT,
      text: signInMailText(`${publicOrigin}${SIGN_IN_PAGE_PATH}#token=${token}`),
    });
  } catch {
    await deleteSignInLink({ directory: env.DIRECTORY, digest });
    return errorResponse(OwnerErrorCode.SignInUnavailable);
  }
  return Response.json({}, { status: HttpStatus.Accepted });
}
