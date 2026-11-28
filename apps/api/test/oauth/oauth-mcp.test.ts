import { JSONRPC_VERSION } from '@modelcontextprotocol/server';
import { env } from 'cloudflare:workers';
import { describe, expect, test } from 'vitest';
import { deleteOwnerProject, deleteOwnerWorkspace } from '../../src/directory-workspaces';
import { MCP_COPY, McpOwnerToolName, McpToolName } from '../../src/mcp-copy';
import { seedProject, seedSiblingProject } from '../directory-seed';
import { ClientEra, callTool, connectClient } from '../mcp-client';
import { ownerCall } from '../owner-client';
import {
  authorizeParams,
  approvedCode,
  clientMetadata,
  consentPage,
  exchangeCode,
  firstChoice,
  pkcePair,
  registerClient,
  seededOwner,
  serveMcpCall,
  signedInBrowser,
  tokensOf,
  type SeededOwner,
  type Tokens,
} from './oauth-client';

const REGISTERED_NAME = 'Cursor';
const ENVELOPE_NAME = 'Claude Code';
const TOOLS_LIST_BODY = { jsonrpc: JSONRPC_VERSION, id: 1, method: 'tools/list', params: {} };

async function grantedTokens({ owner, choiceOf }: { owner: SeededOwner; choiceOf: (html: string) => string | string[] }): Promise<Tokens> {
  const now = Date.now();
  const clientId = await registerClient({ metadata: clientMetadata({ client_name: REGISTERED_NAME }), now });
  const { verifier, challenge } = await pkcePair();
  const params = authorizeParams({ clientId, challenge });
  const browser = await signedInBrowser({ params, email: owner.email, now });
  const choice = choiceOf(await consentPage({ browser, params, now }));
  const code = await approvedCode({ browser, params, choice, now });
  return tokensOf(await exchangeCode({ clientId, code, verifier, now }));
}

function ownerChoice(): string {
  return 'owner';
}

async function toolNames({ era, token }: { era: ClientEra; token: string }): Promise<string[]> {
  const client = await connectClient({ era, token, clientName: ENVELOPE_NAME });
  const { tools } = await client.listTools();
  return tools.map((tool) => tool.name).sort();
}

describe.each([ClientEra.Legacy, ClientEra.Modern])('a %s client with a project-scoped token', (era) => {
  test('sees the task tools of a project key and no account tool', async () => {
    const tokens = await grantedTokens({ owner: await seededOwner(), choiceOf: firstChoice });

    expect(await toolNames({ era, token: tokens.access_token })).toEqual(Object.values(McpToolName).sort());
  });

  test('reads and writes only its project, and the history names the app it approved', async () => {
    const owner = await seededOwner();
    const tokens = await grantedTokens({ owner, choiceOf: firstChoice });
    const client = await connectClient({ era, token: tokens.access_token, clientName: ENVELOPE_NAME });

    await callTool({ client, name: McpToolName.Add, args: { tasks: [{ title: 'Ship OAuth' }] } });
    const history = await callTool({ client, name: McpToolName.History, args: { id: 'T-1' } });

    expect(history.text).toContain(REGISTERED_NAME);
    expect(history.text).not.toContain(ENVELOPE_NAME);
    expect((await callTool({ client, name: McpToolName.List, args: {} })).text).toContain('Ship OAuth');
  });

  test('cannot move a task to a project of another workspace or another owner', async () => {
    const owner = await seededOwner();
    const otherWorkspaceProjectId = await seedProject({ ownerId: owner.ownerId });
    const stranger = await seededOwner();
    const tokens = await grantedTokens({ owner, choiceOf: firstChoice });
    const client = await connectClient({ era, token: tokens.access_token, clientName: ENVELOPE_NAME });
    await callTool({ client, name: McpToolName.Add, args: { tasks: [{ title: 'Stay here' }] } });

    const toOtherWorkspace = await callTool({ client, name: McpToolName.Move, args: { id: 'T-1', project: otherWorkspaceProjectId } });
    const toStranger = await callTool({ client, name: McpToolName.Move, args: { id: 'T-1', project: stranger.projectId } });

    expect(toOtherWorkspace).toEqual({ text: MCP_COPY.projectNotInWorkspace, isError: true });
    expect(toStranger).toEqual({ text: MCP_COPY.projectNotInWorkspace, isError: true });
    expect((await callTool({ client, name: McpToolName.List, args: {} })).text).toContain('Stay here');
  });

  test('reaches the sibling projects of its workspace, as a project key does', async () => {
    const owner = await seededOwner();
    await seedSiblingProject({ projectId: owner.projectId, name: 'Sibling' });
    const tokens = await grantedTokens({ owner, choiceOf: firstChoice });
    const client = await connectClient({ era, token: tokens.access_token, clientName: ENVELOPE_NAME });

    expect((await callTool({ client, name: McpToolName.Projects, args: {} })).text).toContain('Sibling');
  });
});

