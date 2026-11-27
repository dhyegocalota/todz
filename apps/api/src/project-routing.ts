import type { Language } from '@todz/types';
import { digestCredential } from './credential-digest';
import {
  type GrantProjectRecord,
  type SessionOwnerRecord,
  findOwnedGrantProject,
  findOwnedProject,
  findSessionOwner,
  findSessionProject,
} from './directory';
import { findCandidateRows, findFirstInboxId } from './day-email/day-email-store';
import { ownerLanguageOf } from './directory-owners';
import {
  findOwnedWorkspace,
  findWorkspaceProject,
  listOwnerProjectIds,
  listOwnerWorkspaces,
  listWorkspaceProjects,
} from './directory-workspaces';
import type { Env } from './env';
import { OAuthScope } from './oauth/oauth-scope';
import { findAccessGrant } from './oauth/oauth-store';
import type { ProjectRecord, WorkspaceRecord } from './owner-records';
import type { ProjectStore } from './project-store';
import { type RecordWait, measured } from './timed-call';

export type SessionOwner = { readonly ownerId: string; readonly isSuspended: boolean } & { readonly sessionOwner: unique symbol };

export type SiblingProject = { record: ProjectRecord; project: DurableObjectStub<ProjectStore> };

export type GrantWorkspace = {
  projectId: string;
  listProjects: () => Promise<ProjectRecord[]>;
  openSibling: (projectId: string) => Promise<SiblingProject | null>;
};

export type GrantProject = {
  project: DurableObjectStub<ProjectStore>;
  workspace: GrantWorkspace;
  timeZone: string;
  agentNudge: boolean;
  ownerId: string;
  isSuspended: boolean;
};

type CheckedProject = { projectId: string; ownedProjectId: string | null };

const resolvedOwners = new WeakSet<SessionOwner>();
const storedLanguages = new WeakMap<SessionOwner, Language>();
const checkedProjects = new WeakMap<SessionOwner, CheckedProject>();

function isBlankSecret(secret: unknown): boolean {
  return typeof secret !== 'string' || secret.trim() === '';
}

function openProject({ env, projectId }: { env: Env; projectId: string }): DurableObjectStub<ProjectStore> {
  return env.PROJECT_STORE.get(env.PROJECT_STORE.idFromName(projectId));
}

function resolvedOwnerOf({ ownerId, isSuspended }: { ownerId: string; isSuspended: boolean }): SessionOwner {
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

// NB ADR 0109: a project grant reaches only the projects of its own workspace, found by the workspace id its project joined to.
function grantWorkspaceOf({ env, record }: { env: Env; record: GrantProjectRecord }): GrantWorkspace {
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

function grantProjectOf({ env, record }: { env: Env; record: GrantProjectRecord }): GrantProject {
  return {
    project: openProject({ env, projectId: record.projectId }),
    workspace: grantWorkspaceOf({ env, record }),
    timeZone: record.timeZone,
    agentNudge: record.agentNudge,
    ownerId: record.ownerId,
    isSuspended: record.isSuspended,
  };
}

type OAuthAccessBase = { grantId: string; clientName: string };

export type OAuthAccess =
  | (OAuthAccessBase & { scope: OAuthScope.Project; grantProject: GrantProject })
  | (OAuthAccessBase & { scope: OAuthScope.Owner; owner: SessionOwner });

// NB ADR 0109: an access token resolves to the one project it was granted or to the one owner of its grant, and to nothing else.
export async function openOAuthAccess({ env, secret, now }: { env: Env; secret: string; now: number }): Promise<OAuthAccess | null> {
  if (isBlankSecret(secret)) return null;
  const tokenDigest = await digestCredential(secret);
  const grant = await findAccessGrant({ directory: env.DIRECTORY, digest: tokenDigest, now });
  if (grant === null) return null;
  const { grantId, clientName, ownerId, isSuspended, timeZone, agentNudge, projectId, workspaceId } = grant;
  if (projectId === null) return { scope: OAuthScope.Owner, grantId, clientName, owner: resolvedOwnerOf({ ownerId, isSuspended }) };
  if (workspaceId === null) throw new Error('a project grant reached no workspace');
  const record = { projectId, workspaceId, timeZone, agentNudge, ownerId, isSuspended };
  return {
    scope: OAuthScope.Project,
    grantId,
    clientName,
    grantProject: grantProjectOf({ env, record }),
  };
}

function sessionOwnerOf(record: SessionOwnerRecord): SessionOwner {
  const owner = resolvedOwnerOf(record);
  storedLanguages.set(owner, record.language);
  return owner;
}

export function storedLanguageOf({ owner }: { owner: SessionOwner }): Language {
  const language = storedLanguages.get(owner);
  if (language === undefined) throw new Error('a session owner carries the language it was stored with');
  return language;
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
    return sessionOwnerOf(sessionOwner);
  }
  const sessionProject = await findSessionProject({ directory: env.DIRECTORY, digest, projectId, now });
  if (sessionProject === null) return null;
  const owner = sessionOwnerOf(sessionProject);
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

// NB ADR 0115: an owner grant reaches a project's tasks only when the project's workspace belongs to the grant's owner.
export async function openOwnedGrantProject({
  env,
  owner,
  projectId,
}: {
  env: Env;
  owner: SessionOwner;
  projectId: string;
}): Promise<GrantProject | null> {
  if (!resolvedOwners.has(owner)) return null;
  const record = await findOwnedGrantProject({ directory: env.DIRECTORY, ownerId: owner.ownerId, projectId });
  if (record === null) return null;
  return grantProjectOf({ env, record });
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

export type DayEmailCandidate = { owner: ScheduledOwner; timeZone: string; minutes: number; address: string; language: Language };

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
    language: ownerLanguageOf(row.language),
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
