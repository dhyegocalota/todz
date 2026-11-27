import { JSONRPC_VERSION } from '@modelcontextprotocol/server';
import { describe, expect, test } from 'vitest';
import { serveMcp } from '../../src/mcp-endpoint';
import { serveOAuthMetadata } from '../../src/oauth/oauth-metadata';
import { MCP_RESOURCE, OAUTH_ORIGIN, mcpRequest, oauthEnv, workerFetch } from './oauth-client';

const RESOURCE_METADATA_URL = `${OAUTH_ORIGIN}/.well-known/oauth-protected-resource/mcp`;
const TOOLS_LIST_BODY = { jsonrpc: JSONRPC_VERSION, id: 1, method: 'tools/list', params: {} };

function wellKnownRequest(path: string): Request {
  return new Request(`${OAUTH_ORIGIN}${path}`);
}

describe('the protected resource metadata (RFC 9728)', () => {
  test.each(['/.well-known/oauth-protected-resource', '/.well-known/oauth-protected-resource/mcp'])(
    '%s names the MCP resource, this server as its authorization server and the two scopes',
    async (path) => {
      const response = await workerFetch(wellKnownRequest(path));

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toContain('application/json');
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
      expect(await response.json()).toEqual({
        resource: MCP_RESOURCE,
        authorization_servers: [OAUTH_ORIGIN],
        scopes_supported: ['project', 'owner'],
        bearer_methods_supported: ['header'],
        resource_name: 'todz',
      });
    },
  );
});

describe('the authorization server metadata (RFC 8414)', () => {
  test('names the endpoints, PKCE S256 only, public clients and the issuer parameter', async () => {
    const response = await workerFetch(wellKnownRequest('/.well-known/oauth-authorization-server'));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      issuer: OAUTH_ORIGIN,
      authorization_endpoint: `${OAUTH_ORIGIN}/oauth/authorize`,
      token_endpoint: `${OAUTH_ORIGIN}/oauth/token`,
      registration_endpoint: `${OAUTH_ORIGIN}/oauth/register`,
      revocation_endpoint: `${OAUTH_ORIGIN}/oauth/revoke`,
      response_types_supported: ['code'],
      response_modes_supported: ['query'],
      grant_types_supported: ['authorization_code', 'refresh_token'],
      code_challenge_methods_supported: ['S256'],
      token_endpoint_auth_methods_supported: ['none'],
      revocation_endpoint_auth_methods_supported: ['none'],
      scopes_supported: ['project', 'owner'],
      authorization_response_iss_parameter_supported: true,
    });
  });

  test('a server without a usable public origin serves no metadata', async () => {
    const response = serveOAuthMetadata({
      request: wellKnownRequest('/.well-known/oauth-authorization-server'),
      env: oauthEnv({ PUBLIC_ORIGIN: 'not an origin' }),
    });

    expect(response.status).toBe(404);
  });
});

describe('the /mcp challenge', () => {
  test('a request with no credential points the client at the protected resource metadata', async () => {
    const response = await workerFetch(mcpRequest({ token: null, body: TOOLS_LIST_BODY }));

    expect(response.status).toBe(401);
    expect(response.headers.get('WWW-Authenticate')).toBe(`Bearer resource_metadata="${RESOURCE_METADATA_URL}"`);
  });

  test.each(['todz-at_unknownunknownunknownunknownunknownunk', 'todz_unknownunknownunknownunknownunknownunkno'])(
    'an unknown credential %s is an invalid token with the same pointer',
    async (token) => {
      const response = await workerFetch(mcpRequest({ token, body: TOOLS_LIST_BODY }));

      expect(response.status).toBe(401);
      expect(response.headers.get('WWW-Authenticate')).toBe(`Bearer error="invalid_token", resource_metadata="${RESOURCE_METADATA_URL}"`);
    },
  );

  test('without a usable public origin the challenge stays a plain Bearer', async () => {
    const response = await serveMcp({
      request: mcpRequest({ token: null, body: TOOLS_LIST_BODY }),
      env: oauthEnv({ PUBLIC_ORIGIN: undefined }),
      now: Date.now(),
    });

    expect(response.status).toBe(401);
    expect(response.headers.get('WWW-Authenticate')).toBe('Bearer');
  });
});
