import { normalizeName } from '@todz/core';
import { INBOX_PROJECT_NAME, OWNER_WORKSPACES_MAX, WORKSPACE_PROJECTS_MAX } from '@todz/types';
import { z } from 'zod';
import {
  deleteOwnerProject,
  deleteOwnerWorkspace,
  findOwnerWorkspace,
  findProject,
  insertProject,
  insertWorkspaceWithInbox,
  listOwnerWorkspaces,
  updateProjectName,
  updateWorkspaceName,
} from './directory-workspaces';
import { HttpStatus } from './http-status';
import { OwnerErrorCode, errorResponse, failureResponse } from './owner-errors';
import { projectJson, workspaceJson } from './owner-json';
import { type SessionContext, type SessionHandler, parsedBody, routeParam } from './owner-request';
import { OwnerRoute, RouteParam } from './owner-routes';
import { resultOf } from './project-result';
import { findOwnedProjectId, findOwnedWorkspaceId, wipeProjectStorage } from './project-routing';

const NameBodySchema = z.object({ name: z.string() });

type WorkspaceRoute =
  | OwnerRoute.ListWorkspaces
  | OwnerRoute.CreateWorkspace
  | OwnerRoute.RenameWorkspace
  | OwnerRoute.DeleteWorkspace
  | OwnerRoute.CreateProject
  | OwnerRoute.RenameProject
  | OwnerRoute.DeleteProject;

async function listWorkspaces({ env, owner }: SessionContext): Promise<Response> {
  const listings = await listOwnerWorkspaces({ directory: env.DIRECTORY, ownerId: owner.ownerId });
  return Response.json({ workspaces: listings.map(workspaceJson) });
}

async function createWorkspace({ request, env, owner, now }: SessionContext): Promise<Response> {
  const body = await parsedBody({ request, schema: NameBodySchema });
  if (body === null) return errorResponse(OwnerErrorCode.InvalidRequest);
  const nameResult = resultOf(() => normalizeName(body.name));
  if (!nameResult.ok) return failureResponse(nameResult.failure);
  const workspace = { id: crypto.randomUUID(), name: nameResult.value, createdAt: now, lastActivityAt: null };
  const inbox = { id: crypto.randomUUID(), name: INBOX_PROJECT_NAME, isInbox: true, createdAt: now };
  const isInserted = await insertWorkspaceWithInbox({
    directory: env.DIRECTORY,
    ownerId: owner.ownerId,
    workspaceId: workspace.id,
    inboxId: inbox.id,
    name: workspace.name,
    inboxName: inbox.name,
    now,
    workspacesPerOwnerMax: OWNER_WORKSPACES_MAX,
  });
  if (!isInserted) return errorResponse(OwnerErrorCode.LimitReached);
  return Response.json({ workspace: workspaceJson({ workspace, projects: [inbox] }) }, { status: HttpStatus.Created });
}

async function renameWorkspace(context: SessionContext): Promise<Response> {
  const { request, env, owner } = context;
  const body = await parsedBody({ request, schema: NameBodySchema });
  if (body === null) return errorResponse(OwnerErrorCode.InvalidRequest);
  const workspaceId = await findOwnedWorkspaceId({ env, owner, workspaceId: routeParam({ context, name: RouteParam.WorkspaceId }) });
  if (workspaceId === null) return errorResponse(OwnerErrorCode.NotFound);
  const nameResult = resultOf(() => normalizeName(body.name));
  if (!nameResult.ok) return failureResponse(nameResult.failure);
  const isRenamed = await updateWorkspaceName({ directory: env.DIRECTORY, ownerId: owner.ownerId, workspaceId, name: nameResult.value });
  if (!isRenamed) return errorResponse(OwnerErrorCode.NotFound);
  const renamed = await findOwnerWorkspace({ directory: env.DIRECTORY, ownerId: owner.ownerId, workspaceId });
  if (renamed === null) throw new Error('a renamed workspace is missing from the directory');
  return Response.json({ workspace: workspaceJson(renamed) });
}

