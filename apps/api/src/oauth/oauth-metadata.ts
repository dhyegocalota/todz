import type { Env } from '../env';
import { HttpHeader } from '../http-header';
import { HttpStatus } from '../http-status';
import { noRouteResponse } from '../owner-errors';
import { publicOriginOf } from '../sign-in-links';
import { OPEN_READ_HEADERS, PUBLIC_CACHE_CONTROL } from '../site/discovery-response';
import { MCP_PATH, OAuthMetadataPath, OAuthPath } from './oauth-paths';
import { SUPPORTED_SCOPES } from './oauth-scope';
import { CODE_CHALLENGE_METHOD } from './oauth-pkce';

const RESPONSE_TYPE_CODE = 'code';
const RESPONSE_MODE_QUERY = 'query';
const PUBLIC_CLIENT_AUTHENTICATION = 'none';
const HEADER_BEARER_METHOD = 'header';
const BEARER_CHALLENGE = 'Bearer';
const RESOURCE_NAME = 'todz';

export enum OAuthGrantType {
  AuthorizationCode = 'authorization_code',
  RefreshToken = 'refresh_token',
}

export const RESPONSE_TYPES_SUPPORTED = [RESPONSE_TYPE_CODE];
export const GRANT_TYPES_SUPPORTED = Object.values(OAuthGrantType);
export const TOKEN_ENDPOINT_AUTH_METHOD = PUBLIC_CLIENT_AUTHENTICATION;

// NB ADR 0109: the issuer is the server's own public origin, so a self-hosted server issues for itself.
export function oauthIssuerOf(env: Env): string | null {
  return publicOriginOf(env.PUBLIC_ORIGIN);
}

export function mcpResourceOf(issuer: string): string {
  return `${issuer}${MCP_PATH}`;
}

function protectedResourceMetadataOf(issuer: string) {
  return {
    resource: mcpResourceOf(issuer),
    authorization_servers: [issuer],
    scopes_supported: SUPPORTED_SCOPES,
    bearer_methods_supported: [HEADER_BEARER_METHOD],
    resource_name: RESOURCE_NAME,
  };
}

function authorizationServerMetadataOf(issuer: string) {
  return {
    issuer,
    authorization_endpoint: `${issuer}${OAuthPath.Authorize}`,
    token_endpoint: `${issuer}${OAuthPath.Token}`,
    registration_endpoint: `${issuer}${OAuthPath.Register}`,
    revocation_endpoint: `${issuer}${OAuthPath.Revoke}`,
    response_types_supported: RESPONSE_TYPES_SUPPORTED,
    response_modes_supported: [RESPONSE_MODE_QUERY],
    grant_types_supported: GRANT_TYPES_SUPPORTED,
    code_challenge_methods_supported: [CODE_CHALLENGE_METHOD],
    token_endpoint_auth_methods_supported: [PUBLIC_CLIENT_AUTHENTICATION],
    revocation_endpoint_auth_methods_supported: [PUBLIC_CLIENT_AUTHENTICATION],
    scopes_supported: SUPPORTED_SCOPES,
    authorization_response_iss_parameter_supported: true,
  };
}

const DOCUMENT_OF_PATH: Record<OAuthMetadataPath, (issuer: string) => unknown> = {
  [OAuthMetadataPath.ProtectedResource]: protectedResourceMetadataOf,
  [OAuthMetadataPath.McpProtectedResource]: protectedResourceMetadataOf,
  [OAuthMetadataPath.AuthorizationServer]: authorizationServerMetadataOf,
};

export function isOAuthMetadataPath(pathname: string): pathname is OAuthMetadataPath {
  return pathname in DOCUMENT_OF_PATH;
}

export function serveOAuthMetadata({ request, env }: { request: Request; env: Env }): Response {
  const { pathname } = new URL(request.url);
  const issuer = oauthIssuerOf(env);
  const isServed = issuer !== null && isOAuthMetadataPath(pathname);
  if (!isServed) return noRouteResponse();
  return Response.json(DOCUMENT_OF_PATH[pathname](issuer), {
    status: HttpStatus.Ok,
    headers: { [HttpHeader.CacheControl]: PUBLIC_CACHE_CONTROL, ...OPEN_READ_HEADERS },
  });
}

// NB ADR 0109: every 401 from /mcp points at the protected resource metadata, and names the token invalid when one was sent.
export function mcpChallengeOf({ env, isCredentialSent }: { env: Env; isCredentialSent: boolean }): string {
  const issuer = oauthIssuerOf(env);
  if (issuer === null) return BEARER_CHALLENGE;
  const metadataParameter = `resource_metadata="${issuer}${OAuthMetadataPath.McpProtectedResource}"`;
  if (!isCredentialSent) return `${BEARER_CHALLENGE} ${metadataParameter}`;
  return `${BEARER_CHALLENGE} error="invalid_token", ${metadataParameter}`;
}
