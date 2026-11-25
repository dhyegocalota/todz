import { digestCredential } from './credential-digest';
import {
  type KeyProjectSessionRecord,
  findKeyProject,
  findKeyProjectAndSession,
  findOwnedProject,
  findSessionOwner,
  findSessionProject,
} from './directory';
import { findOwnedWorkspace } from './directory-workspaces';
import type { Env } from './env';
import type { ProjectRecord, WorkspaceRecord } from './owner-records';
import type { ProjectStore } from './project-store';
import { type RecordWait, measured } from './timed-call';

export type SessionOwner = { readonly ownerId: string } & { readonly sessionOwner: unique symbol };

export type KeyProject = {
  project: DurableObjectStub<ProjectStore>;
  keyDigest: string;
  timeZone: string;
  agentNudge: boolean;
  sessionClientName: string | null;
};

type McpSessionLookup = { sessionId: string; now: number };

type CheckedProject = { projectId: string; ownedProjectId: string | null };

const resolvedOwners = new WeakSet<SessionOwner>();
const checkedProjects = new WeakMap<SessionOwner, CheckedProject>();

function isBlankSecret(secret: unknown): boolean {
  return typeof secret !== 'string' || secret.trim() === '';
}

function openProject({ env, projectId }: { env: Env; projectId: string }): DurableObjectStub<ProjectStore> {
  return env.PROJECT_STORE.get(env.PROJECT_STORE.idFromName(projectId));
}

function resolvedOwnerOf(ownerId: string): SessionOwner {
  const owner = Object.freeze({ ownerId }) as SessionOwner;
  resolvedOwners.add(owner);
  return owner;
}

function timedStub({ stub, record }: { stub: DurableObjectStub<ProjectStore>; record: RecordWait }): DurableObjectStub<ProjectStore> {
  return new Proxy(stub, {
    get(target, property) {
      const member = Reflect.get(target, property);
      if (typeof member !== 'function' || typeof property === 'symbol' || property === 'then') return member;
      return (...parameters: unknown[]) => measured({ call: () => Reflect.apply(member, target, parameters), record });
    },
  });
}

export function withTimedProjects({ env, record }: { env: Env; record: RecordWait }): Env {
  const timedNamespace = new Proxy(env.PROJECT_STORE, {
    get(target, property) {
      const member = Reflect.get(target, property);
      if (typeof member !== 'function') return member;
      if (property === 'get') return (id: DurableObjectId) => timedStub({ stub: target.get(id), record });
      return member.bind(target);
    },
  });
  return { ...env, PROJECT_STORE: timedNamespace };
}

export async function openKeyProject({
  env,
  secret,
  mcpSession,
}: {
  env: Env;
  secret: string;
  mcpSession?: McpSessionLookup;
}): Promise<KeyProject | null> {
  if (isBlankSecret(secret)) return null;
  const keyDigest = await digestCredential(secret);
  const { keyProject, sessionClientName } = await findKeyProjectOfSession({ env, keyDigest, mcpSession });
  if (keyProject === null) return null;
  return {
    project: openProject({ env, projectId: keyProject.projectId }),
    keyDigest,
    timeZone: keyProject.timeZone,
    agentNudge: keyProject.agentNudge,
    sessionClientName,
  };
}

async function findKeyProjectOfSession({
  env,
  keyDigest,
  mcpSession,
}: {
  env: Env;
  keyDigest: string;
  mcpSession?: McpSessionLookup;
}): Promise<KeyProjectSessionRecord> {
  if (mcpSession === undefined) {
    return { keyProject: await findKeyProject({ directory: env.DIRECTORY, digest: keyDigest }), sessionClientName: null };
  }
  const { sessionId, now } = mcpSession;
  return findKeyProjectAndSession({ directory: env.DIRECTORY, digest: keyDigest, sessionDigest: await digestCredential(sessionId), now });
}

export async function resolveSessionOwner({
  env,
  secret,
  now,
  projectId,
}: {
  env: Env;
  secret: string;
  now: number;
  projectId?: string;
}): Promise<SessionOwner | null> {
  if (isBlankSecret(secret)) return null;
  const digest = await digestCredential(secret);
  if (projectId === undefined) {
    const ownerId = await findSessionOwner({ directory: env.DIRECTORY, digest, now });
    if (ownerId === null) return null;
    return resolvedOwnerOf(ownerId);
  }
  const sessionProject = await findSessionProject({ directory: env.DIRECTORY, digest, projectId, now });
  if (sessionProject === null) return null;
  const owner = resolvedOwnerOf(sessionProject.ownerId);
  checkedProjects.set(owner, { projectId, ownedProjectId: sessionProject.ownedProjectId });
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
  const checkedProject = checkedProjects.get(owner);
  if (checkedProject !== undefined && checkedProject.projectId === projectId) return checkedProject.ownedProjectId;
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

export type ScheduledOwner = { readonly ownerId: string } & { readonly scheduledOwner: unique symbol };

export type ScheduledProject = { record: ProjectRecord; project: DurableObjectStub<ProjectStore> };

export type ScheduledWorkspace = { workspace: WorkspaceRecord; projects: ScheduledProject[] };

export type DayEmailCandidate = { owner: ScheduledOwner; timeZone: string; minutes: number; address: string };

export async function listDayEmailCandidates(input: { env: Env }): Promise<DayEmailCandidate[]> {
  throw new Error(`listDayEmailCandidates is not implemented for ${typeof input.env}`);
}

export async function listScheduledWorkspaces(input: { env: Env; owner: ScheduledOwner }): Promise<ScheduledWorkspace[] | null> {
  throw new Error(`listScheduledWorkspaces is not implemented for ${input.owner.ownerId}`);
}
