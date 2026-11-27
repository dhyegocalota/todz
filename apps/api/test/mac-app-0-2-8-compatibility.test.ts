import { MILLISECONDS_PER_DAY } from '@todz/types';
import { env } from 'cloudflare:workers';
import { describe, expect, test } from 'vitest';
import { z } from 'zod';
import { generateCredentialSecret } from '../src/credential-secret';
import { seedProject, seedSession, seedSiblingProject } from './directory-seed';
import { askedLink, redeemLink, requestLink } from './email-sign-in-client';
import { type SeededOwner, seededOwner } from './oauth/oauth-client';
import { ownerCall } from './owner-client';
import { CLOCK_NOW } from './task-fixtures';

const CLIENT_ID_LENGTH = 43;
const REDIRECT_URI = 'https://claude.ai/api/mcp/auth_callback';
const CREATED_STATUS = 201;
const ACCEPTED_STATUS = 202;
const NO_CONTENT_STATUS = 204;
const VISIBLE_WORKSPACE_NAME = 'Thrifty Traveler';
const HIDDEN_WORKSPACE_NAME = 'Secret Garden';

const IssuedSessionSchema = z.object({ session_token: z.string(), owner: z.object({ id: z.string() }).passthrough() });

const ConnectedAppSchema = z.discriminatedUnion('scope', [
  z.object({
    id: z.string(),
    client_name: z.string(),
    redirect_host: z.string(),
    scope: z.literal('owner'),
    created_at: z.number(),
    last_used_at: z.number(),
  }),
  z.object({
    id: z.string(),
    client_name: z.string(),
    redirect_host: z.string(),
    scope: z.literal('project'),
    project_id: z.string(),
    project_name: z.string(),
    created_at: z.number(),
    last_used_at: z.number(),
  }),
]);

const ConnectedAppsAnswerSchema = z.object({ connected_apps: z.array(ConnectedAppSchema) });

type ScopeRow = { kind: 'account' | 'workspace' | 'project'; workspaceId: string | null; projectId: string | null };

async function sessionOf(owner: SeededOwner): Promise<string> {
  const secret = generateCredentialSecret();
  await seedSession({ ownerId: owner.ownerId, secret, expiresAt: Date.now() + MILLISECONDS_PER_DAY });
  return secret;
}

type ConnectedApp = z.output<typeof ConnectedAppSchema>;

function lockedVisibleApps({ apps, visibleProjectIds }: { apps: ConnectedApp[]; visibleProjectIds: string[] }): ConnectedApp[] {
  return apps.filter((app) => app.scope === 'owner' || visibleProjectIds.includes(app.project_id));
}

async function nameWorkspaceOf({ projectId, name }: { projectId: string; name: string }): Promise<void> {
  await env.DIRECTORY.prepare('UPDATE workspaces SET name = ? WHERE id = (SELECT workspace_id FROM projects WHERE id = ?)')
    .bind(name, projectId)
    .run();
}

async function workspaceOf(projectId: string): Promise<string> {
  const row = await env.DIRECTORY.prepare('SELECT workspace_id FROM projects WHERE id = ?')
    .bind(projectId)
    .first<{ workspace_id: string }>();
  return row!.workspace_id;
}

async function seedGrant({ owner, scopes }: { owner: SeededOwner; scopes: ScopeRow[] }): Promise<string> {
  const clientId = generateCredentialSecret().slice(0, CLIENT_ID_LENGTH);
  const grantId = crypto.randomUUID();
  await env.DIRECTORY.batch([
    env.DIRECTORY.prepare('INSERT INTO oauth_clients (id, name, redirect_uris, created_at, active_at) VALUES (?, ?, ?, ?, ?)').bind(
      clientId,
      'Claude',
      JSON.stringify([REDIRECT_URI]),
      CLOCK_NOW,
      CLOCK_NOW,
    ),
    env.DIRECTORY.prepare(
      'INSERT INTO oauth_grants (id, client_id, owner_id, project_id, redirect_uri, created_at, last_used_at) VALUES (?, ?, ?, NULL, ?, ?, ?)',
    ).bind(grantId, clientId, owner.ownerId, REDIRECT_URI, CLOCK_NOW, CLOCK_NOW),
    ...scopes.map((scope) =>
      env.DIRECTORY.prepare('INSERT INTO oauth_grant_scopes (grant_id, kind, workspace_id, project_id) VALUES (?, ?, ?, ?)').bind(
        grantId,
        scope.kind,
        scope.workspaceId,
        scope.projectId,
      ),
    ),
  ]);
  return grantId;
}

