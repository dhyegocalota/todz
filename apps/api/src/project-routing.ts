import { digestCredential } from './credential-digest';
import { findKeyProject, findOwnedProject, findSessionOwner } from './directory';
import { findOwnedWorkspace } from './directory-workspaces';
import type { Env } from './env';
import type { ProjectStore } from './project-store';

export type SessionOwner = { readonly ownerId: string } & { readonly sessionOwner: unique symbol };

export type KeyProject = { project: DurableObjectStub<ProjectStore>; keyDigest: string; timeZone: string; agentNudge: boolean };

const resolvedOwners = new WeakSet<SessionOwner>();

function isBlankSecret(secret: unknown): boolean {
  return typeof secret !== 'string' || secret.trim() === '';
}

function openProject({ env, projectId }: { env: Env; projectId: string }): DurableObjectStub<ProjectStore> {
  return env.PROJECT_STORE.get(env.PROJECT_STORE.idFromName(projectId));
}

export async function openKeyProject({ env, secret }: { env: Env; secret: string }): Promise<KeyProject | null> {
  if (isBlankSecret(secret)) return null;
  const keyDigest = await digestCredential(secret);
  const keyProjectRecord = await findKeyProject({ directory: env.DIRECTORY, digest: keyDigest });
  if (keyProjectRecord === null) return null;
  return {
    project: openProject({ env, projectId: keyProjectRecord.projectId }),
    keyDigest,
    timeZone: keyProjectRecord.timeZone,
    agentNudge: keyProjectRecord.agentNudge,
  };
}

export async function resolveSessionOwner({ env, secret, now }: { env: Env; secret: string; now: number }): Promise<SessionOwner | null> {
  if (isBlankSecret(secret)) return null;
  const ownerId = await findSessionOwner({ directory: env.DIRECTORY, digest: await digestCredential(secret), now });
  if (ownerId === null) return null;
  const owner = Object.freeze({ ownerId }) as SessionOwner;
  resolvedOwners.add(owner);
  return owner;
}

export async function findOwnedProjectId({
  env,
  owner,
  projectId,
}: {
  env: Env;
  owner: SessionOwner;
  projectId: string;
}): Promise<string | null> {
  if (!resolvedOwners.has(owner)) return null;
  return findOwnedProject({ directory: env.DIRECTORY, ownerId: owner.ownerId, projectId });
}

export async function findOwnedWorkspaceId({
  env,
  owner,
  workspaceId,
}: {
  env: Env;
  owner: SessionOwner;
  workspaceId: string;
}): Promise<string | null> {
  if (!resolvedOwners.has(owner)) return null;
  return findOwnedWorkspace({ directory: env.DIRECTORY, ownerId: owner.ownerId, workspaceId });
}

export async function openOwnedProject({
  env,
  owner,
  projectId,
}: {
  env: Env;
  owner: SessionOwner;
  projectId: string;
}): Promise<DurableObjectStub<ProjectStore> | null> {
  const ownedProjectId = await findOwnedProjectId({ env, owner, projectId });
  if (ownedProjectId === null) return null;
  return openProject({ env, projectId: ownedProjectId });
}
