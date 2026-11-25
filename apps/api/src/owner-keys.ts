import { listProjectKeys, revokeProjectKey } from './directory-keys';
import { HttpStatus } from './http-status';
import { OwnerErrorCode, errorResponse } from './owner-errors';
import { keyJson } from './owner-json';
import { type SessionContext, type SessionHandler, routeParam } from './owner-request';
import { OwnerRoute, RouteParam } from './owner-routes';
import { issueProjectKey, keyHintOf } from './project-keys';
import { findOwnedProjectId } from './project-routing';

type KeyRoute = OwnerRoute.ListKeys | OwnerRoute.IssueKey | OwnerRoute.RevokeKey;

function ownedProjectId(context: SessionContext): Promise<string | null> {
  const { env, owner } = context;
  return findOwnedProjectId({ env, owner, projectId: routeParam({ context, name: RouteParam.ProjectId }) });
}

async function listKeys(context: SessionContext): Promise<Response> {
  const projectId = await ownedProjectId(context);
  if (projectId === null) return errorResponse(OwnerErrorCode.NotFound);
  const keys = await listProjectKeys({ directory: context.env.DIRECTORY, projectId });
  return Response.json({ keys: keys.map(keyJson) });
}

async function issueKey(context: SessionContext): Promise<Response> {
  const projectId = await ownedProjectId(context);
  if (projectId === null) return errorResponse(OwnerErrorCode.NotFound);
  const { now } = context;
  const issued = await issueProjectKey({ directory: context.env.DIRECTORY, projectId, now });
  if (issued === null) return errorResponse(OwnerErrorCode.LimitReached);
  const { id, secret } = issued;
  return Response.json({ key: keyJson({ id, hint: keyHintOf(secret), createdAt: now }), secret }, { status: HttpStatus.Created });
}

async function revokeKey(context: SessionContext): Promise<Response> {
  const projectId = await ownedProjectId(context);
  if (projectId === null) return errorResponse(OwnerErrorCode.NotFound);
  const keyId = routeParam({ context, name: RouteParam.KeyId });
  const isRevoked = await revokeProjectKey({ directory: context.env.DIRECTORY, keyId, projectId });
  if (!isRevoked) return errorResponse(OwnerErrorCode.NotFound);
  return new Response(null, { status: HttpStatus.NoContent });
}

export const KEY_HANDLERS: Record<KeyRoute, SessionHandler> = {
  [OwnerRoute.ListKeys]: listKeys,
  [OwnerRoute.IssueKey]: issueKey,
  [OwnerRoute.RevokeKey]: revokeKey,
};
