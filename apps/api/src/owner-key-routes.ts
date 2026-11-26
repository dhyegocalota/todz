import { listOwnerKeys, revokeOwnerKey } from './directory-owner-keys';
import { HttpStatus } from './http-status';
import { OwnerErrorCode, errorResponse } from './owner-errors';
import { keyJson } from './owner-json';
import { issueOwnerKey } from './owner-keys-issuance';
import { type SessionContext, type SessionHandler, routeParam } from './owner-request';
import { OwnerRoute, RouteParam } from './owner-routes';
import { refusalOf } from './owner-write-quota';
import { keyHintOf } from './project-keys';

const ONE_WRITE = 1;
const NO_TEXT_BYTES = 0;

type OwnerKeyRoute = OwnerRoute.ListOwnerKeys | OwnerRoute.IssueOwnerKey | OwnerRoute.RevokeOwnerKey;

async function listKeys({ env, owner }: SessionContext): Promise<Response> {
  const keys = await listOwnerKeys({ directory: env.DIRECTORY, ownerId: owner.ownerId });
  return Response.json({ keys: keys.map(keyJson) });
}

async function issueKey(context: SessionContext): Promise<Response> {
  const { env, owner, now } = context;
  const refusal = await refusalOf({ context, writes: ONE_WRITE, bytes: NO_TEXT_BYTES });
  if (refusal !== null) return refusal;
  const issued = await issueOwnerKey({ directory: env.DIRECTORY, ownerId: owner.ownerId, now });
  if (issued === null) return errorResponse(OwnerErrorCode.LimitReached);
  const { id, secret } = issued;
  return Response.json({ key: keyJson({ id, hint: keyHintOf(secret), createdAt: now }), secret }, { status: HttpStatus.Created });
}

async function revokeKey(context: SessionContext): Promise<Response> {
  const { env, owner } = context;
  const refusal = await refusalOf({ context, writes: ONE_WRITE, bytes: NO_TEXT_BYTES });
  if (refusal !== null) return refusal;
  const keyId = routeParam({ context, name: RouteParam.KeyId });
  const isRevoked = await revokeOwnerKey({ directory: env.DIRECTORY, keyId, ownerId: owner.ownerId });
  if (!isRevoked) return errorResponse(OwnerErrorCode.NotFound);
  return new Response(null, { status: HttpStatus.NoContent });
}

export const OWNER_KEY_HANDLERS: Record<OwnerKeyRoute, SessionHandler> = {
  [OwnerRoute.ListOwnerKeys]: listKeys,
  [OwnerRoute.IssueOwnerKey]: issueKey,
  [OwnerRoute.RevokeOwnerKey]: revokeKey,
};