describe.each([ClientEra.Legacy, ClientEra.Modern])('a %s client with an owner-scoped token', (era) => {
  test('sees the account tools and every task tool but projects', async () => {
    const tokens = await grantedTokens({ owner: await seededOwner(), choiceOf: ownerChoice });
    const taskTools = Object.values(McpToolName).filter((name) => name !== McpToolName.Projects);

    expect(await toolNames({ era, token: tokens.access_token })).toEqual([...Object.values(McpOwnerToolName), ...taskTools].sort());
  });

  test("lists the owner's workspaces and no stranger's", async () => {
    const owner = await seededOwner();
    const stranger = await seededOwner();
    await env.DIRECTORY.prepare('UPDATE workspaces SET name = ? WHERE id = (SELECT workspace_id FROM projects WHERE id = ?)')
      .bind('Stranger workspace', stranger.projectId)
      .run();
    const tokens = await grantedTokens({ owner, choiceOf: ownerChoice });
    const client = await connectClient({ era, token: tokens.access_token, clientName: ENVELOPE_NAME });

    const workspaces = await callTool({ client, name: McpOwnerToolName.Workspaces, args: {} });

    expect(workspaces.text).toContain('Workspace');
    expect(workspaces.text).not.toContain('Stranger workspace');
  });
});

describe('an OAuth token is the equivalent key and nothing more', () => {
  test('a suspended owner gets the suspension refusal', async () => {
    const owner = await seededOwner();
    const tokens = await grantedTokens({ owner, choiceOf: firstChoice });
    await env.DIRECTORY.prepare('UPDATE owners SET suspended_at = ? WHERE id = ?').bind(Date.now(), owner.ownerId).run();

    const response = await serveMcpCall({ token: tokens.access_token, body: TOOLS_LIST_BODY, now: Date.now() });

    expect(response.status).toBe(403);
  });

  test('deleting the project deletes the grant and its token stops working', async () => {
    const owner = await seededOwner();
    await seedSiblingProject({ projectId: owner.projectId, name: 'Keep' });
    const tokens = await grantedTokens({ owner, choiceOf: firstChoice });

    const isDeleted = await deleteOwnerProject({
      directory: env.DIRECTORY,
      ownerId: owner.ownerId,
      projectId: owner.projectId,
      expectedName: null,
    });

    expect(isDeleted).toBe(true);
    const response = await serveMcpCall({ token: tokens.access_token, body: TOOLS_LIST_BODY, now: Date.now() });
    expect(response.status).toBe(401);
    const grants = await env.DIRECTORY.prepare('SELECT count(*) AS grants FROM oauth_grants WHERE owner_id = ?')
      .bind(owner.ownerId)
      .first<{ grants: number }>();
    expect(grants?.grants).toBe(0);
  });

  test('deleting the workspace deletes the grant', async () => {
    const owner = await seededOwner();
    const tokens = await grantedTokens({ owner, choiceOf: firstChoice });
    const workspace = await env.DIRECTORY.prepare('SELECT workspace_id FROM projects WHERE id = ?')
      .bind(owner.projectId)
      .first<{ workspace_id: string }>();

    const deleted = await deleteOwnerWorkspace({
      directory: env.DIRECTORY,
      ownerId: owner.ownerId,
      workspaceId: workspace!.workspace_id,
      expectedName: null,
    });

    expect(deleted).toEqual([owner.projectId]);
    const response = await serveMcpCall({ token: tokens.access_token, body: TOOLS_LIST_BODY, now: Date.now() });
    expect(response.status).toBe(401);
  });

  test('an access token is never an owner API credential', async () => {
    const tokens = await grantedTokens({ owner: await seededOwner(), choiceOf: ownerChoice });

    const response = await ownerCall({ method: 'GET', path: '/owner/workspaces', token: tokens.access_token });

    expect(response.status).toBe(401);
  });

  test('a refresh token is never an MCP credential', async () => {
    const tokens = await grantedTokens({ owner: await seededOwner(), choiceOf: firstChoice });

    const response = await serveMcpCall({ token: tokens.refresh_token, body: TOOLS_LIST_BODY, now: Date.now() });

    expect(response.status).toBe(401);
  });
});
