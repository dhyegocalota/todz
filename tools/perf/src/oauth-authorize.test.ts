import { createHash } from 'node:crypto';
import { describe, expect, test } from 'vitest';
import { type AuthorizeDependencies, type LoopbackReceiver, authorizedAccessToken } from './oauth-authorize';

const ORIGIN = 'https://api.todz.app';
const REDIRECT_URI = 'http://127.0.0.1:41234/callback';
const CLIENT_ID = 'registered-client';
const CODE = 'the-authorization-code';
const ACCESS_TOKEN = 'todz-at_the_access_token';

type Harness = {
  dependencies: AuthorizeDependencies;
  requests: { url: string; body: string }[];
  opened: string[];
  state: { isClosed: boolean };
};

function harness({
  callbackOf = (url) => new URLSearchParams({ code: CODE, state: new URL(url).searchParams.get('state')! }),
  registrationStatus = 201,
}: {
  callbackOf?: (authorizationUrl: string) => URLSearchParams;
  registrationStatus?: number;
} = {}): Harness {
  const requests: { url: string; body: string }[] = [];
  const opened: string[] = [];
  const state = { isClosed: false };
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const url = String(input);
    requests.push({ url, body: String(init?.body) });
    if (url.endsWith('/oauth/register')) return Response.json({ client_id: CLIENT_ID }, { status: registrationStatus });
    return Response.json({ access_token: ACCESS_TOKEN, token_type: 'Bearer' });
  };
  const receiver: LoopbackReceiver = {
    redirectUri: REDIRECT_URI,
    callback: async () => callbackOf(opened[0]!),
    close: () => {
      state.isClosed = true;
    },
  };
  const dependencies: AuthorizeDependencies = {
    fetch,
    openUrl: async (url) => {
      opened.push(url);
    },
    receiver: async () => receiver,
  };
  return { dependencies, requests, opened, state };
}

describe('authorizedAccessToken', () => {
  test('registers a public client for the loopback address, asks the project scope with PKCE and returns the access token', async () => {
    const { dependencies, requests, opened } = harness();

    const token = await authorizedAccessToken({ origin: ORIGIN, dependencies });

    expect(token).toBe(ACCESS_TOKEN);
    const [registration, exchange] = requests;
    expect(JSON.parse(registration!.body)).toMatchObject({ redirect_uris: [REDIRECT_URI], token_endpoint_auth_method: 'none' });
    const authorization = new URL(opened[0]!);
    expect(`${authorization.origin}${authorization.pathname}`).toBe(`${ORIGIN}/oauth/authorize`);
    expect(Object.fromEntries(authorization.searchParams)).toMatchObject({
      response_type: 'code',
      client_id: CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      code_challenge_method: 'S256',
      scope: 'project',
      resource: `${ORIGIN}/mcp`,
    });
    const form = new URLSearchParams(exchange!.body);
    expect(exchange!.url).toBe(`${ORIGIN}/oauth/token`);
    expect(Object.fromEntries(form)).toMatchObject({
      grant_type: 'authorization_code',
      code: CODE,
      client_id: CLIENT_ID,
      redirect_uri: REDIRECT_URI,
    });
    const challenge = createHash('sha256').update(form.get('code_verifier')!).digest('base64url');
    expect(authorization.searchParams.get('code_challenge')).toBe(challenge);
  });

  test('closes the receiver once the token is returned', async () => {
    const { dependencies, state } = harness();

    await authorizedAccessToken({ origin: ORIGIN, dependencies });

    expect(state.isClosed).toBe(true);
  });

  test('a callback with a state this run never sent is refused, nothing is exchanged and the receiver closes', async () => {
    const { dependencies, requests, state } = harness({ callbackOf: () => new URLSearchParams({ code: CODE, state: 'another' }) });

    await expect(authorizedAccessToken({ origin: ORIGIN, dependencies })).rejects.toThrow('a state this run never sent');

    expect(requests.map((request) => request.url)).toEqual([`${ORIGIN}/oauth/register`]);
    expect(state.isClosed).toBe(true);
  });

  test('a denied authorization names the error and exchanges nothing', async () => {
    const { dependencies, requests } = harness({
      callbackOf: (url) => new URLSearchParams({ error: 'access_denied', state: new URL(url).searchParams.get('state')! }),
    });

    await expect(authorizedAccessToken({ origin: ORIGIN, dependencies })).rejects.toThrow('the authorization was refused: access_denied');

    expect(requests).toHaveLength(1);
  });

  test('a registration the server refuses fails with the step and the status, and opens no browser', async () => {
    const { dependencies, opened, state } = harness({ registrationStatus: 429 });

    await expect(authorizedAccessToken({ origin: ORIGIN, dependencies })).rejects.toThrow('POST /oauth/register answered 429');

    expect(opened).toEqual([]);
    expect(state.isClosed).toBe(true);
  });
});
