import { JSONRPC_VERSION } from '@modelcontextprotocol/server';
import { MILLISECONDS_PER_DAY, MILLISECONDS_PER_HOUR, MILLISECONDS_PER_SECOND } from '@todz/types';
import { env } from 'cloudflare:workers';
import { describe, expect, test } from 'vitest';
import { digestCredential } from '../../src/credential-digest';
import { CLOCK_NOW } from '../task-fixtures';
import {
  MCP_RESOURCE,
  approvedCode,
  authorizeParams,
  connectedClient,
  consentPage,
  exchangeCode,
  firstChoice,
  formRequest,
  pkcePair,
  refreshRequest,
  registerClient,
  seededOwner,
  serveMcpCall,
  serveOAuthRequest,
  signedInBrowser,
  tokenRequest,
  tokensOf,
} from './oauth-client';

const ACCESS_TOKEN_PATTERN = /^todz-at_[A-Za-z0-9_-]{43}$/;
const REFRESH_TOKEN_PATTERN = /^todz-rt_[A-Za-z0-9_-]{43}$/;
const ACCESS_LIFETIME_SECONDS = 3_600;
const CODE_LIFETIME_MS = 60 * MILLISECONDS_PER_SECOND;
const REUSE_LEEWAY_MS = 30 * MILLISECONDS_PER_SECOND;
const SPENT_REFRESH_TOKENS_MAX = 10_000;
const HALF_HOURLY_REFRESHES_PER_LIFETIME = (30 * MILLISECONDS_PER_DAY) / (MILLISECONDS_PER_HOUR / 2);
const DIGEST_LENGTH = 64;
const TOOLS_LIST_BODY = { jsonrpc: JSONRPC_VERSION, id: 1, method: 'tools/list', params: {} };

async function approved(): Promise<{ clientId: string; code: string; verifier: string; projectId: string }> {
  const owner = await seededOwner();
  const clientId = await registerClient();
  const { verifier, challenge } = await pkcePair();
  const params = authorizeParams({ clientId, challenge });
  const browser = await signedInBrowser({ params, email: owner.email });
  const code = await approvedCode({ browser, params, choice: owner.projectId });
  return { clientId, code, verifier, projectId: owner.projectId };
}

async function mcpStatus({ token, now = CLOCK_NOW }: { token: string; now?: number }): Promise<number> {
  return (await serveMcpCall({ token, body: TOOLS_LIST_BODY, now })).status;
}

async function errorOf(response: Response): Promise<string> {
  const body = (await response.json()) as { error: string };
  return body.error;
}

async function storedTokenCount(digest: string): Promise<number> {
  const row = await env.DIRECTORY.prepare('SELECT count(*) AS tokens FROM oauth_tokens WHERE digest = ?')
    .bind(digest)
    .first<{ tokens: number }>();
  return row!.tokens;
}

async function seedSpentRefreshTokens({ refreshToken, count }: { refreshToken: string; count: number }): Promise<void> {
  const grant = await env.DIRECTORY.prepare('SELECT grant_id FROM oauth_tokens WHERE digest = ?')
    .bind(await digestCredential(refreshToken))
    .first<{ grant_id: string }>();
  await env.DIRECTORY.prepare(
    "WITH RECURSIVE seeds(position) AS (SELECT 1 UNION ALL SELECT position + 1 FROM seeds WHERE position < ?) INSERT INTO oauth_tokens (digest, grant_id, kind, created_at, expires_at, spent_at) SELECT printf('%0' || ? || 'd', position), ?, 'refresh', ?, ?, ? FROM seeds",
  )
    .bind(count, DIGEST_LENGTH, grant!.grant_id, CLOCK_NOW - 1, CLOCK_NOW + MILLISECONDS_PER_DAY, CLOCK_NOW - 1)
    .run();
}

