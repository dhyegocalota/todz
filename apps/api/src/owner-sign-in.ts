import { z } from 'zod';
import { findIdentityOwner, insertOwnerWithIdentity, updateOwnerTimeZone } from './directory-owners';
import { HttpStatus } from './http-status';
import { OwnerErrorCode, errorResponse } from './owner-errors';
import { ownerJson } from './owner-json';
import { type OwnerContext, parsedBody } from './owner-request';
import { openOwnerSession } from './owner-sessions';
import { SIGN_IN_PROVIDER_OF_KIND, type SignInProviderKind, signInKindOf } from './sign-in-provider';
import { canonicalTimeZone } from './time-zone';

const SignInBodySchema = z.object({ identity_token: z.string(), time_zone: z.string() });

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
  const body = await parsedBody({ request, schema: SignInBodySchema });
  if (body === null) return errorResponse(OwnerErrorCode.InvalidRequest);
  const subject = await SIGN_IN_PROVIDER_OF_KIND[kind].verify(body.identity_token);
  if (subject === null) return errorResponse(OwnerErrorCode.IdentityRejected);
  const timeZone = canonicalTimeZone(body.time_zone);
  if (timeZone === null) return errorResponse(OwnerErrorCode.TimeZoneInvalid);
  const ownerId = await identityOwnerId({ directory: env.DIRECTORY, kind, subject, timeZone, now });
  const sessionToken = await openOwnerSession({ directory: env.DIRECTORY, ownerId, now });
  return Response.json({ session_token: sessionToken, owner: ownerJson({ id: ownerId, timeZone }) }, { status: HttpStatus.Created });
}
