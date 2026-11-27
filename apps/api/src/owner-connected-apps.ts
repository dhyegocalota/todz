import { z } from 'zod';
import { HttpStatus } from './http-status';
import { recordGrantDeletions } from './oauth/oauth-grant-deletion';
import { GrantDeletionReason } from './oauth/oauth-grant-deletion-reason';
import { GrantScopeKind, GrantScopesSchema, GrantShape, WORKSPACE_PROJECT_SEPARATOR } from './oauth/oauth-grant-scope';
import {
  type ConnectedAppRecord,
  type NamedScope,
  findConnectedApp,
  grantScopeOfNamed,
  listConnectedApps,
  replaceGrantScopes,
} from './oauth/oauth-grant-scope-store';
import { narrowedScopesOf } from './oauth/oauth-grant-selection';
import { redirectHostOf } from './oauth/oauth-redirect-uri';
import { deleteConnectedApp } from './oauth/oauth-store';
import { OwnerErrorCode, errorResponse } from './owner-errors';
import { type SessionContext, type SessionHandler, parsedBody, routeParam } from './owner-request';
import { OwnerRoute, RouteParam } from './owner-routes';

type ConnectedAppRoute = OwnerRoute.ListConnectedApps | OwnerRoute.NarrowApp | OwnerRoute.DisconnectApp;

const NarrowBodySchema = z.object({ scopes: GrantScopesSchema });
const LEGACY_SELECTION_SEPARATOR = '; ';

function scopeJson(scope: NamedScope) {
  if (scope.kind === GrantScopeKind.Workspace) {
    return { kind: scope.kind, workspace_id: scope.workspaceId, workspace_name: scope.workspaceName };
  }
  if (scope.kind === GrantScopeKind.Project) {
    return {
      kind: scope.kind,
      project_id: scope.projectId,
      project_name: scope.projectName,
      workspace_id: scope.workspaceId,
      workspace_name: scope.workspaceName,
    };
  }
  return { kind: scope.kind };
}

type LegacyScope = { scope: GrantShape.Owner | GrantShape.Project; projectId: string | null; projectName: string | null };

function targetIdOf(scope: NamedScope): string {
  if (scope.kind === GrantScopeKind.Workspace) return scope.workspaceId;
  if (scope.kind === GrantScopeKind.Project) return scope.projectId;
  throw new Error('the account names no target');
}

function selectionLabelOf(scope: NamedScope): string {
  if (scope.kind === GrantScopeKind.Workspace) return scope.workspaceName;
  if (scope.kind === GrantScopeKind.Project) return `${scope.workspaceName}${WORKSPACE_PROJECT_SEPARATOR}${scope.projectName}`;
  throw new Error('the account is never part of a selection');
}

// NB ADR 0126: the app 0.2.8 knows only owner and project, so a selection lists as one project named after its scopes; newer apps read scopes.
function legacyScopeOf(scopes: NamedScope[]): LegacyScope {
  const [first] = scopes;
  if (first === undefined) throw new Error('a listed grant holds at least one scope');
  if (first.kind === GrantScopeKind.Account) return { scope: GrantShape.Owner, projectId: null, projectName: null };
  const isSingleProject = scopes.length === 1 && first.kind === GrantScopeKind.Project;
  if (isSingleProject) return { scope: GrantShape.Project, projectId: first.projectId, projectName: first.projectName };
  return {
    scope: GrantShape.Project,
    projectId: targetIdOf(first),
    projectName: scopes.map(selectionLabelOf).join(LEGACY_SELECTION_SEPARATOR),
  };
}

function connectedAppJson(app: ConnectedAppRecord) {
  const legacy = legacyScopeOf(app.scopes);
  return {
    id: app.id,
    client_name: app.clientName,
    redirect_host: redirectHostOf(app.redirectUri),
    scope: legacy.scope,
    project_id: legacy.projectId,
    project_name: legacy.projectName,
    scopes: app.scopes.map(scopeJson),
    created_at: app.createdAt,
    last_used_at: app.lastUsedAt,
  };
}

async function listApps({ env, owner }: SessionContext): Promise<Response> {
  const apps = await listConnectedApps({ directory: env.DIRECTORY, ownerId: owner.ownerId });
  return Response.json({ connected_apps: apps.map(connectedAppJson) });
}

// NB ADR 0126: narrowing replaces a grant's scopes by a smaller set of the owner's own, and answers the app as the list shows it.
async function narrowApp(context: SessionContext): Promise<Response> {
  const { env, owner } = context;
  const body = await parsedBody({ request: context.request, schema: NarrowBodySchema });
  if (body === null) return errorResponse(OwnerErrorCode.InvalidRequest);
  const grantId = routeParam({ context, name: RouteParam.ConnectedAppId });
  const app = await findConnectedApp({ directory: env.DIRECTORY, ownerId: owner.ownerId, grantId });
  if (app === null) return errorResponse(OwnerErrorCode.NotFound);
  const scopes = await narrowedScopesOf({
    directory: env.DIRECTORY,
    ownerId: owner.ownerId,
    held: app.scopes.map(grantScopeOfNamed),
    requested: body.scopes,
  });
  if (scopes === null) return errorResponse(OwnerErrorCode.ScopeNotNarrower);
  await replaceGrantScopes({ directory: env.DIRECTORY, ownerId: owner.ownerId, grantId, scopes });
  const narrowed = await findConnectedApp({ directory: env.DIRECTORY, ownerId: owner.ownerId, grantId });
  if (narrowed === null) return errorResponse(OwnerErrorCode.NotFound);
  return Response.json({ connected_app: connectedAppJson(narrowed) });
}

// NB ADR 0109: disconnecting deletes the grant and, through the cascade, every token of it; another owner's id answers like an absent one.
async function disconnectApp(context: SessionContext): Promise<Response> {
  const { env, owner } = context;
  const grantId = routeParam({ context, name: RouteParam.ConnectedAppId });
  const clientIds = await deleteConnectedApp({ directory: env.DIRECTORY, ownerId: owner.ownerId, grantId });
  if (clientIds.length === 0) return errorResponse(OwnerErrorCode.NotFound);
  await recordGrantDeletions({ env, reason: GrantDeletionReason.SettingsDisconnect, clientIds, now: Date.now() });
  return new Response(null, { status: HttpStatus.NoContent });
}

export const CONNECTED_APP_HANDLERS: Record<ConnectedAppRoute, SessionHandler> = {
  [OwnerRoute.ListConnectedApps]: listApps,
  [OwnerRoute.NarrowApp]: narrowApp,
  [OwnerRoute.DisconnectApp]: disconnectApp,
};
