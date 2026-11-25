import { z } from 'zod';
import { findOwner, updateOwnerTimeZone } from './directory-owners';
import { HttpStatus } from './http-status';
import { OwnerErrorCode, errorResponse } from './owner-errors';
import { ownerJson } from './owner-json';
import { type SessionContext, type SessionHandler, parsedBody } from './owner-request';
import { OwnerRoute } from './owner-routes';
import { closeOwnerSession } from './owner-sessions';
import { canonicalTimeZone } from './time-zone';

const UpdateOwnerBodySchema = z.object({ time_zone: z.string() });

type AccountRoute = OwnerRoute.SignOut | OwnerRoute.ReadOwner | OwnerRoute.UpdateOwner;

async function signOut({ env, secret }: SessionContext): Promise<Response> {
  await closeOwnerSession({ directory: env.DIRECTORY, secret });
  return new Response(null, { status: HttpStatus.NoContent });
}

async function readOwner({ env, owner }: SessionContext): Promise<Response> {
  const ownerRecord = await findOwner({ directory: env.DIRECTORY, ownerId: owner.ownerId });
  if (ownerRecord === null) throw new Error('a live session names an owner with no row');
  return Response.json({ owner: ownerJson(ownerRecord) });
}

async function updateOwner({ request, env, owner }: SessionContext): Promise<Response> {
  const body = await parsedBody({ request, schema: UpdateOwnerBodySchema });
  if (body === null) return errorResponse(OwnerErrorCode.InvalidRequest);
  const timeZone = canonicalTimeZone(body.time_zone);
  if (timeZone === null) return errorResponse(OwnerErrorCode.TimeZoneInvalid);
  await updateOwnerTimeZone({ directory: env.DIRECTORY, ownerId: owner.ownerId, timeZone });
  return Response.json({ owner: ownerJson({ id: owner.ownerId, timeZone, agentNudge: false }) });
}

export const ACCOUNT_HANDLERS: Record<AccountRoute, SessionHandler> = {
  [OwnerRoute.SignOut]: signOut,
  [OwnerRoute.ReadOwner]: readOwner,
  [OwnerRoute.UpdateOwner]: updateOwner,
};
