import { JSONRPC_VERSION } from '@modelcontextprotocol/server';
import { MILLISECONDS_PER_DAY, MILLISECONDS_PER_MINUTE } from '@todz/types';
import { env } from 'cloudflare:workers';
import { describe, expect, test } from 'vitest';
import { generateCredentialSecret } from '../../src/credential-secret';
import { serveMcp } from '../../src/mcp-endpoint';
import { MCP_COPY } from '../../src/mcp-copy';
import { seedProject, seedSession, seedSiblingProject } from '../directory-seed';
import { ClientEra, callTool, connectClient } from '../mcp-client';
import { ownerCall } from '../owner-client';
import { CLOCK_NOW } from '../task-fixtures';
import {
  type SeededOwner,
  connectedClient,
  firstChoice,
  mcpRequest,
  oauthEnv,
  projectChoiceOf,
  refreshRequest,
  seededOwner,
  serveOAuthRequest,
  workspaceChoiceOf,
} from './oauth-client';

const TOOLS_LIST_BODY = { jsonrpc: JSONRPC_VERSION, id: 1, method: 'tools/list', params: {} };
const LINK_WINDOW_MS = 16 * MILLISECONDS_PER_MINUTE;

type ConnectedAppJson = {
  id: string;
  client_name: string;
  redirect_host: string;
  scope: string;
  project_id: string | null;
  project_name: string | null;
  created_at: number;
  last_used_at: number | null;
};

async function sessionOf(owner: SeededOwner): Promise<string> {
  const secret = generateCredentialSecret();
  await seedSession({ ownerId: owner.ownerId, secret, expiresAt: Date.now() + MILLISECONDS_PER_DAY });
  return secret;
}

async function connectedApps(token: string): Promise<ConnectedAppJson[]> {
  const response = await ownerCall({ method: 'GET', path: '/owner/connected-apps', token });
  expect(response.status).toBe(200);
  return ((await response.json()) as { connected_apps: ConnectedAppJson[] }).connected_apps;
}

describe('Connected apps', () => {
  test('lists the owner grants with the app, the redirect host, the scope and the project', async () => {
    const owner = await seededOwner();
    await connectedClient({ choiceOf: firstChoice, email: owner.email });
    await connectedClient({ choiceOf: () => 'owner', email: owner.email });

    const apps = await connectedApps(await sessionOf(owner));

    expect(apps).toHaveLength(2);
    expect(apps).toEqual(
      expect.arrayContaining([
        {
          id: expect.any(String),
          client_name: 'Claude Code',
          redirect_host: '127.0.0.1',
          scope: 'project',
          project_id: owner.projectId,
          project_name: 'Project',
          scopes: [
            {
              kind: 'project',
              project_id: owner.projectId,
              project_name: 'Project',
              workspace_id: expect.any(String),
              workspace_name: 'Workspace',
            },
          ],
          created_at: CLOCK_NOW,
          last_used_at: CLOCK_NOW,
        },
        {
          id: expect.any(String),
          client_name: 'Claude Code',
          redirect_host: '127.0.0.1',
          scope: 'owner',
          project_id: null,
          project_name: null,
          scopes: [{ kind: 'account' }],
          created_at: CLOCK_NOW,
          last_used_at: CLOCK_NOW,
        },
      ]),
    );
  });

  test("another owner's grants are not listed", async () => {
    const owner = await seededOwner();
    const stranger = await seededOwner();
    await connectedClient({ choiceOf: firstChoice, email: stranger.email });

    expect(await connectedApps(await sessionOf(owner))).toEqual([]);
  });

  test('disconnecting an app revokes its tokens at once', async () => {
    const owner = await seededOwner();
    const { clientId, tokens } = await connectedClient({ choiceOf: firstChoice, email: owner.email });
    const session = await sessionOf(owner);
    const [app] = await connectedApps(session);

    const response = await ownerCall({ method: 'DELETE', path: `/owner/connected-apps/${app!.id}`, token: session });

    expect(response.status).toBe(204);
    expect(await connectedApps(session)).toEqual([]);
    const mcp = await serveMcp({
      request: mcpRequest({ token: tokens.access_token, body: TOOLS_LIST_BODY }),
      env: oauthEnv(),
      now: CLOCK_NOW,
    });
    expect(mcp.status).toBe(401);
    const refreshed = await serveOAuthRequest({ request: refreshRequest({ clientId, refreshToken: tokens.refresh_token }) });
    expect(refreshed.status).toBe(400);
  });

  test("disconnecting another owner's app answers not found and deletes nothing", async () => {
    const owner = await seededOwner();
    const stranger = await seededOwner();
    const { tokens } = await connectedClient({ choiceOf: firstChoice, email: stranger.email });
    const [strangerApp] = await connectedApps(await sessionOf(stranger));

    const response = await ownerCall({ method: 'DELETE', path: `/owner/connected-apps/${strangerApp!.id}`, token: await sessionOf(owner) });

    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ error: 'not_found' });
    const mcp = await serveMcp({
      request: mcpRequest({ token: tokens.access_token, body: TOOLS_LIST_BODY }),
      env: oauthEnv(),
      now: CLOCK_NOW,
    });
    expect(mcp.status).toBe(200);
  });

  test('an owner keeps at most 20 grants and a new one evicts the least recently used', async () => {
    const owner = await seededOwner();
    const first = await connectedClient({ choiceOf: firstChoice, email: owner.email, now: CLOCK_NOW });
    await Array.from({ length: 20 }, (_, index) => index + 1).reduce<Promise<unknown>>(
      (previous, step) =>
        previous.then(() => connectedClient({ choiceOf: firstChoice, email: owner.email, now: CLOCK_NOW + step * LINK_WINDOW_MS })),
      Promise.resolve(),
    );

    const apps = await connectedApps(await sessionOf(owner));

    expect(apps).toHaveLength(20);
    const mcp = await serveMcp({
      request: mcpRequest({ token: first.tokens.access_token, body: TOOLS_LIST_BODY }),
      env: oauthEnv(),
      now: CLOCK_NOW + 30,
    });
    expect(mcp.status).toBe(401);
  });
});

