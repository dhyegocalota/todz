import { z } from 'zod';
import { findIdentityOwner, insertOwnerWithIdentity, updateOwnerTimeZone } from './directory-owners';
import { emailSenderOf } from './email-sender';
import { welcomeMail } from './emails/welcome-mail';
import type { Env } from './env';
import { HttpStatus } from './http-status';
import { OwnerErrorCode, errorResponse } from './owner-errors';
import { ownerJson } from './owner-json';
import { type OwnerContext, parsedPublicBody } from './owner-request';
import { openOwnerSession } from './owner-sessions';
import { publicOriginOf } from './sign-in-links';
import { SIGN_IN_PROVIDER_OF_KIND, SignInProviderKind, signInKindForRequest } from './sign-in-provider';
import { canonicalTimeZone } from './time-zone';

const LINK_VERIFIER_PATTERN = /^[A-Za-z0-9_-]{43}$/;

const SignInBodySchema = z.object({ identity_token: z.string(), link_verifier: z.string().optional(), time_zone: z.string() });

type OwnerIdentity = { directory: D1Database; kind: SignInProviderKind; subject: string };

type IdentityOwner = { ownerId: string; isNewOwner: boolean };

async function retimedOwner({
  directory,
  ownerId,
  timeZone,
}: {
  directory: D1Database;
  ownerId: string;
  timeZone: string;
}): Promise<IdentityOwner> {
  await updateOwnerTimeZone({ directory, ownerId, timeZone });
  return { ownerId, isNewOwner: false };
}

async function identityOwner({
  directory,
  kind,
  subject,
  timeZone,
  now,
}: OwnerIdentity & { timeZone: string; now: number }): Promise<IdentityOwner> {
  const knownOwnerId = await findIdentityOwner({ directory, provider: kind, subject });
  if (knownOwnerId !== null) return retimedOwner({ directory, ownerId: knownOwnerId, timeZone });
  const ownerId = crypto.randomUUID();
  try {
    await insertOwnerWithIdentity({ directory, ownerId, provider: kind, subject, timeZone, now });
    return { ownerId, isNewOwner: true };
  } catch (failure) {
    const rivalOwnerId = await findIdentityOwner({ directory, provider: kind, subject });
    if (rivalOwnerId === null) throw failure;
    return retimedOwner({ directory, ownerId: rivalOwnerId, timeZone });
  }
}

async function sendWelcome({ request, env, address }: { request: Request; env: Env; address: string }): Promise<void> {
  const publicOrigin = publicOriginOf(env.PUBLIC_ORIGIN);
  if (publicOrigin === null) return;
  const sender = emailSenderOf({ configured: env.EMAIL_SENDER, publicOrigin, requestUrl: request.url, binding: env.EMAIL });
  if (sender === null) return;
  await sender.send(welcomeMail({ to: address, origin: publicOrigin }));
}

export async function signIn({ request, env, now, executionContext }: OwnerContext): Promise<Response> {
  const kind = signInKindForRequest({ env, request });
  if (kind === null) return errorResponse(OwnerErrorCode.SignInUnavailable);
  const body = await parsedPublicBody({ request, schema: SignInBodySchema });
  if (body === null) return errorResponse(OwnerErrorCode.InvalidRequest);
  const timeZone = canonicalTimeZone(body.time_zone);
  if (timeZone === null) return errorResponse(OwnerErrorCode.TimeZoneInvalid);
  const isMalformedVerifier = body.link_verifier !== undefined && !LINK_VERIFIER_PATTERN.test(body.link_verifier);
  if (isMalformedVerifier) return errorResponse(OwnerErrorCode.IdentityRejected);
  const subject = await SIGN_IN_PROVIDER_OF_KIND[kind].verify({
    identityToken: body.identity_token,
    linkVerifier: body.link_verifier,
    directory: env.DIRECTORY,
    now,
  });
  if (subject === null) return errorResponse(OwnerErrorCode.IdentityRejected);
  const { ownerId, isNewOwner } = await identityOwner({ directory: env.DIRECTORY, kind, subject, timeZone, now });
  const sessionToken = await openOwnerSession({ directory: env.DIRECTORY, ownerId, now });
  const isWelcomedOwner = isNewOwner && kind === SignInProviderKind.Email;
  if (isWelcomedOwner) executionContext.waitUntil(sendWelcome({ request, env, address: subject }).catch(() => undefined));
  return Response.json({ session_token: sessionToken, owner: ownerJson({ id: ownerId, timeZone }) }, { status: HttpStatus.Created });
}
