import {
  Client,
  type OAuthClientInformationMixed,
  type OAuthClientMetadata,
  type OAuthClientProvider,
  type OAuthDiscoveryState,
  type OAuthTokens,
  StreamableHTTPClientTransport,
} from '@modelcontextprotocol/client';
import { describe, expect, test } from 'vitest';
import { McpToolName } from '../../src/mcp-copy';
import {
  LOOPBACK_REDIRECT_URI,
  MCP_RESOURCE,
  OAUTH_ORIGIN,
  approvedCode,
  consentPage,
  firstChoice,
  seededOwner,
  signedInBrowser,
  workerFetch,
} from './oauth-client';

const CLIENT_VERSION = '1.0.0';
const HANDSHAKE_CLIENT_NAME = 'todz handshake test';

type ProviderStore = {
  client?: OAuthClientInformationMixed;
  tokens?: OAuthTokens;
  verifier?: string;
  discovery?: OAuthDiscoveryState;
  authorizationUrl?: URL;
};

function inMemoryProvider(store: ProviderStore): OAuthClientProvider {
  const clientMetadata: OAuthClientMetadata = {
    client_name: HANDSHAKE_CLIENT_NAME,
    redirect_uris: [LOOPBACK_REDIRECT_URI],
    grant_types: ['authorization_code', 'refresh_token'],
    response_types: ['code'],
    token_endpoint_auth_method: 'none',
  };
  return {
    redirectUrl: LOOPBACK_REDIRECT_URI,
    clientMetadata,
    clientInformation: () => store.client,
    saveClientInformation: (client) => {
      store.client = client;
    },
    tokens: () => store.tokens,
    saveTokens: (tokens) => {
      store.tokens = tokens;
    },
    redirectToAuthorization: (authorizationUrl) => {
      store.authorizationUrl = authorizationUrl;
    },
    saveCodeVerifier: (verifier) => {
      store.verifier = verifier;
    },
    codeVerifier: () => {
      if (store.verifier === undefined) throw new Error('no code verifier was saved');
      return store.verifier;
    },
    saveDiscoveryState: (discovery) => {
      store.discovery = discovery;
    },
    discoveryState: () => store.discovery,
  };
}

function transportOf(provider: OAuthClientProvider): StreamableHTTPClientTransport {
  return new StreamableHTTPClientTransport(new URL(MCP_RESOURCE), {
    authProvider: provider,
    fetch: (input, init) => workerFetch(new Request(input, init)),
  });
}

describe('the official MCP SDK client connects with OAuth', () => {
  test('discovers, registers, authorizes with PKCE in the browser, exchanges the code and lists the tools', async () => {
    const owner = await seededOwner();
    const store: ProviderStore = {};
    const provider = inMemoryProvider(store);
    const firstTransport = transportOf(provider);

    await expect(new Client({ name: HANDSHAKE_CLIENT_NAME, version: CLIENT_VERSION }).connect(firstTransport)).rejects.toThrow();

    const authorizationUrl = store.authorizationUrl;
    if (authorizationUrl === undefined) throw new Error('the client should have opened the authorization URL');
    const params = authorizationUrl.searchParams;
    expect(params.get('code_challenge_method')).toBe('S256');
    expect(params.get('resource')).toBe(MCP_RESOURCE);
    const now = Date.now();
    const browser = await signedInBrowser({ params, email: owner.email, now });
    const choice = firstChoice(await consentPage({ browser, params, now }));
    expect(choice).toBe(`project:${owner.projectId}`);
    const code = await approvedCode({ browser, params, choice, now });
    const callback = new URLSearchParams({ code, iss: OAUTH_ORIGIN });

    await firstTransport.finishAuth(callback);

    expect(store.tokens?.access_token).toMatch(/^todz-at_/);
    const client = new Client({ name: HANDSHAKE_CLIENT_NAME, version: CLIENT_VERSION });
    await client.connect(transportOf(provider));
    const { tools } = await client.listTools();
    expect(tools.map((tool) => tool.name).sort()).toEqual(Object.values(McpToolName).sort());
    await client.close();
  });
});