describe('exchanging an authorization code', () => {
  test('the right verifier gets a token pair for the chosen project, never stored in the clear', async () => {
    const { clientId, code, verifier, projectId } = await approved();

    const response = await exchangeCode({ clientId, code, verifier });

    expect(response.headers.get('Cache-Control')).toBe('no-store');
    const tokens = await tokensOf(response);
    expect(tokens.access_token).toMatch(ACCESS_TOKEN_PATTERN);
    expect(tokens.refresh_token).toMatch(REFRESH_TOKEN_PATTERN);
    expect(tokens.token_type).toBe('Bearer');
    expect(tokens.expires_in).toBe(ACCESS_LIFETIME_SECONDS);
    expect(tokens.scope).toBe(`project:${projectId}`);
    expect(await storedTokenCount(await digestCredential(tokens.access_token))).toBe(1);
    expect(await storedTokenCount(tokens.access_token)).toBe(0);
    expect(await mcpStatus({ token: tokens.access_token })).toBe(200);
  });

  test.each([
    ['a wrong verifier', { code_verifier: 'wrongwrongwrongwrongwrongwrongwrongwrongwrongwrong' }, 'invalid_grant'],
    ['another redirect URI', { redirect_uri: 'http://127.0.0.1:33418/other' }, 'invalid_grant'],
    ['no verifier', { code_verifier: undefined }, 'invalid_request'],
    ['another resource', { resource: 'https://attacker.example/mcp' }, 'invalid_target'],
  ])('%s is refused and spends the code', async (_label, changes, error) => {
    const { clientId, code, verifier } = await approved();
    const fields: Record<string, string | undefined> = {
      grant_type: 'authorization_code',
      code,
      code_verifier: verifier,
      redirect_uri: 'http://127.0.0.1:33418/callback',
      client_id: clientId,
      resource: MCP_RESOURCE,
      ...changes,
    };
    const definedFields = Object.fromEntries(Object.entries(fields).filter((entry): entry is [string, string] => entry[1] !== undefined));

    const refused = await serveOAuthRequest({ request: tokenRequest(definedFields) });

    expect(refused.status).toBe(400);
    expect(refused.headers.get('Cache-Control')).toBe('no-store');
    expect(await errorOf(refused)).toBe(error);
    const retried = await exchangeCode({ clientId, code, verifier });
    expect(await errorOf(retried)).toBe('invalid_grant');
  });

  test('a code presented by another client is refused', async () => {
    const { code, verifier } = await approved();
    const otherClientId = await registerClient();

    const response = await exchangeCode({ clientId: otherClientId, code, verifier });

    expect(response.status).toBe(400);
    expect(await errorOf(response)).toBe('invalid_grant');
  });

  test('a code lives 60 seconds', async () => {
    const { clientId, code, verifier } = await approved();

    const response = await exchangeCode({ clientId, code, verifier, now: CLOCK_NOW + CODE_LIFETIME_MS });

    expect(await errorOf(response)).toBe('invalid_grant');
  });

  test('replaying a code revokes the tokens issued from it', async () => {
    const { clientId, code, verifier } = await approved();
    const tokens = await tokensOf(await exchangeCode({ clientId, code, verifier }));

    const replayed = await exchangeCode({ clientId, code, verifier });

    expect(await errorOf(replayed)).toBe('invalid_grant');
    expect(await mcpStatus({ token: tokens.access_token })).toBe(401);
    const refreshed = await serveOAuthRequest({ request: refreshRequest({ clientId, refreshToken: tokens.refresh_token }) });
    expect(await errorOf(refreshed)).toBe('invalid_grant');
  });

  test('two exchanges of one code at once never leave a working token', async () => {
    const { clientId, code, verifier } = await approved();

    const answers = await Promise.all([exchangeCode({ clientId, code, verifier }), exchangeCode({ clientId, code, verifier })]);

    const granted = await Promise.all(answers.filter((answer) => answer.status === 200).map(tokensOf));
    const statuses = await Promise.all(granted.map((tokens) => mcpStatus({ token: tokens.access_token })));
    expect(statuses.every((status) => status === 401)).toBe(true);
  });

  test('an unknown client is an invalid client', async () => {
    const { code, verifier } = await approved();

    const response = await exchangeCode({ clientId: 'unknownunknownunknownunknownunknownunknown0', code, verifier });

    expect(response.status).toBe(401);
    expect(await errorOf(response)).toBe('invalid_client');
  });

  test('an unsupported grant type is named', async () => {
    const clientId = await registerClient();

    const response = await serveOAuthRequest({ request: tokenRequest({ grant_type: 'password', client_id: clientId }) });

    expect(response.status).toBe(400);
    expect(await errorOf(response)).toBe('unsupported_grant_type');
  });

  test('a token request that is not a form is an invalid request', async () => {
    const response = await serveOAuthRequest({
      request: new Request('http://localhost:8787/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': '2' },
        body: '{}',
      }),
    });

    expect(response.status).toBe(400);
    expect(await errorOf(response)).toBe('invalid_request');
  });
});

