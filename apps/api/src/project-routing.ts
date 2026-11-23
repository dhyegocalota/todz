import type { Env } from './env';
import type { ProjectStore } from './project-store';

export type SessionOwner = { ownerId: string } & { readonly sessionOwner: unique symbol };

export async function openKeyProject({ env, secret }: { env: Env; secret: string }): Promise<DurableObjectStub<ProjectStore> | null> {
  throw new Error('openKeyProject is not implemented');
}

export async function resolveSessionOwner({ env, secret, now }: { env: Env; secret: string; now: number }): Promise<SessionOwner | null> {
  throw new Error('resolveSessionOwner is not implemented');
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
  throw new Error('openOwnedProject is not implemented');
}
