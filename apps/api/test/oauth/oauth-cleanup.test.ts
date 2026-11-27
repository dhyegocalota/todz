import { MILLISECONDS_PER_DAY } from '@todz/types';
import { env } from 'cloudflare:workers';
import { describe, expect, test } from 'vitest';
import { runOAuthCleanup } from '../../src/oauth/oauth-cleanup';
import { CLOCK_NOW } from '../task-fixtures';
import {
  authorizeParams,
  authorizeRequest,
  connectedClient,
  firstChoice,
  oauthEnv,
  pkcePair,
  refreshRequest,
  registerClient,
  seededOwner,
  serveOAuthRequest,
} from './oauth-client';

const IDLE_LIFETIME_MS = 30 * MILLISECONDS_PER_DAY;

async function clientCount(clientId: string): Promise<number> {
  const row = await env.DIRECTORY.prepare('SELECT count(*) AS clients FROM oauth_clients WHERE id = ?')
    .bind(clientId)
    .first<{ clients: number }>();
  return row!.clients;
}

describe('unused registrations expire', () => {
  test('a registration with no grant is unknown to authorize 30 days later', async () => {
    const clientId = await registerClient({ now: CLOCK_NOW });
    const { challenge } = await pkcePair();

    const response = await serveOAuthRequest({
      request: authorizeRequest(authorizeParams({ clientId, challenge })),
      now: CLOCK_NOW + IDLE_LIFETIME_MS,
    });

    expect(response.status).toBe(400);
    expect(response.headers.get('Location')).toBeNull();
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
