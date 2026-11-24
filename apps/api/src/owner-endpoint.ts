import { bearerSecret, unauthorized } from './bearer-secret';
import type { Env } from './env';
import { ACCOUNT_HANDLERS } from './owner-account';
import { noRouteResponse } from './owner-errors';
import { KEY_HANDLERS } from './owner-keys';
import type { SessionHandler, SessionRoute } from './owner-request';
import { OwnerRoute, matchOwnerRoute } from './owner-routes';
import { signIn } from './owner-sign-in';
import { TASK_HANDLERS } from './owner-tasks';
import { WORKSPACE_HANDLERS } from './owner-workspaces';
import { resolveSessionOwner } from './project-routing';

const SESSION_HANDLERS: Record<SessionRoute, SessionHandler> = {
  ...ACCOUNT_HANDLERS,
  ...WORKSPACE_HANDLERS,
  ...KEY_HANDLERS,
  ...TASK_HANDLERS,
};

export async function serveOwner({ request, env, now }: { request: Request; env: Env; now: number }): Promise<Response> {
  const match = matchOwnerRoute(request);
  if (match === null) return noRouteResponse();
  const context = { request, env, now, params: match.params };
  if (match.route === OwnerRoute.SignIn) return signIn(context);
  const secret = bearerSecret(request);
  if (secret === null) return unauthorized();
  const owner = await resolveSessionOwner({ env, secret, now });
  if (owner === null) return unauthorized();
  return SESSION_HANDLERS[match.route]({ ...context, owner, secret });
}
