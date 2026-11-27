import { JSONRPC_VERSION } from '@modelcontextprotocol/server';
import { MILLISECONDS_PER_DAY, MILLISECONDS_PER_MINUTE } from '@todz/types';
import { describe, expect, test } from 'vitest';
import { generateCredentialSecret } from '../../src/credential-secret';
import { serveMcp } from '../../src/mcp-endpoint';
import { seedSession } from '../directory-seed';
import { ownerCall } from '../owner-client';
import { CLOCK_NOW } from '../task-fixtures';
import {
  type SeededOwner,
  connectedClient,
  firstChoice,
  mcpRequest,
  oauthEnv,
  refreshRequest,
  seededOwner,
  serveOAuthRequest,
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
