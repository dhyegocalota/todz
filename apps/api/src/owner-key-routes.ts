import { listOwnerKeys, revokeOwnerKey } from './directory-owner-keys';
import { HttpStatus } from './http-status';
import { OwnerErrorCode, errorResponse } from './owner-errors';
import { keyJson } from './owner-json';
import { issueOwnerKey } from './owner-keys-issuance';
import { type SessionContext, type SessionHandler, routeParam } from './owner-request';
import { OwnerRoute, RouteParam } from './owner-routes';
import { keyHintOf } from './project-keys';

type OwnerKeyRoute = OwnerRoute.ListOwnerKeys | OwnerRoute.IssueOwnerKey | OwnerRoute.RevokeOwnerKey;

async function listKeys({ env, owner }: SessionContext): Promise<Response> {
  const keys = await listOwnerKeys({ directory: env.DIRECTORY, ownerId: owner.ownerId });
  return Response.json({ keys: keys.map(keyJson) });
}

async function issueKey({ env, owner, now }: SessionContext): Promise<Response> {
  const issued = await issueOwnerKey({ directory: env.DIRECTORY, ownerId: owner.ownerId, now });
  if (issued === null) return errorResponse(OwnerErrorCode.LimitReached);
  const { id, secret } = issued;
  return Response.json({ key: keyJson({ id, hint: keyHintOf(secret), createdAt: now }), secret }, { status: HttpStatus.Created });
}

async function revokeKey(context: SessionContext): Promise<Response> {
  const { env, owner } = context;
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
