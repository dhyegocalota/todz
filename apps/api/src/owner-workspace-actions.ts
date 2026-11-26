import { normalizeName } from '@todz/core';
import { INBOX_PROJECT_NAME } from '@todz/types';
import {
  deleteOwnerProject,
  deleteOwnerWorkspace,
  findOwnerWorkspace,
  findProject,
  insertProject,
  insertWorkspaceWithInbox,
  updateProjectName,
  updateWorkspaceName,
} from './directory-workspaces';
import type { WorkspaceListing } from './directory-workspaces';
import type { Env } from './env';
import type { ProjectRecord } from './owner-records';
import { type ProjectFailure, resultOf } from './project-result';
import { type SessionOwner, findOwnedProjectId, findOwnedWorkspaceId, wipeProjectStorage } from './project-routing';

export enum ActionFailureKind {
  NotFound = 'not_found',
  LimitReached = 'limit_reached',
  InboxIsFixed = 'inbox_is_fixed',
  RuleViolated = 'rule_violated',
}

export type ActionFailure =
  | { kind: ActionFailureKind.NotFound }
  | { kind: ActionFailureKind.LimitReached }
  | { kind: ActionFailureKind.InboxIsFixed }
  | { kind: ActionFailureKind.RuleViolated; failure: ProjectFailure };

export type ActionResult<Value> = { ok: true; value: Value } | { ok: false; failure: ActionFailure };

type Acting = { env: Env; owner: SessionOwner };

function failed(kind: Exclude<ActionFailureKind, ActionFailureKind.RuleViolated>): ActionResult<never> {
  return { ok: false, failure: { kind } };
}

function nameOf(name: string): ActionResult<string> {
  const nameResult = resultOf(() => normalizeName(name));
  if (nameResult.ok) return nameResult;
  return { ok: false, failure: { kind: ActionFailureKind.RuleViolated, failure: nameResult.failure } };
}

// NB ADR 0101: every account action starts from a SessionOwner, so an owner key and a session reach exactly the same rows and no others.
export async function createWorkspace({
  env,
  owner,
  name,
  now,
  workspacesPerOwnerMax,
}: Acting & { name: string; now: number; workspacesPerOwnerMax: number }): Promise<ActionResult<WorkspaceListing>> {
  const normalized = nameOf(name);
  if (!normalized.ok) return normalized;
  const workspace = { id: crypto.randomUUID(), name: normalized.value, createdAt: now };
  const inbox = { id: crypto.randomUUID(), name: INBOX_PROJECT_NAME, isInbox: true, createdAt: now };
  const isInserted = await insertWorkspaceWithInbox({
    directory: env.DIRECTORY,
    ownerId: owner.ownerId,
    workspaceId: workspace.id,
    inboxId: inbox.id,
    name: workspace.name,
    inboxName: inbox.name,
    now,
    workspacesPerOwnerMax,
  });
  if (!isInserted) return failed(ActionFailureKind.LimitReached);
  return { ok: true, value: { workspace, projects: [inbox] } };
}

export async function renameWorkspace({
  env,
  owner,
  workspaceId,
  name,
}: Acting & { workspaceId: string; name: string }): Promise<ActionResult<WorkspaceListing>> {
  const ownedWorkspaceId = await findOwnedWorkspaceId({ env, owner, workspaceId });
  if (ownedWorkspaceId === null) return failed(ActionFailureKind.NotFound);
  const normalized = nameOf(name);
  if (!normalized.ok) return normalized;
  const isRenamed = await updateWorkspaceName({
    directory: env.DIRECTORY,
    ownerId: owner.ownerId,
    workspaceId: ownedWorkspaceId,
    name: normalized.value,
  });
  if (!isRenamed) return failed(ActionFailureKind.NotFound);
  const renamed = await findOwnerWorkspace({ directory: env.DIRECTORY, ownerId: owner.ownerId, workspaceId: ownedWorkspaceId });
  if (renamed === null) throw new Error('a renamed workspace is missing from the directory');
  return { ok: true, value: renamed };
}

export async function deleteWorkspace({ env, owner, workspaceId }: Acting & { workspaceId: string }): Promise<ActionResult<null>> {
  const ownedWorkspaceId = await findOwnedWorkspaceId({ env, owner, workspaceId });
  if (ownedWorkspaceId === null) return failed(ActionFailureKind.NotFound);
  const deletedProjectIds = await deleteOwnerWorkspace({ directory: env.DIRECTORY, ownerId: owner.ownerId, workspaceId: ownedWorkspaceId });
  if (deletedProjectIds === null) return failed(ActionFailureKind.NotFound);
  await Promise.allSettled(deletedProjectIds.map((projectId) => wipeProjectStorage({ env, projectId })));
  return { ok: true, value: null };
}

export async function createProject({
  env,
  owner,
  workspaceId,
  name,
  now,
  projectsPerWorkspaceMax,
}: Acting & { workspaceId: string; name: string; now: number; projectsPerWorkspaceMax: number }): Promise<ActionResult<ProjectRecord>> {
  const ownedWorkspaceId = await findOwnedWorkspaceId({ env, owner, workspaceId });
  if (ownedWorkspaceId === null) return failed(ActionFailureKind.NotFound);
  const normalized = nameOf(name);
  if (!normalized.ok) return normalized;
  const project = { id: crypto.randomUUID(), name: normalized.value, isInbox: false, createdAt: now };
  const isInserted = await insertProject({
    directory: env.DIRECTORY,
    ownerId: owner.ownerId,
    projectId: project.id,
    workspaceId: ownedWorkspaceId,
    name: project.name,
    now,
    projectsPerWorkspaceMax,
  });
  if (!isInserted) return failed(ActionFailureKind.LimitReached);
  return { ok: true, value: project };
}

async function ownedChangeableProject({ env, owner, projectId }: Acting & { projectId: string }): Promise<ActionResult<ProjectRecord>> {
  const ownedProjectId = await findOwnedProjectId({ env, owner, projectId });
  if (ownedProjectId === null) return failed(ActionFailureKind.NotFound);
  const project = await findProject({ directory: env.DIRECTORY, projectId: ownedProjectId });
  if (project === null) throw new Error('an owned project has no row');
  if (project.isInbox) return failed(ActionFailureKind.InboxIsFixed);
  return { ok: true, value: project };
}

export async function renameProject({
  env,
  owner,
  projectId,
  name,
}: Acting & { projectId: string; name: string }): Promise<ActionResult<ProjectRecord>> {
  const changeable = await ownedChangeableProject({ env, owner, projectId });
  if (!changeable.ok) return changeable;
  const normalized = nameOf(name);
  if (!normalized.ok) return normalized;
  const isRenamed = await updateProjectName({ directory: env.DIRECTORY, ownerId: owner.ownerId, projectId, name: normalized.value });
  if (!isRenamed) return failed(ActionFailureKind.NotFound);
  return { ok: true, value: { ...changeable.value, name: normalized.value } };
}

export async function deleteProject({ env, owner, projectId }: Acting & { projectId: string }): Promise<ActionResult<null>> {
  const changeable = await ownedChangeableProject({ env, owner, projectId });
  if (!changeable.ok) return changeable;
  const isDeleted = await deleteOwnerProject({ directory: env.DIRECTORY, ownerId: owner.ownerId, projectId });
  if (!isDeleted) return failed(ActionFailureKind.NotFound);
  await Promise.allSettled([wipeProjectStorage({ env, projectId })]);
  return { ok: true, value: null };
}
