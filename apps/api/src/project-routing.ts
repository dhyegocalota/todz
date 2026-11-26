import { digestCredential } from './credential-digest';
import {
  type KeyProjectRecord,
  type KeyProjectSessionRecord,
  type SessionOwnerRecord,
  findKeyProject,
  findKeyProjectAndSession,
  findOwnedProject,
  findSessionOwner,
  findSessionProject,
} from './directory';
import { findCandidateRows, findFirstInboxId } from './day-email/day-email-store';
import { findKeyOwner } from './directory-owner-keys';
import {
  findOwnedWorkspace,
  findWorkspaceProject,
  listOwnerProjectIds,
  listOwnerWorkspaces,
  listWorkspaceProjects,
} from './directory-workspaces';
import type { Env } from './env';
import type { ProjectRecord, WorkspaceRecord } from './owner-records';
import type { ProjectStore } from './project-store';
import { type RecordWait, measured } from './timed-call';

export type SessionOwner = { readonly ownerId: string; readonly isSuspended: boolean } & { readonly sessionOwner: unique symbol };

export type SiblingProject = { record: ProjectRecord; project: DurableObjectStub<ProjectStore> };

export type KeyWorkspace = {
  projectId: string;
  listProjects: () => Promise<ProjectRecord[]>;
  openSibling: (projectId: string) => Promise<SiblingProject | null>;
};

