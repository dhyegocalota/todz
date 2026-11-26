import { FairUseLimit } from '@todz/types';
import { z } from 'zod';
import { listOwnerWorkspaces } from './directory-workspaces';
import { fairUseLimitsOf } from './fair-use-limits';
import { HttpStatus } from './http-status';
import { failedResponse } from './owner-action-response';
import { ActionFailureKind, type ActionResult } from './owner-action-result';
import { OwnerErrorCode, errorResponse, limitResponse } from './owner-errors';
import { projectJson, workspaceJson } from './owner-json';
import { type SessionContext, type SessionHandler, parsedBody, routeParam } from './owner-request';
import { OwnerRoute, RouteParam } from './owner-routes';
import { createProject, createWorkspace, deleteProject, deleteWorkspace, renameProject, renameWorkspace } from './owner-workspace-actions';

const NameBodySchema = z.object({ name: z.string() });

type WorkspaceRoute =
  | OwnerRoute.ListWorkspaces
  | OwnerRoute.CreateWorkspace
  | OwnerRoute.RenameWorkspace
  | OwnerRoute.DeleteWorkspace
  | OwnerRoute.CreateProject
  | OwnerRoute.RenameProject
  | OwnerRoute.DeleteProject;

function createFailedResponse({
  result,
  limit,
  context,
}: {
  result: Extract<ActionResult<unknown>, { ok: false }>;
  limit: FairUseLimit;
  context: SessionContext;
}): Response {
  if (result.failure.kind !== ActionFailureKind.LimitReached) return failedResponse(result.failure);
  return limitResponse({ limit, limits: fairUseLimitsOf(context.env), now: context.now });
}

async function listWorkspaces({ env, owner }: SessionContext): Promise<Response> {
  const listings = await listOwnerWorkspaces({ directory: env.DIRECTORY, ownerId: owner.ownerId });
  return Response.json({ workspaces: listings.map(workspaceJson) });
}

async function createWorkspaceRoute(context: SessionContext): Promise<Response> {
  const { request, env, owner, now } = context;
  const body = await parsedBody({ request, schema: NameBodySchema });
  if (body === null) return errorResponse(OwnerErrorCode.InvalidRequest);
  const workspacesPerOwnerMax = fairUseLimitsOf(env)[FairUseLimit.Workspaces];
  const result = await createWorkspace({ env, owner, name: body.name, now, workspacesPerOwnerMax });
  if (!result.ok) return createFailedResponse({ result, limit: FairUseLimit.Workspaces, context });
  return Response.json({ workspace: workspaceJson(result.value) }, { status: HttpStatus.Created });
}

async function renameWorkspaceRoute(context: SessionContext): Promise<Response> {
  const { request, env, owner } = context;
  const body = await parsedBody({ request, schema: NameBodySchema });
  if (body === null) return errorResponse(OwnerErrorCode.InvalidRequest);
  const result = await renameWorkspace({ env, owner, workspaceId: routeParam({ context, name: RouteParam.WorkspaceId }), name: body.name });
  if (!result.ok) return failedResponse(result.failure);
  return Response.json({ workspace: workspaceJson(result.value) });
}

async function createProjectRoute(context: SessionContext): Promise<Response> {
  const { request, env, owner, now } = context;
  const body = await parsedBody({ request, schema: NameBodySchema });
  if (body === null) return errorResponse(OwnerErrorCode.InvalidRequest);
  const result = await createProject({
    env,
    owner,
    workspaceId: routeParam({ context, name: RouteParam.WorkspaceId }),
    name: body.name,
    now,
    projectsPerWorkspaceMax: fairUseLimitsOf(env)[FairUseLimit.Projects],
  });
  if (!result.ok) return createFailedResponse({ result, limit: FairUseLimit.Projects, context });
  return Response.json({ project: projectJson(result.value) }, { status: HttpStatus.Created });
}

async function renameProjectRoute(context: SessionContext): Promise<Response> {
  const { request, env, owner } = context;
  const body = await parsedBody({ request, schema: NameBodySchema });
  if (body === null) return errorResponse(OwnerErrorCode.InvalidRequest);
  const result = await renameProject({ env, owner, projectId: routeParam({ context, name: RouteParam.ProjectId }), name: body.name });
  if (!result.ok) return failedResponse(result.failure);
  return Response.json({ project: projectJson(result.value) });
}

async function deleteWorkspaceRoute(context: SessionContext): Promise<Response> {
  const { env, owner } = context;
  const result = await deleteWorkspace({
    env,
    owner,
    workspaceId: routeParam({ context, name: RouteParam.WorkspaceId }),
    expectedName: null,
  });
  if (!result.ok) return failedResponse(result.failure);
  return new Response(null, { status: HttpStatus.NoContent });
}

async function deleteProjectRoute(context: SessionContext): Promise<Response> {
  const { env, owner } = context;
  const result = await deleteProject({
    env,
    owner,
    projectId: routeParam({ context, name: RouteParam.ProjectId }),
    expectedName: null,
  });
  if (!result.ok) return failedResponse(result.failure);
  return new Response(null, { status: HttpStatus.NoContent });
}

export const WORKSPACE_HANDLERS: Record<WorkspaceRoute, SessionHandler> = {
  [OwnerRoute.ListWorkspaces]: listWorkspaces,
  [OwnerRoute.CreateWorkspace]: createWorkspaceRoute,
  [OwnerRoute.RenameWorkspace]: renameWorkspaceRoute,
  [OwnerRoute.DeleteWorkspace]: deleteWorkspaceRoute,
  [OwnerRoute.CreateProject]: createProjectRoute,
  [OwnerRoute.RenameProject]: renameProjectRoute,
  [OwnerRoute.DeleteProject]: deleteProjectRoute,
};