type ScopeJson = {
  kind: string;
  workspace_id?: string;
  workspace_name?: string;
  project_id?: string;
  project_name?: string;
};

type Tree = {
  owner: SeededOwner;
  session: string;
  siblingId: string;
  otherProjectId: string;
  workspaceId: string;
  otherWorkspaceId: string;
};

async function workspaceIdOf(projectId: string): Promise<string> {
  const row = await env.DIRECTORY.prepare('SELECT workspace_id FROM projects WHERE id = ?')
    .bind(projectId)
    .first<{ workspace_id: string }>();
  return row!.workspace_id;
}

async function rename({ table, id, name }: { table: string; id: string; name: string }): Promise<void> {
  await env.DIRECTORY.prepare(`UPDATE ${table} SET name = ? WHERE id = ?`).bind(name, id).run();
}

async function tree(): Promise<Tree> {
  const owner = await seededOwner();
  const siblingId = await seedSiblingProject({ projectId: owner.projectId, name: 'Website' });
  const otherProjectId = await seedProject({ ownerId: owner.ownerId });
  const workspaceId = await workspaceIdOf(owner.projectId);
  const otherWorkspaceId = await workspaceIdOf(otherProjectId);
  await rename({ table: 'workspaces', id: workspaceId, name: 'Beta' });
  await rename({ table: 'workspaces', id: otherWorkspaceId, name: 'Alpha' });
  return { owner, session: await sessionOf(owner), siblingId, otherProjectId, workspaceId, otherWorkspaceId };
}

function narrow({ session, id, body }: { session: string; id: string; body: unknown }): Promise<Response> {
  return ownerCall({ method: 'PATCH', path: `/owner/connected-apps/${id}`, token: session, body });
}

async function onlyAppOf(session: string): Promise<ConnectedAppJson & { scopes: ScopeJson[] }> {
  const [app] = (await connectedApps(session)) as (ConnectedAppJson & { scopes: ScopeJson[] })[];
  return app!;
}

function projectScopeOf(projectId: string): { kind: string; project_id: string } {
  return { kind: 'project', project_id: projectId };
}

function workspaceScopeOf(workspaceId: string): { kind: string; workspace_id: string } {
  return { kind: 'workspace', workspace_id: workspaceId };
}

