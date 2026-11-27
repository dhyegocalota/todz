import { HttpStatus } from './http-status';
import { redirectHostOf } from './oauth/oauth-redirect-uri';
import { scopeKindOf } from './oauth/oauth-scope';
import { type ConnectedAppRecord, deleteConnectedApp, listConnectedApps } from './oauth/oauth-store';
import { OwnerErrorCode, errorResponse } from './owner-errors';
import { type SessionContext, type SessionHandler, routeParam } from './owner-request';
import { OwnerRoute, RouteParam } from './owner-routes';

type ConnectedAppRoute = OwnerRoute.ListConnectedApps | OwnerRoute.DisconnectApp;

function connectedAppJson(app: ConnectedAppRecord) {
  return {
    id: app.id,
    client_name: app.clientName,
    redirect_host: redirectHostOf(app.redirectUri),
    scope: scopeKindOf(app.projectId),
    project_id: app.projectId,
    project_name: app.projectName,
    created_at: app.createdAt,
    last_used_at: app.lastUsedAt,
  };
}

async function listApps({ env, owner }: SessionContext): Promise<Response> {
  const apps = await listConnectedApps({ directory: env.DIRECTORY, ownerId: owner.ownerId });
  return Response.json({ connected_apps: apps.map(connectedAppJson) });
}

// NB ADR 0109: disconnecting deletes the grant and, through the cascade, every token of it; another owner's id answers like an absent one.
async function disconnectApp(context: SessionContext): Promise<Response> {
  const { env, owner } = context;
  const grantId = routeParam({ context, name: RouteParam.ConnectedAppId });
  const isDeleted = await deleteConnectedApp({ directory: env.DIRECTORY, ownerId: owner.ownerId, grantId });
  if (!isDeleted) return errorResponse(OwnerErrorCode.NotFound);
  return new Response(null, { status: HttpStatus.NoContent });
}

export const CONNECTED_APP_HANDLERS: Record<ConnectedAppRoute, SessionHandler> = {
  [OwnerRoute.ListConnectedApps]: listApps,
  [OwnerRoute.DisconnectApp]: disconnectApp,
};
