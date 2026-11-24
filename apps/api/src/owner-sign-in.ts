import { z } from 'zod';
import { findIdentityOwner, insertOwnerWithIdentity, updateOwnerTimeZone } from './directory-owners';
import { HttpStatus } from './http-status';
import { OwnerErrorCode, errorResponse } from './owner-errors';
import { ownerJson } from './owner-json';
import { type OwnerContext, parsedPublicBody } from './owner-request';
import { openOwnerSession } from './owner-sessions';
import { SIGN_IN_PROVIDER_OF_KIND, type SignInProviderKind, signInKindOf } from './sign-in-provider';
import { canonicalTimeZone } from './time-zone';

const LINK_VERIFIER_PATTERN = /^[A-Za-z0-9_-]{43}$/;

const SignInBodySchema = z.object({ identity_token: z.string(), link_verifier: z.string().optional(), time_zone: z.string() });

type OwnerIdentity = { directory: D1Database; kind: SignInProviderKind; subject: string };

async function retimedOwnerId({
  directory,
  ownerId,
  timeZone,
}: {
  directory: D1Database;
  ownerId: string;
  timeZone: string;
}): Promise<string> {
  await updateOwnerTimeZone({ directory, ownerId, timeZone });
  return ownerId;
}

async function identityOwnerId({
  directory,
  kind,
  subject,
  timeZone,
  now,
}: OwnerIdentity & { timeZone: string; now: number }): Promise<string> {
  const knownOwnerId = await findIdentityOwner({ directory, provider: kind, subject });
  if (knownOwnerId !== null) return retimedOwnerId({ directory, ownerId: knownOwnerId, timeZone });
  const ownerId = crypto.randomUUID();
  try {
    await insertOwnerWithIdentity({ directory, ownerId, provider: kind, subject, timeZone, now });
    return ownerId;
  } catch (failure) {
    const rivalOwnerId = await findIdentityOwner({ directory, provider: kind, subject });
    if (rivalOwnerId === null) throw failure;
    return retimedOwnerId({ directory, ownerId: rivalOwnerId, timeZone });
  }
}

export async function signIn({ request, env, now }: OwnerContext): Promise<Response> {
  const kind = signInKindOf(env.SIGN_IN_PROVIDER);
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
  const ownerId = await identityOwnerId({ directory: env.DIRECTORY, kind, subject, timeZone, now });
  const sessionToken = await openOwnerSession({ directory: env.DIRECTORY, ownerId, now });
  return Response.json({ session_token: sessionToken, owner: ownerJson({ id: ownerId, timeZone }) }, { status: HttpStatus.Created });
}