describe('refreshing', () => {
  function refreshAt({ clientId, refreshToken, now }: { clientId: string; refreshToken: string; now: number }): Promise<Response> {
    return serveOAuthRequest({ request: refreshRequest({ clientId, refreshToken }), now });
  }

  test('rotates the pair: the old refresh token is spent and the old access token lives out its hour', async () => {
    const owner = await seededOwner();
    const { clientId, tokens } = await connectedClient({ choiceOf: firstChoice, email: owner.email });

    const refreshed = await tokensOf(await refreshAt({ clientId, refreshToken: tokens.refresh_token, now: CLOCK_NOW }));

    expect(refreshed.access_token).not.toBe(tokens.access_token);
    expect(refreshed.refresh_token).not.toBe(tokens.refresh_token);
    expect(refreshed.scope).toBe(`project:${owner.projectId}`);
    expect(await mcpStatus({ token: tokens.access_token })).toBe(200);
    expect(await mcpStatus({ token: refreshed.access_token })).toBe(200);
  });

  test('presenting a spent refresh token after the leeway revokes the whole family', async () => {
    const owner = await seededOwner();
    const { clientId, tokens } = await connectedClient({ choiceOf: firstChoice, email: owner.email });
    const refreshed = await tokensOf(await refreshAt({ clientId, refreshToken: tokens.refresh_token, now: CLOCK_NOW }));

    const reused = await refreshAt({ clientId, refreshToken: tokens.refresh_token, now: CLOCK_NOW + REUSE_LEEWAY_MS + 1 });

    expect(reused.status).toBe(400);
    expect(await errorOf(reused)).toBe('invalid_grant');
    expect(await mcpStatus({ token: refreshed.access_token })).toBe(401);
    const afterReuse = await refreshAt({ clientId, refreshToken: refreshed.refresh_token, now: CLOCK_NOW + REUSE_LEEWAY_MS + 2 });
    expect(await errorOf(afterReuse)).toBe('invalid_grant');
  });

  test('a stolen token refreshed twice is still caught when the real client presents the first one', async () => {
    const owner = await seededOwner();
    const { clientId, tokens } = await connectedClient({ choiceOf: firstChoice, email: owner.email });
    const second = await tokensOf(await refreshAt({ clientId, refreshToken: tokens.refresh_token, now: CLOCK_NOW }));
    const third = await tokensOf(await refreshAt({ clientId, refreshToken: second.refresh_token, now: CLOCK_NOW + 1 }));

    const realClient = await refreshAt({ clientId, refreshToken: tokens.refresh_token, now: CLOCK_NOW + REUSE_LEEWAY_MS + 1 });

    expect(await errorOf(realClient)).toBe('invalid_grant');
    expect(await mcpStatus({ token: third.access_token })).toBe(401);
    const afterTheft = await refreshAt({ clientId, refreshToken: third.refresh_token, now: CLOCK_NOW + REUSE_LEEWAY_MS + 2 });
    expect(await errorOf(afterTheft)).toBe('invalid_grant');
  });

  test('a grant that reaches the spent refresh token cap is revoked, so no spent token is ever evicted', async () => {
    const owner = await seededOwner();
    const { clientId, tokens } = await connectedClient({ choiceOf: firstChoice, email: owner.email });
    const second = await tokensOf(await refreshAt({ clientId, refreshToken: tokens.refresh_token, now: CLOCK_NOW }));
    await seedSpentRefreshTokens({ refreshToken: second.refresh_token, count: SPENT_REFRESH_TOKENS_MAX - 2 });

    const capped = await refreshAt({ clientId, refreshToken: second.refresh_token, now: CLOCK_NOW + 1 });

    expect(await errorOf(capped)).toBe('invalid_grant');
    expect(await mcpStatus({ token: second.access_token })).toBe(401);
    expect(await storedTokenCount(await digestCredential(tokens.refresh_token))).toBe(0);
    const firstAgain = await refreshAt({ clientId, refreshToken: tokens.refresh_token, now: CLOCK_NOW + REUSE_LEEWAY_MS + 2 });
    expect(await errorOf(firstAgain)).toBe('invalid_grant');
  });

  test('a retry within the leeway gets a working pair and keeps the app connected', async () => {
    const owner = await seededOwner();
    const { clientId, tokens } = await connectedClient({ choiceOf: firstChoice, email: owner.email });
    const winner = await tokensOf(await refreshAt({ clientId, refreshToken: tokens.refresh_token, now: CLOCK_NOW }));

    const retry = await tokensOf(await refreshAt({ clientId, refreshToken: tokens.refresh_token, now: CLOCK_NOW + REUSE_LEEWAY_MS }));

    expect(retry.refresh_token).not.toBe(winner.refresh_token);
    expect(await mcpStatus({ token: winner.access_token })).toBe(200);
    expect(await mcpStatus({ token: retry.access_token })).toBe(200);
    expect((await refreshAt({ clientId, refreshToken: winner.refresh_token, now: CLOCK_NOW + REUSE_LEEWAY_MS })).status).toBe(200);
    expect((await refreshAt({ clientId, refreshToken: retry.refresh_token, now: CLOCK_NOW + REUSE_LEEWAY_MS })).status).toBe(200);
  });

  test('two refreshes of one token at once both get a working pair', async () => {
    const owner = await seededOwner();
    const { clientId, tokens } = await connectedClient({ choiceOf: firstChoice, email: owner.email });

    const racing = await Promise.all([
      refreshAt({ clientId, refreshToken: tokens.refresh_token, now: CLOCK_NOW }),
      refreshAt({ clientId, refreshToken: tokens.refresh_token, now: CLOCK_NOW }),
    ]);

    const pairs = await Promise.all(racing.map(tokensOf));
    expect(await Promise.all(pairs.map((pair) => mcpStatus({ token: pair.access_token })))).toEqual([200, 200]);
  });

  test('the leeway counts from the first spend, so a retry never stretches it', async () => {
    const owner = await seededOwner();
    const { clientId, tokens } = await connectedClient({ choiceOf: firstChoice, email: owner.email });
    await tokensOf(await refreshAt({ clientId, refreshToken: tokens.refresh_token, now: CLOCK_NOW }));
    const retry = await tokensOf(await refreshAt({ clientId, refreshToken: tokens.refresh_token, now: CLOCK_NOW + REUSE_LEEWAY_MS }));

    const reused = await refreshAt({ clientId, refreshToken: tokens.refresh_token, now: CLOCK_NOW + REUSE_LEEWAY_MS + 1 });

    expect(await errorOf(reused)).toBe('invalid_grant');
    expect(await mcpStatus({ token: retry.access_token })).toBe(401);
  });

  test('a spent refresh token of another client is refused within the leeway too', async () => {
    const owner = await seededOwner();
    const { clientId, tokens } = await connectedClient({ choiceOf: firstChoice, email: owner.email });
    const winner = await tokensOf(await refreshAt({ clientId, refreshToken: tokens.refresh_token, now: CLOCK_NOW }));
    const otherClientId = await registerClient();

    const stolen = await refreshAt({ clientId: otherClientId, refreshToken: tokens.refresh_token, now: CLOCK_NOW + 1 });

    expect(await errorOf(stolen)).toBe('invalid_grant');
    expect(await mcpStatus({ token: winner.access_token })).toBe(200);
  });

  test('a client refreshing every half hour for the refresh token lifetime stays under the cap', async () => {
    const owner = await seededOwner();
    const { clientId, tokens } = await connectedClient({ choiceOf: firstChoice, email: owner.email });
    const second = await tokensOf(await refreshAt({ clientId, refreshToken: tokens.refresh_token, now: CLOCK_NOW }));
    await seedSpentRefreshTokens({ refreshToken: second.refresh_token, count: HALF_HOURLY_REFRESHES_PER_LIFETIME });

    const response = await refreshAt({ clientId, refreshToken: second.refresh_token, now: CLOCK_NOW + 1 });

    expect(response.status).toBe(200);
  });

  test('a refresh token of another client is refused and does not spend it', async () => {
    const owner = await seededOwner();
    const { clientId, tokens } = await connectedClient({ choiceOf: firstChoice, email: owner.email });
    const otherClientId = await registerClient();

    const stolen = await serveOAuthRequest({ request: refreshRequest({ clientId: otherClientId, refreshToken: tokens.refresh_token }) });

    expect(await errorOf(stolen)).toBe('invalid_grant');
    const own = await serveOAuthRequest({ request: refreshRequest({ clientId, refreshToken: tokens.refresh_token }) });
    expect(own.status).toBe(200);
  });

  test('a refresh token lives 30 days', async () => {
    const owner = await seededOwner();
    const { clientId, tokens } = await connectedClient({ choiceOf: firstChoice, email: owner.email });

    const response = await serveOAuthRequest({
      request: refreshRequest({ clientId, refreshToken: tokens.refresh_token }),
      now: CLOCK_NOW + 30 * MILLISECONDS_PER_DAY,
    });

    expect(await errorOf(response)).toBe('invalid_grant');
  });

  test('an access token lives one hour', async () => {
    const owner = await seededOwner();
    const { tokens } = await connectedClient({ choiceOf: firstChoice, email: owner.email });

    expect(await mcpStatus({ token: tokens.access_token, now: CLOCK_NOW + MILLISECONDS_PER_HOUR - 1 })).toBe(200);
    expect(await mcpStatus({ token: tokens.access_token, now: CLOCK_NOW + MILLISECONDS_PER_HOUR })).toBe(401);
  });
});