describe('Connected apps list the scopes of a grant', () => {
  test('a selection lists the account first, then workspaces by name, then projects by workspace and project name, and the legacy fields say selection', async () => {
    const { owner, session, siblingId, otherProjectId, workspaceId, otherWorkspaceId } = await tree();
    await rename({ table: 'projects', id: otherProjectId, name: 'Zebra' });
    await connectedClient({
      choiceOf: () => [projectChoiceOf(otherProjectId), projectChoiceOf(siblingId), projectChoiceOf(owner.projectId)],
      email: owner.email,
    });

    const app = await onlyAppOf(session);

    expect(app.scope).toBe('selection');
    expect(app.project_id).toBeNull();
    expect(app.project_name).toBeNull();
    expect(app.scopes).toEqual([
      { kind: 'project', project_id: otherProjectId, project_name: 'Zebra', workspace_id: otherWorkspaceId, workspace_name: 'Alpha' },
      { kind: 'project', project_id: owner.projectId, project_name: 'Project', workspace_id: workspaceId, workspace_name: 'Beta' },
      { kind: 'project', project_id: siblingId, project_name: 'Website', workspace_id: workspaceId, workspace_name: 'Beta' },
    ]);
  });

  test('a workspace is listed before the projects, and a renamed workspace shows its new name', async () => {
    const { owner, session, otherProjectId, workspaceId, otherWorkspaceId } = await tree();
    await connectedClient({ choiceOf: () => [projectChoiceOf(otherProjectId), workspaceChoiceOf(workspaceId)], email: owner.email });
    await rename({ table: 'workspaces', id: workspaceId, name: 'Gamma' });

    const app = await onlyAppOf(session);

    expect(app.scope).toBe('selection');
    expect(app.scopes).toEqual([
      { kind: 'workspace', workspace_id: workspaceId, workspace_name: 'Gamma' },
      { kind: 'project', project_id: otherProjectId, project_name: 'Project', workspace_id: otherWorkspaceId, workspace_name: 'Alpha' },
    ]);
  });
});