describe('the Worker keeps answering the Mac app 0.2.8 the way its decoders expect', () => {
  test('a link sign-in without any email code signs in exactly as before', async () => {
    const link = await askedLink();

    const response = await redeemLink({ token: link.token, verifier: link.verifier });

    expect(response.status).toBe(CREATED_STATUS);
    expect(IssuedSessionSchema.safeParse(await response.json()).success).toBe(true);
  });

  test('every connected app decodes under the 0.2.8 shape, a selection included', async () => {
    const owner = await seededOwner();
    const otherProjectId = await seedProject({ ownerId: owner.ownerId });
    const siblingId = await seedSiblingProject({ projectId: owner.projectId, name: 'Website' });
    await seedGrant({ owner, scopes: [{ kind: 'account', workspaceId: null, projectId: null }] });
    await seedGrant({ owner, scopes: [{ kind: 'project', workspaceId: null, projectId: owner.projectId }] });
    await seedGrant({
      owner,
      scopes: [
        { kind: 'project', workspaceId: null, projectId: siblingId },
        { kind: 'project', workspaceId: null, projectId: otherProjectId },
      ],
    });
    await seedGrant({ owner, scopes: [{ kind: 'workspace', workspaceId: await workspaceOf(otherProjectId), projectId: null }] });

    const response = await ownerCall({ method: 'GET', path: '/owner/connected-apps', token: await sessionOf(owner) });

    const answer = ConnectedAppsAnswerSchema.parse(await response.json());
    expect(answer.connected_apps).toHaveLength(4);
  });

  test('a locked 0.2.8 that sees one workspace never shows a selection reaching into another, nor its names', async () => {
    const owner = await seededOwner();
    const hiddenProjectId = await seedProject({ ownerId: owner.ownerId });
    await nameWorkspaceOf({ projectId: owner.projectId, name: VISIBLE_WORKSPACE_NAME });
    await nameWorkspaceOf({ projectId: hiddenProjectId, name: HIDDEN_WORKSPACE_NAME });
    await seedGrant({
      owner,
      scopes: [
        { kind: 'project', workspaceId: null, projectId: owner.projectId },
        { kind: 'project', workspaceId: null, projectId: hiddenProjectId },
      ],
    });

    const response = await ownerCall({ method: 'GET', path: '/owner/connected-apps', token: await sessionOf(owner) });

    const [app] = ConnectedAppsAnswerSchema.parse(await response.json()).connected_apps;
    expect(lockedVisibleApps({ apps: [app!], visibleProjectIds: [owner.projectId] })).toEqual([]);
    expect(JSON.stringify({ ...app, scopes: undefined })).not.toContain(HIDDEN_WORKSPACE_NAME);
    expect(JSON.stringify({ ...app, scopes: undefined })).not.toContain(VISIBLE_WORKSPACE_NAME);
  });

  test('a locked 0.2.8 still shows a selection that stays inside the visible workspace', async () => {
    const owner = await seededOwner();
    const siblingId = await seedSiblingProject({ projectId: owner.projectId, name: 'Website' });
    await nameWorkspaceOf({ projectId: owner.projectId, name: VISIBLE_WORKSPACE_NAME });
    await seedGrant({
      owner,
      scopes: [
        { kind: 'project', workspaceId: null, projectId: owner.projectId },
        { kind: 'project', workspaceId: null, projectId: siblingId },
      ],
    });

    const response = await ownerCall({ method: 'GET', path: '/owner/connected-apps', token: await sessionOf(owner) });

    const apps = ConnectedAppsAnswerSchema.parse(await response.json()).connected_apps;
    expect(lockedVisibleApps({ apps, visibleProjectIds: [owner.projectId, siblingId] })).toHaveLength(1);
  });

  test('the other calls of 0.2.8 that AUTH touches keep their answers', async () => {
    const owner = await seededOwner();
    const siblingId = await seedSiblingProject({ projectId: owner.projectId, name: 'Website' });
    const grantId = await seedGrant({ owner, scopes: [{ kind: 'project', workspaceId: null, projectId: owner.projectId }] });
    const session = await sessionOf(owner);

    const asked = await requestLink();
    const disconnected = await ownerCall({ method: 'DELETE', path: `/owner/connected-apps/${grantId}`, token: session });
    const deleted = await ownerCall({ method: 'DELETE', path: `/owner/projects/${siblingId}`, token: session });

    expect(asked.status).toBe(ACCEPTED_STATUS);
    expect(await asked.json()).toEqual({});
    expect(disconnected.status).toBe(NO_CONTENT_STATUS);
    expect(deleted.status).toBe(NO_CONTENT_STATUS);
  });
});