export type KeyProject = {
  project: DurableObjectStub<ProjectStore>;
  workspace: KeyWorkspace;
  keyDigest: string;
  timeZone: string;
  agentNudge: boolean;
  ownerId: string;
  isSuspended: boolean;
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

function resolvedOwnerOf({ ownerId, isSuspended }: SessionOwnerRecord): SessionOwner {
  const owner = Object.freeze({ ownerId, isSuspended }) as SessionOwner;
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

// NB ADR 0101: a key reaches only the projects of its own workspace, found by the workspace id its key row joined to.
function keyWorkspaceOf({ env, record }: { env: Env; record: KeyProjectRecord }): KeyWorkspace {
  const { projectId, workspaceId } = record;
  return {
    projectId,
    listProjects: () => listWorkspaceProjects({ directory: env.DIRECTORY, workspaceId }),
    openSibling: async (siblingId) => {
      if (siblingId === projectId) return null;
      const sibling = await findWorkspaceProject({ directory: env.DIRECTORY, workspaceId, projectId: siblingId });
      if (sibling === null) return null;
      return { record: sibling, project: openProject({ env, projectId: sibling.id }) };
    },
  };
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
    workspace: keyWorkspaceOf({ env, record: keyProject }),
    keyDigest,
    timeZone: keyProject.timeZone,
    agentNudge: keyProject.agentNudge,
    ownerId: keyProject.ownerId,
    isSuspended: keyProject.isSuspended,
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
    const sessionOwner = await findSessionOwner({ directory: env.DIRECTORY, digest, now });
    if (sessionOwner === null) return null;
    return resolvedOwnerOf(sessionOwner);
  }
  const sessionProject = await findSessionProject({ directory: env.DIRECTORY, digest, projectId, now });
  if (sessionProject === null) return null;
  const owner = resolvedOwnerOf(sessionProject);
  checkedProjects.set(owner, { projectId, ownedProjectId: sessionProject.ownedProjectId });
  return owner;
}

export type OwnerKeyAccess = { owner: SessionOwner; keyDigest: string };

// NB ADR 0101: an owner key resolves to the one owner of its row and to nothing else; it is looked up in its own table, never in the project keys.
export async function openOwnerKey({ env, secret }: { env: Env; secret: string }): Promise<OwnerKeyAccess | null> {
  if (isBlankSecret(secret)) return null;
  const keyDigest = await digestCredential(secret);
  const keyOwner = await findKeyOwner({ directory: env.DIRECTORY, digest: keyDigest });
  if (keyOwner === null) return null;
  return { owner: resolvedOwnerOf(keyOwner), keyDigest };
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

export async function wipeProjectStorage({ env, projectId }: { env: Env; projectId: string }): Promise<void> {
  await openProject({ env, projectId }).wipe();
}

export async function closeSessionSockets({ env, owner, secret }: { env: Env; owner: SessionOwner; secret: string }): Promise<void> {
  if (!resolvedOwners.has(owner)) return;
  const [projectIds, sessionDigest] = await Promise.all([
    listOwnerProjectIds({ directory: env.DIRECTORY, ownerId: owner.ownerId }),
    digestCredential(secret),
  ]);
  await Promise.all(projectIds.map((projectId) => openProject({ env, projectId }).closeSessionSockets({ sessionDigest })));
}

export type ScheduledOwner = { readonly ownerId: string } & { readonly scheduledOwner: unique symbol };

export type ScheduledProject = { record: ProjectRecord; project: DurableObjectStub<ProjectStore> };

export type ScheduledWorkspace = { workspace: WorkspaceRecord; projects: ScheduledProject[] };

export type DayEmailCandidate = { owner: ScheduledOwner; timeZone: string; minutes: number; address: string };

const scheduledOwners = new WeakSet<ScheduledOwner>();

function scheduledOwnerOf(ownerId: string): ScheduledOwner {
  const owner = Object.freeze({ ownerId }) as ScheduledOwner;
  scheduledOwners.add(owner);
  return owner;
}

// NB ADR 0063: only the candidates query makes a scheduled owner, and only that owner's own projects are listed and opened.
export async function listDayEmailCandidates({ env, now }: { env: Env; now: number }): Promise<DayEmailCandidate[]> {
  const rows = await findCandidateRows({ directory: env.DIRECTORY, now });
  return rows.map((row) => ({
    owner: scheduledOwnerOf(row.owner_id),
    timeZone: row.time_zone,
    minutes: row.day_email_minutes,
    address: row.address,
  }));
}

export async function listScheduledWorkspaces({ env, owner }: { env: Env; owner: ScheduledOwner }): Promise<ScheduledWorkspace[] | null> {
  if (!scheduledOwners.has(owner)) return null;
  const listings = await listOwnerWorkspaces({ directory: env.DIRECTORY, ownerId: owner.ownerId });
  return listings.map(({ workspace, projects }) => ({
    workspace,
    projects: projects.map((record) => ({ record, project: openProject({ env, projectId: record.id }) })),
  }));
}

// NB ADR 0082: only the nightly metrics run lists projects across owners, and it reads counts from them, never a title or a note.
export async function listMetricsProjects({ env, limit }: { env: Env; limit: number }): Promise<DurableObjectStub<ProjectStore>[]> {
  const { results } = await env.DIRECTORY.prepare('SELECT id FROM projects ORDER BY created_at, id LIMIT ?')
    .bind(limit)
    .all<{ id: string }>();
  return results.map(({ id }) => openProject({ env, projectId: id }));
}

export type ReplyOwner = { readonly ownerId: string } & { readonly replyOwner: unique symbol };

const replyOwners = new WeakSet<ReplyOwner>();

// NB ADR 0064: only the reply module makes a reply owner, after the recipient, authentication, sender and addressing checks, and only that owner's first Inbox is opened.
export function replyOwnerOf(ownerId: string): ReplyOwner {
  const owner = Object.freeze({ ownerId }) as ReplyOwner;
  replyOwners.add(owner);
  return owner;
}

export async function openReplyInbox({ env, owner }: { env: Env; owner: ReplyOwner }): Promise<DurableObjectStub<ProjectStore> | null> {
  if (!replyOwners.has(owner)) return null;
  const inboxId = await findFirstInboxId({ directory: env.DIRECTORY, ownerId: owner.ownerId });
  if (inboxId === null) return null;
  return openProject({ env, projectId: inboxId });
}
