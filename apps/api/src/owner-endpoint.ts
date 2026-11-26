import { APP_VERSION_HEADER, MINIMUM_APP_VERSION } from '@todz/types';
import { isAppVersionAccepted } from './app-version';
import { bearerSecret, unauthorized } from './bearer-secret';
import type { Env } from './env';
import { ACCOUNT_HANDLERS } from './owner-account';
import { HttpMethod } from './http-method';
import { OwnerErrorCode, appTooOldResponse, errorResponse, noRouteResponse, suspendedResponse } from './owner-errors';
import { OWNER_KEY_HANDLERS } from './owner-key-routes';
import { KEY_HANDLERS } from './owner-keys';
import type { OwnerContext, PublicHandler, PublicRoute, SessionHandler, SessionRoute } from './owner-request';
import { isReadThrottled } from './cloud-read-throttle';
import { stampOwnerSeen } from './owner-last-seen';
import { OwnerRoute, RouteParam, matchOwnerRoute } from './owner-routes';
import { signIn } from './owner-sign-in';
import { signInLimitRefusal } from './sign-in-limiter';
import { isSignedInRateLimited, withRetryAfter } from './signed-in-limiter';
import { requestSignInLink } from './sign-in-links';
import { readSignInMethod } from './sign-in-method';
import { TASK_HANDLERS } from './owner-tasks';
import { WORKSPACE_HANDLERS } from './owner-workspaces';
import { resolveSessionOwner } from './project-routing';

const SESSION_HANDLERS: Record<SessionRoute, SessionHandler> = {
  ...ACCOUNT_HANDLERS,
  ...WORKSPACE_HANDLERS,
  ...KEY_HANDLERS,
  ...OWNER_KEY_HANDLERS,
  ...TASK_HANDLERS,
};

const PUBLIC_HANDLERS: Record<PublicRoute, PublicHandler> = {
  [OwnerRoute.SignIn]: signIn,
  [OwnerRoute.ReadSignInMethod]: readSignInMethod,
  [OwnerRoute.RequestSignInLink]: requestSignInLink,
};

function isPublicRoute(route: OwnerRoute): route is PublicRoute {
  return route in PUBLIC_HANDLERS;
}

async function servePublic({ context, route }: { context: OwnerContext; route: PublicRoute }): Promise<Response> {
  const versionRefusal = appVersionRefusal(context.request);
  if (versionRefusal !== null) return versionRefusal;
  const limitRefusal = await signInLimitRefusal({ request: context.request, env: context.env, route });
  if (limitRefusal !== null) return limitRefusal;
  return PUBLIC_HANDLERS[route](context);
}

function appVersionRefusal(request: Request): Response | null {
  const candidate = request.headers.get(APP_VERSION_HEADER);
  if (isAppVersionAccepted({ candidate, minimum: MINIMUM_APP_VERSION })) return null;
  return appTooOldResponse();
}

export async function serveOwner({
  request,
  env,
  now,
  executionContext,
}: {
  request: Request;
  env: Env;
  now: number;
  executionContext: ExecutionContext;
}): Promise<Response> {
  const match = matchOwnerRoute(request);
  if (match === null) return noRouteResponse();
  const context = { request, env, now, executionContext, params: match.params };
  if (isPublicRoute(match.route)) return servePublic({ context, route: match.route });
  const secret = bearerSecret(request);
  if (secret === null) return unauthorized();
  const owner = await resolveSessionOwner({ env, secret, now, projectId: match.params[RouteParam.ProjectId] });
  if (owner === null) return unauthorized();
  const versionRefusal = appVersionRefusal(request);
  if (versionRefusal !== null) return versionRefusal;
  const isRateLimited = await isSignedInRateLimited({ request, env, limiter: env.OWNER_LIMITER, key: owner.ownerId });
  if (isRateLimited) return withRetryAfter(errorResponse(OwnerErrorCode.RateLimited));
  const isChanging = match.route !== OwnerRoute.SignOut && request.method !== HttpMethod.Get;
  const isSuspendedChange = isChanging && owner.isSuspended;
  if (isSuspendedChange) return suspendedResponse();
  executionContext.waitUntil(stampOwnerSeen({ env, ownerId: owner.ownerId, now }).catch(() => undefined));
  const isThrottledRead = !isChanging && (await isReadThrottled({ request, env, ownerId: owner.ownerId, now }));
  if (isThrottledRead) return withRetryAfter(errorResponse(OwnerErrorCode.RateLimited));
  return SESSION_HANDLERS[match.route]({ ...context, owner, secret });
}
