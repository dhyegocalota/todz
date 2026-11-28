import { env } from 'cloudflare:workers';
import { describe, expect, test } from 'vitest';
import { digestCredential } from '../../src/credential-digest';
import { GrantScopeKind, type SelectionScope } from '../../src/oauth/oauth-grant-scope';
import { seedOwner, seedOwnerToken, seedProject, seedSelectionToken, seedSiblingProject } from '../directory-seed';

type ScopeRow = { kind: string; workspace_id: string | null; project_id: string | null };

async function grantIdOf(secret: string): Promise<string> {
  const row = await env.DIRECTORY.prepare('SELECT grant_id FROM oauth_tokens WHERE digest = ?')
    .bind(await digestCredential(secret))
    .first<{ grant_id: string }>();
  return row!.grant_id;
}

async function scopesOf(grantId: string): Promise<ScopeRow[]> {
  const { results } = await env.DIRECTORY.prepare('SELECT kind, workspace_id, project_id FROM oauth_grant_scopes WHERE grant_id = ?')
    .bind(grantId)
    .all<ScopeRow>();
  return results;
}

async function grantExists(grantId: string): Promise<boolean> {
  const row = await env.DIRECTORY.prepare('SELECT 1 AS found FROM oauth_grants WHERE id = ?').bind(grantId).first();
  return row !== null;
}

async function tokenCount(grantId: string): Promise<number> {
  const row = await env.DIRECTORY.prepare('SELECT count(*) AS total FROM oauth_tokens WHERE grant_id = ?')
    .bind(grantId)
    .first<{ total: number }>();
  return row!.total;
}

async function workspaceOf(projectId: string): Promise<string> {
  const row = await env.DIRECTORY.prepare('SELECT workspace_id FROM projects WHERE id = ?')
    .bind(projectId)
    .first<{ workspace_id: string }>();
  return row!.workspace_id;
}

async function deleteWorkspaceWithProjects(workspaceId: string): Promise<void> {
  await env.DIRECTORY.batch([
    env.DIRECTORY.prepare('DELETE FROM projects WHERE workspace_id = ?').bind(workspaceId),
    env.DIRECTORY.prepare('DELETE FROM workspaces WHERE id = ?').bind(workspaceId),
  ]);
}

function insertScope({
  grantId,
  kind,
  workspaceId,
  projectId,
}: {
  grantId: string;
  kind: string;
  workspaceId: string | null;
  projectId: string | null;
}) {
  return env.DIRECTORY.prepare('INSERT INTO oauth_grant_scopes (grant_id, kind, workspace_id, project_id) VALUES (?, ?, ?, ?)')
    .bind(grantId, kind, workspaceId, projectId)
    .run();
}

function projectScope(projectId: string): SelectionScope {
  return { kind: GrantScopeKind.Project, projectId };
}

function workspaceScope(workspaceId: string): SelectionScope {
  return { kind: GrantScopeKind.Workspace, workspaceId };
}

async function accountGrant(): Promise<{ ownerId: string; grantId: string }> {
  const ownerId = await seedOwner();
  return { ownerId, grantId: await grantIdOf(await seedOwnerToken({ ownerId })) };
}

describe('what a scope row may hold', () => {
  test('an account scope holds neither a workspace nor a project', async () => {
    const { grantId } = await accountGrant();
    const projectId = await seedProject({ ownerId: await seedOwner() });

    await expect(insertScope({ grantId, kind: 'account', workspaceId: null, projectId })).rejects.toThrow();
    await expect(insertScope({ grantId, kind: 'account', workspaceId: await workspaceOf(projectId), projectId: null })).rejects.toThrow();
  });

  test('a workspace scope holds only a workspace', async () => {
    const { ownerId, grantId } = await accountGrant();
    const projectId = await seedProject({ ownerId });

    await expect(insertScope({ grantId, kind: 'workspace', workspaceId: null, projectId: null })).rejects.toThrow();
    await expect(insertScope({ grantId, kind: 'workspace', workspaceId: await workspaceOf(projectId), projectId })).rejects.toThrow();
  });

  test('a project scope holds only a project', async () => {
    const { ownerId, grantId } = await accountGrant();
    const projectId = await seedProject({ ownerId });

    await expect(insertScope({ grantId, kind: 'project', workspaceId: null, projectId: null })).rejects.toThrow();
    await expect(insertScope({ grantId, kind: 'project', workspaceId: await workspaceOf(projectId), projectId })).rejects.toThrow();
  });

  test('a kind the table does not know is refused', async () => {
    const { grantId } = await accountGrant();

    await expect(insertScope({ grantId, kind: 'team', workspaceId: null, projectId: null })).rejects.toThrow();
  });

  test('one grant holds a target once', async () => {
    const ownerId = await seedOwner();
    const projectId = await seedProject({ ownerId });
    const workspaceId = await workspaceOf(projectId);
    const grantId = await grantIdOf(await seedSelectionToken({ ownerId, scopes: [workspaceScope(workspaceId), projectScope(projectId)] }));

    await expect(insertScope({ grantId, kind: 'workspace', workspaceId, projectId: null })).rejects.toThrow();
    await expect(insertScope({ grantId, kind: 'project', workspaceId: null, projectId })).rejects.toThrow();
  });

  test('the account is held once per grant', async () => {
    const { grantId } = await accountGrant();

    await expect(insertScope({ grantId, kind: 'account', workspaceId: null, projectId: null })).rejects.toThrow();
  });
});