async function createProject(context: SessionContext): Promise<Response> {
  const { request, env, owner, now } = context;
  const body = await parsedBody({ request, schema: NameBodySchema });
  if (body === null) return errorResponse(OwnerErrorCode.InvalidRequest);
  const workspaceId = await findOwnedWorkspaceId({ env, owner, workspaceId: routeParam({ context, name: RouteParam.WorkspaceId }) });
  if (workspaceId === null) return errorResponse(OwnerErrorCode.NotFound);
  const nameResult = resultOf(() => normalizeName(body.name));
  if (!nameResult.ok) return failureResponse(nameResult.failure);
  const project = { id: crypto.randomUUID(), name: nameResult.value, isInbox: false, createdAt: now };
  const isInserted = await insertProject({
    directory: env.DIRECTORY,
    ownerId: owner.ownerId,
    projectId: project.id,
    workspaceId,
    name: project.name,
    now,
    projectsPerWorkspaceMax: WORKSPACE_PROJECTS_MAX,
  });
  if (!isInserted) return errorResponse(OwnerErrorCode.LimitReached);
  return Response.json({ project: projectJson(project) }, { status: HttpStatus.Created });
}

async function renameProject(context: SessionContext): Promise<Response> {
  const { request, env, owner } = context;
  const body = await parsedBody({ request, schema: NameBodySchema });
  if (body === null) return errorResponse(OwnerErrorCode.InvalidRequest);
  const projectId = await findOwnedProjectId({ env, owner, projectId: routeParam({ context, name: RouteParam.ProjectId }) });
  if (projectId === null) return errorResponse(OwnerErrorCode.NotFound);
  const project = await findProject({ directory: env.DIRECTORY, projectId });
  if (project === null) throw new Error('an owned project has no row');
  if (project.isInbox) return errorResponse(OwnerErrorCode.InboxIsFixed);
  const nameResult = resultOf(() => normalizeName(body.name));
  if (!nameResult.ok) return failureResponse(nameResult.failure);
  const isRenamed = await updateProjectName({ directory: env.DIRECTORY, ownerId: owner.ownerId, projectId, name: nameResult.value });
  if (!isRenamed) return errorResponse(OwnerErrorCode.NotFound);
  return Response.json({ project: projectJson({ ...project, name: nameResult.value }) });
}

async function deleteWorkspace(context: SessionContext): Promise<Response> {
  const { env, owner } = context;
  const workspaceId = await findOwnedWorkspaceId({ env, owner, workspaceId: routeParam({ context, name: RouteParam.WorkspaceId }) });
  if (workspaceId === null) return errorResponse(OwnerErrorCode.NotFound);
  const deletedProjectIds = await deleteOwnerWorkspace({ directory: env.DIRECTORY, ownerId: owner.ownerId, workspaceId });
  if (deletedProjectIds === null) return errorResponse(OwnerErrorCode.NotFound);
  await Promise.allSettled(deletedProjectIds.map((projectId) => wipeProjectStorage({ env, projectId })));
  return new Response(null, { status: HttpStatus.NoContent });
}

async function deleteProject(context: SessionContext): Promise<Response> {
  const { env, owner } = context;
  const projectId = await findOwnedProjectId({ env, owner, projectId: routeParam({ context, name: RouteParam.ProjectId }) });
  if (projectId === null) return errorResponse(OwnerErrorCode.NotFound);
  const project = await findProject({ directory: env.DIRECTORY, projectId });
  if (project === null) throw new Error('an owned project has no row');
  if (project.isInbox) return errorResponse(OwnerErrorCode.InboxIsFixed);
  const isDeleted = await deleteOwnerProject({ directory: env.DIRECTORY, ownerId: owner.ownerId, projectId });
  if (!isDeleted) return errorResponse(OwnerErrorCode.NotFound);
  await Promise.allSettled([wipeProjectStorage({ env, projectId })]);
  return new Response(null, { status: HttpStatus.NoContent });
}

export const WORKSPACE_HANDLERS: Record<WorkspaceRoute, SessionHandler> = {
  [OwnerRoute.ListWorkspaces]: listWorkspaces,
  [OwnerRoute.CreateWorkspace]: createWorkspace,
  [OwnerRoute.RenameWorkspace]: renameWorkspace,
  [OwnerRoute.DeleteWorkspace]: deleteWorkspace,
  [OwnerRoute.CreateProject]: createProject,
  [OwnerRoute.RenameProject]: renameProject,
  [OwnerRoute.DeleteProject]: deleteProject,
};
