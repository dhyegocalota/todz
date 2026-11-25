import { z } from 'zod';
import { findOwner, storeOwnerChanges } from './directory-owners';
import { HttpStatus } from './http-status';
import { OwnerErrorCode, errorResponse } from './owner-errors';
import { ownerJson } from './owner-json';
import { type SessionContext, type SessionHandler, parsedBody } from './owner-request';
import { OwnerRoute } from './owner-routes';
import { closeOwnerSession } from './owner-sessions';
import { closeSessionSockets } from './project-routing';
import { canonicalTimeZone } from './time-zone';

const UpdateOwnerBodySchema = z
  .object({ time_zone: z.string().optional(), agent_nudge: z.boolean().optional() })
  .refine((body) => body.time_zone !== undefined || body.agent_nudge !== undefined);

type AccountRoute = OwnerRoute.SignOut | OwnerRoute.ReadOwner | OwnerRoute.UpdateOwner;

async function signOut({ env, secret, owner, executionContext }: SessionContext): Promise<Response> {
  await closeOwnerSession({ directory: env.DIRECTORY, secret });
  executionContext.waitUntil(closeSessionSockets({ env, owner, secret }));
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
  const timeZone = body.time_zone === undefined ? null : canonicalTimeZone(body.time_zone);
  const isInvalidTimeZone = body.time_zone !== undefined && timeZone === null;
  if (isInvalidTimeZone) return errorResponse(OwnerErrorCode.TimeZoneInvalid);
  const agentNudge = body.agent_nudge === undefined ? null : body.agent_nudge;
  const ownerRecord = await storeOwnerChanges({ directory: env.DIRECTORY, ownerId: owner.ownerId, timeZone, agentNudge });
  if (ownerRecord === null) throw new Error('a live session names an owner with no row');
  return Response.json({ owner: ownerJson(ownerRecord) });
}

export const ACCOUNT_HANDLERS: Record<AccountRoute, SessionHandler> = {
  [OwnerRoute.SignOut]: signOut,
  [OwnerRoute.ReadOwner]: readOwner,
  [OwnerRoute.UpdateOwner]: updateOwner,
};