describe('a grant that loses its last scope is deleted, never widened', () => {
  test('deleting the only project of a grant deletes the grant and its tokens', async () => {
    const ownerId = await seedOwner();
    const projectId = await seedProject({ ownerId });
    const grantId = await grantIdOf(await seedSelectionToken({ ownerId, scopes: [projectScope(projectId)] }));

    await env.DIRECTORY.prepare('DELETE FROM projects WHERE id = ?').bind(projectId).run();

    expect(await grantExists(grantId)).toBe(false);
    expect(await tokenCount(grantId)).toBe(0);
  });

  test('deleting the only workspace of a grant deletes the grant and its tokens', async () => {
    const ownerId = await seedOwner();
    const workspaceId = await workspaceOf(await seedProject({ ownerId }));
    const grantId = await grantIdOf(await seedSelectionToken({ ownerId, scopes: [workspaceScope(workspaceId)] }));

    await deleteWorkspaceWithProjects(workspaceId);

    expect(await grantExists(grantId)).toBe(false);
    expect(await tokenCount(grantId)).toBe(0);
  });

  test('a grant that keeps another project survives with that project only', async () => {
    const ownerId = await seedOwner();
    const firstProjectId = await seedProject({ ownerId });
    const secondProjectId = await seedProject({ ownerId });
    const grantId = await grantIdOf(
      await seedSelectionToken({ ownerId, scopes: [projectScope(firstProjectId), projectScope(secondProjectId)] }),
    );

    await env.DIRECTORY.prepare('DELETE FROM projects WHERE id = ?').bind(firstProjectId).run();

    expect(await grantExists(grantId)).toBe(true);
    expect(await scopesOf(grantId)).toEqual([{ kind: 'project', workspace_id: null, project_id: secondProjectId }]);
    expect(await tokenCount(grantId)).toBe(1);
  });

  test('a grant of a workspace and a project elsewhere survives the deletion of the workspace', async () => {
    const ownerId = await seedOwner();
    const firstProjectId = await seedProject({ ownerId });
    const firstWorkspaceId = await workspaceOf(firstProjectId);
    const secondProjectId = await seedProject({ ownerId });
    const grantId = await grantIdOf(
      await seedSelectionToken({ ownerId, scopes: [workspaceScope(firstWorkspaceId), projectScope(secondProjectId)] }),
    );

    await deleteWorkspaceWithProjects(firstWorkspaceId);

    expect(await scopesOf(grantId)).toEqual([{ kind: 'project', workspace_id: null, project_id: secondProjectId }]);
  });

  test('a grant of a workspace and one of its projects is deleted with the workspace', async () => {
    const ownerId = await seedOwner();
    const projectId = await seedProject({ ownerId });
    const siblingId = await seedSiblingProject({ projectId, name: 'Second' });
    const workspaceId = await workspaceOf(projectId);
    const grantId = await grantIdOf(await seedSelectionToken({ ownerId, scopes: [workspaceScope(workspaceId), projectScope(siblingId)] }));

    await deleteWorkspaceWithProjects(workspaceId);

    expect(await grantExists(grantId)).toBe(false);
  });

  test('the account grant of an owner is never touched by the deletion of a project', async () => {
    const { ownerId, grantId } = await accountGrant();
    const projectId = await seedProject({ ownerId });

    await env.DIRECTORY.prepare('DELETE FROM projects WHERE id = ?').bind(projectId).run();

    expect(await grantExists(grantId)).toBe(true);
    expect(await scopesOf(grantId)).toEqual([{ kind: 'account', workspace_id: null, project_id: null }]);
  });
});
