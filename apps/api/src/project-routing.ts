import { digestCredential } from './credential-digest';
import { findKeyProject, findOwnedProject, findSessionOwner } from './directory';
import type { Env } from './env';
import type { ProjectStore } from './project-store';

const EMPTY_SECRET = '';

export type SessionOwner = { ownerId: string } & { readonly sessionOwner: unique symbol };

function openProject({ env, projectId }: { env: Env; projectId: string }): DurableObjectStub<ProjectStore> {
  return env.PROJECT_STORE.get(env.PROJECT_STORE.idFromName(projectId));
}

export async function openKeyProject({ env, secret }: { env: Env; secret: string }): Promise<DurableObjectStub<ProjectStore> | null> {
  if (secret === EMPTY_SECRET) return null;
  const projectId = await findKeyProject({ directory: env.DIRECTORY, digest: await digestCredential(secret) });
  if (projectId === null) return null;
  return openProject({ env, projectId });
}

export async function resolveSessionOwner({ env, secret, now }: { env: Env; secret: string; now: number }): Promise<SessionOwner | null> {
  if (secret === EMPTY_SECRET) return null;
  const ownerId = await findSessionOwner({ directory: env.DIRECTORY, digest: await digestCredential(secret), now });
  if (ownerId === null) return null;
  return { ownerId } as SessionOwner;
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
  const ownedProjectId = await findOwnedProject({ directory: env.DIRECTORY, ownerId: owner.ownerId, projectId });
  if (ownedProjectId === null) return null;
  return openProject({ env, projectId: ownedProjectId });
}
