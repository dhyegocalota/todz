import { MILLISECONDS_PER_DAY, OAUTH_ACCESS_TOKEN_PREFIX } from '@todz/types';
import { env } from 'cloudflare:workers';
import { describe, expect, test } from 'vitest';
import { digestCredential } from '../../src/credential-digest';
import { generateCredentialSecret } from '../../src/credential-secret';
import { runOAuthCleanup } from '../../src/oauth/oauth-cleanup';
import { CLOCK_NOW } from '../task-fixtures';
import {
  LOOPBACK_REDIRECT_URI,
  authorizeParams,
  authorizeRequest,
  connectedClient,
  firstChoice,
  oauthEnv,
  pkcePair,
  refreshRequest,
  registerClient,
  seededOwner,
  serveMcpCall,
  serveOAuthRequest,
} from './oauth-client';

const IDLE_LIFETIME_MS = 30 * MILLISECONDS_PER_DAY;
const TOOLS_LIST_BODY = { jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} };

async function grantStoredBeforeScopes(): Promise<{ grantId: string; accessToken: string }> {
  const owner = await seededOwner();
  const clientId = await registerClient({ now: CLOCK_NOW });
  const grantId = crypto.randomUUID();
  const accessToken = `${OAUTH_ACCESS_TOKEN_PREFIX}${generateCredentialSecret()}`;
  await env.DIRECTORY.batch([
    env.DIRECTORY.prepare(
      'INSERT INTO oauth_grants (id, client_id, owner_id, project_id, redirect_uri, created_at, last_used_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    ).bind(grantId, clientId, owner.ownerId, owner.projectId, LOOPBACK_REDIRECT_URI, CLOCK_NOW, CLOCK_NOW),
    env.DIRECTORY.prepare("INSERT INTO oauth_tokens (digest, grant_id, kind, created_at, expires_at) VALUES (?, ?, 'access', ?, ?)").bind(
      await digestCredential(accessToken),
      grantId,
      CLOCK_NOW,
      CLOCK_NOW + MILLISECONDS_PER_DAY,
    ),
  ]);
  return { grantId, accessToken };
}

describe('a grant stored by the Worker that ran before the scopes table', () => {
  test('is refused, never answered with a failure, until the nightly run gives it the scope of its project', async () => {
    const { grantId, accessToken } = await grantStoredBeforeScopes();

    const before = await serveMcpCall({ token: accessToken, body: TOOLS_LIST_BODY });
    await runOAuthCleanup({ scheduledTime: CLOCK_NOW, env: oauthEnv() });
    const after = await serveMcpCall({ token: accessToken, body: TOOLS_LIST_BODY });

    expect(before.status).toBe(401);
    expect(after.status).toBe(200);
    const grant = await env.DIRECTORY.prepare('SELECT reaches_workspace FROM oauth_grants WHERE id = ?')
      .bind(grantId)
      .first<{ reaches_workspace: number }>();
    expect(grant?.reaches_workspace).toBe(1);
  });

  test('is given its scope once, however often the nightly run comes back', async () => {
    const { grantId } = await grantStoredBeforeScopes();

    await runOAuthCleanup({ scheduledTime: CLOCK_NOW, env: oauthEnv() });
    await runOAuthCleanup({ scheduledTime: CLOCK_NOW, env: oauthEnv() });

    const scopes = await env.DIRECTORY.prepare('SELECT count(*) AS scopes FROM oauth_grant_scopes WHERE grant_id = ?')
      .bind(grantId)
      .first<{ scopes: number }>();
    expect(scopes?.scopes).toBe(1);
  });

  test('a grant the current Worker stored never becomes an account grant, even with no scope rows left', async () => {
    const owner = await seededOwner();
    const clientId = await registerClient({ now: CLOCK_NOW });
    const grantId = crypto.randomUUID();
    await env.DIRECTORY.prepare(
      'INSERT INTO oauth_grants (id, client_id, owner_id, project_id, redirect_uri, created_at, last_used_at, is_scoped) VALUES (?, ?, ?, NULL, ?, ?, ?, 1)',
    )
      .bind(grantId, clientId, owner.ownerId, LOOPBACK_REDIRECT_URI, CLOCK_NOW, CLOCK_NOW)
      .run();

    await runOAuthCleanup({ scheduledTime: CLOCK_NOW, env: oauthEnv() });

    const scopes = await env.DIRECTORY.prepare('SELECT count(*) AS scopes FROM oauth_grant_scopes WHERE grant_id = ?')
      .bind(grantId)
      .first<{ scopes: number }>();
    expect(scopes?.scopes).toBe(0);
  });
});

describe('a refresh token the Worker before rotated during the deploy', () => {
  test('is linked by the nightly run to the token it was issued from, so that spent token is no longer honoured', async () => {
    const owner = await seededOwner();
    const { clientId, tokens } = await connectedClient({ choiceOf: firstChoice, email: owner.email });
    const parentDigest = await digestCredential(tokens.refresh_token);
    const childToken = `todz-rt_${generateCredentialSecret()}`;
    const rotatedAt = CLOCK_NOW + 1;
    await env.DIRECTORY.batch([
      env.DIRECTORY.prepare('UPDATE oauth_tokens SET spent_at = ? WHERE digest = ?').bind(rotatedAt, parentDigest),
      env.DIRECTORY.prepare(
        "INSERT INTO oauth_tokens (digest, grant_id, kind, created_at, expires_at, spent_at) SELECT ?, grant_id, 'refresh', ?, ?, ? FROM oauth_tokens WHERE digest = ?",
      ).bind(await digestCredential(childToken), rotatedAt, CLOCK_NOW + MILLISECONDS_PER_DAY, rotatedAt + 1, parentDigest),
    ]);

    await runOAuthCleanup({ scheduledTime: CLOCK_NOW, env: oauthEnv() });

    const child = await env.DIRECTORY.prepare('SELECT parent_digest FROM oauth_tokens WHERE digest = ?')
      .bind(await digestCredential(childToken))
      .first<{ parent_digest: string | null }>();
    expect(child?.parent_digest).toBe(parentDigest);
    const replayed = await serveOAuthRequest({
      request: refreshRequest({ clientId, refreshToken: tokens.refresh_token }),
      now: CLOCK_NOW + 2,
    });
    expect(replayed.status).toBe(400);
  });
});

const UNUSED_LIFETIME_MS = MILLISECONDS_PER_DAY;

async function clientCount(clientId: string): Promise<number> {
  const row = await env.DIRECTORY.prepare('SELECT count(*) AS clients FROM oauth_clients WHERE id = ?')
    .bind(clientId)
    .first<{ clients: number }>();
  return row!.clients;
}

describe('unused registrations expire', () => {
  test('a registration never used is known for a day and unknown to authorize after it', async () => {
    const clientId = await registerClient({ now: CLOCK_NOW });
    const { challenge } = await pkcePair();
    const request = () => authorizeRequest(authorizeParams({ clientId, challenge }));

    const withinTheDay = await serveOAuthRequest({ request: request(), now: CLOCK_NOW + UNUSED_LIFETIME_MS - 1 });
    const afterTheDay = await serveOAuthRequest({ request: request(), now: CLOCK_NOW + UNUSED_LIFETIME_MS });

    expect(withinTheDay.status).toBe(200);
    expect(afterTheDay.status).toBe(400);
    expect(afterTheDay.headers.get('Location')).toBeNull();
  });

  test('the nightly run deletes idle registrations without a grant and keeps the connected ones', async () => {
    const idleClientId = await registerClient({ now: CLOCK_NOW });
    const owner = await seededOwner();
    const { clientId: connectedClientId } = await connectedClient({ choiceOf: firstChoice, email: owner.email, now: CLOCK_NOW });

    await runOAuthCleanup({ scheduledTime: CLOCK_NOW + IDLE_LIFETIME_MS + 1, env: oauthEnv() });

    expect(await clientCount(idleClientId)).toBe(0);
    expect(await clientCount(connectedClientId)).toBe(1);
  });

  test('a disconnected client can reconnect with its registration for 30 days after its last token', async () => {
    const owner = await seededOwner();
    const { clientId, tokens } = await connectedClient({ choiceOf: firstChoice, email: owner.email, now: CLOCK_NOW });
    const later = CLOCK_NOW + IDLE_LIFETIME_MS - MILLISECONDS_PER_DAY;
    await serveOAuthRequest({ request: refreshRequest({ clientId, refreshToken: tokens.refresh_token }), now: later });
    await env.DIRECTORY.prepare('DELETE FROM oauth_grants WHERE client_id = ?').bind(clientId).run();
    const { challenge } = await pkcePair();

    const response = await serveOAuthRequest({
      request: authorizeRequest(authorizeParams({ clientId, challenge })),
      now: later + 2 * MILLISECONDS_PER_DAY,
    });

    expect(response.status).toBe(200);
  });
});