describe('Narrowing a connected app', () => {
  test('the account narrows to a workspace and a project, the answer is the listed app, and the issued token follows the new set at once', async () => {
    const { owner, session, otherProjectId, workspaceId } = await tree();
    const { tokens } = await connectedClient({ choiceOf: () => 'owner', email: owner.email });
    const { id } = await onlyAppOf(session);

    const response = await narrow({ session, id, body: { scopes: [projectScopeOf(otherProjectId), workspaceScopeOf(workspaceId)] } });

    expect(response.status).toBe(200);
    const { connected_app: narrowed } = (await response.json()) as { connected_app: ConnectedAppJson };
    expect(narrowed).toEqual(await onlyAppOf(session));
    expect(narrowed.scope).toBe('selection');
    const client = await connectClient({ era: ClientEra.Modern, token: tokens.access_token });
    const names = (await client.listTools()).tools.map((tool) => tool.name);
    expect(names).not.toContain('create_workspace');
    expect(names).toContain('workspaces');
  });

  test('a token of the narrowed grant is refused outside the new set', async () => {
    const { owner, session, otherProjectId } = await tree();
    const { tokens } = await connectedClient({ choiceOf: () => 'owner', email: owner.email });
    const { id } = await onlyAppOf(session);
    await narrow({ session, id, body: { scopes: [projectScopeOf(otherProjectId), projectScopeOf(owner.projectId)] } });
    const client = await connectClient({ era: ClientEra.Modern, token: tokens.access_token });
    const outside = await seedProject({ ownerId: owner.ownerId });

    const refused = await callTool({ client, name: 'list', args: { project: outside } });

    expect(refused).toEqual({ text: MCP_COPY.accountNotFound, isError: true });
  });

  test('a workspace narrows to some of its projects, and a single project answers as a project', async () => {
    const { owner, session, workspaceId } = await tree();
    await connectedClient({ choiceOf: () => workspaceChoiceOf(workspaceId), email: owner.email });
    const { id } = await onlyAppOf(session);

    const response = await narrow({ session, id, body: { scopes: [projectScopeOf(owner.projectId)] } });

    expect(response.status).toBe(200);
    const app = await onlyAppOf(session);
    expect(app.scope).toBe('project');
    expect(app.project_id).toBe(owner.projectId);
  });

  test('a workspace plus one of its own projects is folded into the workspace', async () => {
    const { owner, session, workspaceId } = await tree();
    await connectedClient({ choiceOf: () => 'owner', email: owner.email });
    const { id } = await onlyAppOf(session);

    const response = await narrow({ session, id, body: { scopes: [workspaceScopeOf(workspaceId), projectScopeOf(owner.projectId)] } });

    expect(response.status).toBe(200);
    expect((await onlyAppOf(session)).scopes).toEqual([{ kind: 'workspace', workspace_id: workspaceId, workspace_name: 'Beta' }]);
  });

  test('keeping the same scopes is allowed', async () => {
    const { owner, session } = await tree();
    await connectedClient({ choiceOf: () => 'owner', email: owner.email });
    const { id } = await onlyAppOf(session);

    const response = await narrow({ session, id, body: { scopes: [{ kind: 'account' }] } });

    expect(response.status).toBe(200);
    expect((await onlyAppOf(session)).scopes).toEqual([{ kind: 'account' }]);
  });

  test.each([
    [
      'a project to another project',
      (tree: Tree) => projectChoiceOf(tree.owner.projectId),
      (tree: Tree) => [projectScopeOf(tree.siblingId)],
    ],
    [
      'a project to its own workspace',
      (tree: Tree) => projectChoiceOf(tree.owner.projectId),
      (tree: Tree) => [workspaceScopeOf(tree.workspaceId)],
    ],
    [
      'a workspace to another workspace',
      (tree: Tree) => workspaceChoiceOf(tree.workspaceId),
      (tree: Tree) => [workspaceScopeOf(tree.otherWorkspaceId)],
    ],
    [
      'a workspace to a project elsewhere',
      (tree: Tree) => workspaceChoiceOf(tree.workspaceId),
      (tree: Tree) => [projectScopeOf(tree.otherProjectId)],
    ],
    ['a workspace to the account', (tree: Tree) => workspaceChoiceOf(tree.workspaceId), () => [{ kind: 'account' }]],
    ['a selection to the account', (tree: Tree) => projectChoiceOf(tree.owner.projectId), () => [{ kind: 'account' }]],
  ])('%s is not narrower', async (_name, choiceOf, scopesOf) => {
    const current = await tree();
    await connectedClient({ choiceOf: () => choiceOf(current), email: current.owner.email });
    const before = await onlyAppOf(current.session);

    const response = await narrow({ session: current.session, id: before.id, body: { scopes: scopesOf(current) } });

    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({ error: 'scope_not_narrower' });
    expect(await onlyAppOf(current.session)).toEqual(before);
  });

  test('a scope naming a project or workspace of another owner is not narrower, even for the account', async () => {
    const { owner, session } = await tree();
    const stranger = await seededOwner();
    await connectedClient({ choiceOf: () => 'owner', email: owner.email });
    const { id } = await onlyAppOf(session);

    const foreignProject = await narrow({ session, id, body: { scopes: [projectScopeOf(stranger.projectId)] } });
    const foreignWorkspace = await narrow({ session, id, body: { scopes: [workspaceScopeOf(await workspaceIdOf(stranger.projectId))] } });
    const unknownProject = await narrow({ session, id, body: { scopes: [projectScopeOf(crypto.randomUUID())] } });

    [foreignProject, foreignWorkspace, unknownProject].forEach((response) => expect(response.status).toBe(422));
    expect((await onlyAppOf(session)).scopes).toEqual([{ kind: 'account' }]);
  });

  test.each([
    ['an empty set', { scopes: [] }],
    ['no scopes', {}],
    ['the account mixed with a project', { scopes: [{ kind: 'account' }, { kind: 'project', project_id: 'x' }] }],
    ['an unknown kind', { scopes: [{ kind: 'team', team_id: 'x' }] }],
    ['a project with no id', { scopes: [{ kind: 'project' }] }],
    ['a workspace with no id', { scopes: [{ kind: 'workspace' }] }],
    ['a body that is not an object', ['account']],
  ])('%s is an invalid request and changes nothing', async (_name, body) => {
    const { owner, session } = await tree();
    await connectedClient({ choiceOf: () => 'owner', email: owner.email });
    const before = await onlyAppOf(session);

    const response = await narrow({ session, id: before.id, body });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: 'invalid_request' });
    expect(await onlyAppOf(session)).toEqual(before);
  });

  test('an unknown id answers not found', async () => {
    const { session } = await tree();

    const response = await narrow({ session, id: crypto.randomUUID(), body: { scopes: [{ kind: 'account' }] } });

    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ error: 'not_found' });
  });

  test("another owner's grant answers not found and keeps its scopes", async () => {
    const { owner, session, otherProjectId } = await tree();
    const stranger = await seededOwner();
    await connectedClient({ choiceOf: () => 'owner', email: stranger.email });
    const strangerSession = await sessionOf(stranger);
    const { id } = await onlyAppOf(strangerSession);
    await connectedClient({ choiceOf: () => 'owner', email: owner.email });

    const response = await narrow({ session, id, body: { scopes: [projectScopeOf(otherProjectId)] } });

    expect(response.status).toBe(404);
    expect((await onlyAppOf(strangerSession)).scopes).toEqual([{ kind: 'account' }]);
  });

  test('narrowing never leaves a grant with no scope: the grant stays whole after a refused empty set', async () => {
    const { owner, session } = await tree();
    const { tokens } = await connectedClient({ choiceOf: () => 'owner', email: owner.email });
    const { id } = await onlyAppOf(session);

    await narrow({ session, id, body: { scopes: [] } });

    const mcp = await serveMcp({
      request: mcpRequest({ token: tokens.access_token, body: TOOLS_LIST_BODY }),
      env: oauthEnv(),
      now: CLOCK_NOW,
    });
    expect(mcp.status).toBe(200);
  });
});