describe('revoking (RFC 7009)', () => {
  test.each(['refresh_token', 'access_token'] as const)('revoking the %s ends the whole grant', async (kind) => {
    const owner = await seededOwner();
    const { clientId, tokens } = await connectedClient({ choiceOf: firstChoice, email: owner.email });

    const response = await serveOAuthRequest({
      request: formRequest({ path: '/oauth/revoke', fields: { token: tokens[kind], client_id: clientId } }),
    });

    expect(response.status).toBe(200);
    expect(await mcpStatus({ token: tokens.access_token })).toBe(401);
    const refreshed = await serveOAuthRequest({ request: refreshRequest({ clientId, refreshToken: tokens.refresh_token }) });
    expect(await errorOf(refreshed)).toBe('invalid_grant');
  });

  test('a token of another client or an unknown token answers 200 and revokes nothing', async () => {
    const owner = await seededOwner();
    const { tokens } = await connectedClient({ choiceOf: firstChoice, email: owner.email });
    const otherClientId = await registerClient();

    const foreign = await serveOAuthRequest({
      request: formRequest({ path: '/oauth/revoke', fields: { token: tokens.refresh_token, client_id: otherClientId } }),
    });
    const unknown = await serveOAuthRequest({
      request: formRequest({ path: '/oauth/revoke', fields: { token: 'todz-rt_nothing', client_id: otherClientId } }),
    });

    expect(foreign.status).toBe(200);
    expect(unknown.status).toBe(200);
    expect(await mcpStatus({ token: tokens.access_token })).toBe(200);
  });

  test('a revocation without a token is an invalid request', async () => {
    const clientId = await registerClient();

    const response = await serveOAuthRequest({ request: formRequest({ path: '/oauth/revoke', fields: { client_id: clientId } }) });

    expect(response.status).toBe(400);
    expect(await errorOf(response)).toBe('invalid_request');
  });
});

describe('the consent page offers what a code can carry', () => {
  test('the owner scope code carries the owner scope', async () => {
    const owner = await seededOwner();

    const { tokens } = await connectedClient({
      choiceOf: (html) => (html.includes('value="owner"') ? 'owner' : firstChoice(html)),
      email: owner.email,
    });

    expect(tokens.scope).toBe('owner');
  });

  test('one sign-in serves one consent: the next one asks for a link again', async () => {
    const owner = await seededOwner();
    const { browser, params } = await connectedClient({ choiceOf: firstChoice, email: owner.email });

    expect(browser.cookies.has('__Host-todz_oauth')).toBe(false);
    expect(await consentPage({ browser, params })).toContain('action="/oauth/sign-in-links"');
  });
});
