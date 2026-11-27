import { describe, expect, test } from 'vitest';
import { recordingLimiter } from '../email-sign-in-client';
import { CLOCK_NOW } from '../task-fixtures';
import {
  CLIENT_NAME,
  HTTPS_REDIRECT_URI,
  LOOPBACK_REDIRECT_URI,
  OAUTH_ORIGIN,
  clientMetadata,
  jsonRequest,
  oauthEnv,
  serveOAuthRequest,
} from './oauth-client';

const REGISTER_PATH = '/oauth/register';
const CLIENT_ID_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const CLIENT_ADDRESS = '203.0.113.9';
const PUBLIC_ORIGIN = 'https://api.todz.test';

function register(metadata: unknown): Promise<Response> {
  return serveOAuthRequest({ request: jsonRequest({ path: REGISTER_PATH, body: metadata }) });
}

describe('dynamic client registration (RFC 7591)', () => {
  test('a public client with a loopback and an https redirect URI is registered', async () => {
    const response = await register(clientMetadata({ redirect_uris: [LOOPBACK_REDIRECT_URI, HTTPS_REDIRECT_URI] }));

    expect(response.status).toBe(201);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    const registration = (await response.json()) as Record<string, unknown>;
    expect(registration.client_id).toMatch(CLIENT_ID_PATTERN);
    expect(registration).toMatchObject({
      client_name: CLIENT_NAME,
      redirect_uris: [LOOPBACK_REDIRECT_URI, HTTPS_REDIRECT_URI],
      token_endpoint_auth_method: 'none',
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
    });
    expect(registration.client_secret).toBeUndefined();
  });

  test.each([
    ['localhost', 'http://localhost:8123/callback'],
    ['the IPv6 loopback', 'http://[::1]:8123/callback'],
    ['a loopback with no port', 'http://127.0.0.1/callback'],
  ])('%s is a valid redirect URI', async (_label, redirectUri) => {
    const response = await register(clientMetadata({ redirect_uris: [redirectUri] }));

    expect(response.status).toBe(201);
  });

  test('two clients get two ids', async () => {
    const first = (await (await register(clientMetadata())).json()) as { client_id: string };
    const second = (await (await register(clientMetadata())).json()) as { client_id: string };

    expect(first.client_id).not.toBe(second.client_id);
  });

  test.each([
    ['no redirect URIs', { redirect_uris: [] }],
    ['six redirect URIs', { redirect_uris: Array.from({ length: 6 }, (_, index) => `http://127.0.0.1:${8000 + index}/callback`) }],
    ['a redirect URI that is not a string', { redirect_uris: [42] }],
    ['plain http on a public host', { redirect_uris: ['http://example.com/callback'] }],
    ['a custom scheme', { redirect_uris: ['myapp://callback'] }],
    ['a fragment', { redirect_uris: ['https://client.example.com/callback#done'] }],
    ['user information', { redirect_uris: ['https://user:secret@client.example.com/callback'] }],
    ['a relative URI', { redirect_uris: ['/callback'] }],
    ['a loopback lookalike host', { redirect_uris: ['http://127.0.0.1.example.com/callback'] }],
  ])('%s is refused as an invalid redirect URI', async (_label, fields) => {
    const response = await register(clientMetadata(fields));

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: 'invalid_redirect_uri' });
  });

  test.each([
    ['a confidential client', { token_endpoint_auth_method: 'client_secret_basic' }],
    ['the client credentials grant', { grant_types: ['client_credentials'] }],
    ['the implicit response type', { response_types: ['token'] }],
    ['no client name', { client_name: undefined }],
    ['an empty client name', { client_name: '   ' }],
    ['a 65-character client name', { client_name: 'a'.repeat(65) }],
    ['a client name with a control character', { client_name: 'Claude\u0007Code' }],
    ['a client name that is not a string', { client_name: 7 }],
  ])('%s is refused as invalid metadata', async (_label, fields) => {
    const response = await register(clientMetadata(fields));

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: 'invalid_client_metadata' });
  });

  test('a body that is not JSON is an invalid request', async () => {
    const request = new Request(`${OAUTH_ORIGIN}${REGISTER_PATH}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': '5' },
      body: 'nope!',
    });

    const response = await serveOAuthRequest({ request });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: 'invalid_client_metadata' });
  });

  test('a body over the bound is refused before it is read', async () => {
    const response = await register(clientMetadata({ client_uri: `https://client.example.com/${'a'.repeat(5_000)}` }));

    expect(response.status).toBe(400);
  });

  test('the registration limiter refuses with a retry after', async () => {
    const response = await serveOAuthRequest({
      request: new Request(`${PUBLIC_ORIGIN}${REGISTER_PATH}`, jsonRequest({ path: REGISTER_PATH, body: clientMetadata() })),
      workerEnv: oauthEnv({
        PUBLIC_ORIGIN,
        OAUTH_LIMITER: recordingLimiter({ isAllowed: true }).limiter,
        OAUTH_REGISTER_LIMITER: recordingLimiter({ isAllowed: false }).limiter,
      }),
      now: CLOCK_NOW,
    });

    expect(response.status).toBe(429);
    expect(response.headers.get('Retry-After')).toBe('60');
  });

  test('a public host without its limiters or the client address answers unavailable', async () => {
    const guardedRequest = (headers: Record<string, string>) =>
      new Request(`${PUBLIC_ORIGIN}${REGISTER_PATH}`, jsonRequest({ path: REGISTER_PATH, body: clientMetadata(), headers }));

    const withoutLimiters = await serveOAuthRequest({
      request: guardedRequest({ 'CF-Connecting-IP': CLIENT_ADDRESS }),
      workerEnv: oauthEnv({ PUBLIC_ORIGIN }),
    });
    const withoutAddress = await serveOAuthRequest({
      request: guardedRequest({}),
      workerEnv: oauthEnv({
        PUBLIC_ORIGIN,
        OAUTH_LIMITER: recordingLimiter({ isAllowed: true }).limiter,
        OAUTH_REGISTER_LIMITER: recordingLimiter({ isAllowed: true }).limiter,
      }),
    });

    expect(withoutLimiters.status).toBe(503);
    expect(withoutAddress.status).toBe(503);
  });

  test('the limiters are keyed by the client address', async () => {
    const generalLimiter = recordingLimiter({ isAllowed: true });
    const registerLimiter = recordingLimiter({ isAllowed: true });

    const response = await serveOAuthRequest({
      request: new Request(
        `${PUBLIC_ORIGIN}${REGISTER_PATH}`,
        jsonRequest({ path: REGISTER_PATH, body: clientMetadata(), headers: { 'CF-Connecting-IP': CLIENT_ADDRESS } }),
      ),
      workerEnv: oauthEnv({ PUBLIC_ORIGIN, OAUTH_LIMITER: generalLimiter.limiter, OAUTH_REGISTER_LIMITER: registerLimiter.limiter }),
    });

    expect(response.status).toBe(201);
    expect(generalLimiter.keys).toEqual([`/oauth:${CLIENT_ADDRESS}`]);
    expect(registerLimiter.keys).toEqual([`${REGISTER_PATH}:${CLIENT_ADDRESS}`]);
  });
});
