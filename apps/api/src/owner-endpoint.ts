import { bearerSecret, unauthorized } from './bearer-secret';
import type { Env } from './env';
import { ACCOUNT_HANDLERS } from './owner-account';
import { noRouteResponse } from './owner-errors';
import { KEY_HANDLERS } from './owner-keys';
import type { PublicHandler, PublicRoute, SessionHandler, SessionRoute } from './owner-request';
import { OwnerRoute, matchOwnerRoute } from './owner-routes';
import { signIn } from './owner-sign-in';
import { signInLimitRefusal } from './sign-in-limiter';
import { requestSignInLink } from './sign-in-links';
import { readSignInMethod } from './sign-in-method';
import { TASK_HANDLERS } from './owner-tasks';
import { WORKSPACE_HANDLERS } from './owner-workspaces';
import { resolveSessionOwner } from './project-routing';

const SESSION_HANDLERS: Record<SessionRoute, SessionHandler> = {
  ...ACCOUNT_HANDLERS,
  ...WORKSPACE_HANDLERS,
  ...KEY_HANDLERS,
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
  const limitRefusal = await signInLimitRefusal({ request, env, route: match.route });
  if (limitRefusal !== null) return limitRefusal;
  if (isPublicRoute(match.route)) return PUBLIC_HANDLERS[match.route](context);
  const secret = bearerSecret(request);
  if (secret === null) return unauthorized();
  const owner = await resolveSessionOwner({ env, secret, now });
  if (owner === null) return unauthorized();
  return SESSION_HANDLERS[match.route]({ ...context, owner, secret });
}
