import { normalizeName } from '@todz/core';
import { INBOX_PROJECT_NAME, RuleIssue } from '@todz/types';
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
import { ActionFailureKind, type ActionResult, failed } from './owner-action-result';
import type { ProjectRecord } from './owner-records';
import { ProjectFailureKind, resultOf } from './project-result';
import { type SessionOwner, findOwnedProjectId, findOwnedWorkspaceId, wipeProjectStorage } from './project-routing';

type Acting = { env: Env; owner: SessionOwner };

function nameOf(name: string): ActionResult<string> {
  const nameResult = resultOf(() => normalizeName(name));
  if (nameResult.ok) return nameResult;
  return { ok: false, failure: { kind: ActionFailureKind.RuleViolated, failure: nameResult.failure } };
}

// NB ADR 0101: every account action starts from a SessionOwner, so an owner grant and a session reach exactly the same rows and no others.
export async function createWorkspace({
  env,
  owner,
  name,
  now,
  workspacesPerOwnerMax,
}: Acting & { name: string; now: number; workspacesPerOwnerMax: number }): Promise<ActionResult<WorkspaceListing>> {
  const normalized = nameOf(name);
  if (!normalized.ok) return normalized;
  const workspace = { id: crypto.randomUUID(), name: normalized.value, createdAt: now, lastActivityAt: null };
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

export async function deleteWorkspace({
  env,
  owner,
  workspaceId,
  expectedName,
}: Acting & { workspaceId: string; expectedName: string | null }): Promise<ActionResult<null>> {
  const ownedWorkspaceId = await findOwnedWorkspaceId({ env, owner, workspaceId });
  if (ownedWorkspaceId === null) return failed(ActionFailureKind.NotFound);
  const deletedProjectIds = await deleteOwnerWorkspace({
    directory: env.DIRECTORY,
    ownerId: owner.ownerId,
    workspaceId: ownedWorkspaceId,
    expectedName,
  });
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

const CONFIRMATION_MISMATCH: ActionResult<never> = {
  ok: false,
  failure: {
    kind: ActionFailureKind.RuleViolated,
    failure: { kind: ProjectFailureKind.RuleViolated, issue: RuleIssue.ConfirmationMismatch, index: null },
  },
};

// NB ADR 0101: a delete over MCP names its target: the confirmation must equal the current name, and a target of another owner answers not found before any name is compared.
export async function findConfirmedWorkspace({
  env,
  owner,
  workspaceId,
  confirmation,
}: Acting & { workspaceId: string; confirmation: string }): Promise<ActionResult<WorkspaceListing>> {
  const ownedWorkspaceId = await findOwnedWorkspaceId({ env, owner, workspaceId });
  if (ownedWorkspaceId === null) return failed(ActionFailureKind.NotFound);
  const listing = await findOwnerWorkspace({ directory: env.DIRECTORY, ownerId: owner.ownerId, workspaceId: ownedWorkspaceId });
  if (listing === null) return failed(ActionFailureKind.NotFound);
  if (confirmation.trim() !== listing.workspace.name) return CONFIRMATION_MISMATCH;
  return { ok: true, value: listing };
}

export async function findConfirmedProject({
  env,
  owner,
  projectId,
  confirmation,
}: Acting & { projectId: string; confirmation: string }): Promise<ActionResult<ProjectRecord>> {
  const changeable = await ownedChangeableProject({ env, owner, projectId });
  if (!changeable.ok) return changeable;
  if (confirmation.trim() !== changeable.value.name) return CONFIRMATION_MISMATCH;
  return changeable;
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

export async function deleteProject({
  env,
  owner,
  projectId,
  expectedName,
}: Acting & { projectId: string; expectedName: string | null }): Promise<ActionResult<null>> {
  const changeable = await ownedChangeableProject({ env, owner, projectId });
  if (!changeable.ok) return changeable;
  const isDeleted = await deleteOwnerProject({ directory: env.DIRECTORY, ownerId: owner.ownerId, projectId, expectedName });
  if (!isDeleted) return failed(ActionFailureKind.NotFound);
  await Promise.allSettled([wipeProjectStorage({ env, projectId })]);
  return { ok: true, value: null };
}
