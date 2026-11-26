import { DAY_EMAIL_MINUTES_MAX } from '@todz/types';
import { z } from 'zod';
import { HttpStatus } from './http-status';
import { failedResponse } from './owner-action-response';
import { OwnerErrorCode, errorResponse } from './owner-errors';
import { ownerJson } from './owner-json';
import { type SessionContext, type SessionHandler, parsedBody } from './owner-request';
import { OwnerRoute } from './owner-routes';
import { closeOwnerSession } from './owner-sessions';
import { readSettings, updateSettings } from './owner-settings-actions';
import { closeSessionSockets } from './project-routing';

const UpdateOwnerBodySchema = z
  .object({
    time_zone: z.string().optional(),
    agent_nudge: z.boolean().optional(),
    day_email: z.boolean().optional(),
    day_email_minutes: z.number().int().min(0).max(DAY_EMAIL_MINUTES_MAX).optional(),
  })
  .refine((body) => Object.values(body).some((field) => field !== undefined));

type AccountRoute = OwnerRoute.SignOut | OwnerRoute.ReadOwner | OwnerRoute.UpdateOwner;

async function signOut({ env, secret, owner, executionContext }: SessionContext): Promise<Response> {
  await closeOwnerSession({ directory: env.DIRECTORY, secret });
  executionContext.waitUntil(closeSessionSockets({ env, owner, secret }));
  return new Response(null, { status: HttpStatus.NoContent });
}

async function readOwner({ env, owner }: SessionContext): Promise<Response> {
  return Response.json({ owner: ownerJson(await readSettings({ env, owner })) });
}

async function updateOwner({ request, env, owner, now }: SessionContext): Promise<Response> {
  const body = await parsedBody({ request, schema: UpdateOwnerBodySchema });
  if (body === null) return errorResponse(OwnerErrorCode.InvalidRequest);
  const input = {
    timeZone: body.time_zone,
    agentNudge: body.agent_nudge,
    dayEmail: body.day_email,
    dayEmailMinutes: body.day_email_minutes,
  };
  const result = await updateSettings({ env, owner, now, input });
  if (!result.ok) return failedResponse(result.failure);
  return Response.json({ owner: ownerJson(result.value) });
}

export const ACCOUNT_HANDLERS: Record<AccountRoute, SessionHandler> = {
  [OwnerRoute.SignOut]: signOut,
  [OwnerRoute.ReadOwner]: readOwner,
  [OwnerRoute.UpdateOwner]: updateOwner,
};
