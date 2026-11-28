import { type CreateMcpHandlerOptions, JSONRPC_VERSION, createMcpHandler, isLegacyRequest } from '@modelcontextprotocol/server';
import { OAUTH_ACCESS_TOKEN_PREFIX } from '@todz/types';
import { bearerSecret, unauthorized } from './bearer-secret';
import type { Env } from './env';
import { HttpStatus } from './http-status';
import { MCP_COPY } from './mcp-copy';
import { FAIR_USE_COPY } from './fair-use-copy';
import { fairUseLimitsOf } from './fair-use-limits';
import { type OwnerReach, buildOwnerMcpServer } from './mcp-owner-server';
import { type McpServerScope, buildMcpServer, mcpScopeOf } from './mcp-server';
import { isReadThrottled } from './cloud-read-throttle';
import { logCrash } from './crash-log';
import { stampOwnerSeen } from './owner-last-seen';
import { writeRefusalTextOf } from './owner-write-quota';
import { mcpChallengeOf, mcpResourceOf, oauthIssuerOf } from './oauth/oauth-metadata';
import { GrantShape } from './oauth/oauth-grant-scope';
import { type GrantProject, type OAuthAccess, type SessionOwner, openOAuthAccess } from './project-routing';
import { isSignedInRateLimited, withRetryAfter } from './signed-in-limiter';

const ACCOUNT_SUSPENDED_CODE = -32003;
const MCP_METHOD = 'POST';
const MCP_INVALID_TOKEN_ERROR = 'invalid_token';

enum ProtocolEra {
  Legacy = 'legacy',
  Modern = 'modern',
}

type CredentialRequest = { request: Request; env: Env; secret: string; now: number };

// NB ADR 0016: a 2025-era request is served statelessly, a modern one by a handler that rejects the 2025 era.
const HANDLER_OPTIONS_OF_ERA: Record<ProtocolEra, CreateMcpHandlerOptions> = {
  [ProtocolEra.Legacy]: {},
  [ProtocolEra.Modern]: { legacy: 'reject' },
};

type RequestId = string | number;

function methodNotAllowed(): Response {
  return new Response(null, { status: HttpStatus.MethodNotAllowed, headers: { Allow: MCP_METHOD } });
}

function jsonRpcError({ status, id, code, message }: { status: number; id: RequestId | null; code: number; message: string }): Response {
  return Response.json({ jsonrpc: JSONRPC_VERSION, id, error: { code, message } }, { status });
}

function serveScope({ request, scope, era }: { request: Request; scope: McpServerScope; era: ProtocolEra }): Promise<Response> {
  return createMcpHandler(() => buildMcpServer(scope), HANDLER_OPTIONS_OF_ERA[era]).fetch(request);
}

function quotaFieldsOf({
  env,
  ownerId,
  now,
}: {
  env: Env;
  ownerId: string;
  now: number;
}): Pick<McpServerScope, 'limits' | 'refusalTextOf'> {
  return {
    limits: fairUseLimitsOf(env),
    refusalTextOf: ({ writes, bytes }) => writeRefusalTextOf({ env, ownerId, now, writes, bytes }),
  };
}

function suspendedRefusal(): Response {
  return jsonRpcError({ status: HttpStatus.Forbidden, id: null, code: ACCOUNT_SUSPENDED_CODE, message: FAIR_USE_COPY.suspended });
}

async function gateRefusalOf({
  request,
  env,
  limiterKey,
  ownerId,
  isSuspended,
  now,
}: {
  request: Request;
  env: Env;
  limiterKey: string;
  ownerId: string;
  isSuspended: boolean;
  now: number;
}): Promise<Response | null> {
  const isRateLimited = await isSignedInRateLimited({ request, env, limiter: env.MCP_LIMITER, key: limiterKey });
  if (isRateLimited) return withRetryAfter(new Response(null, { status: HttpStatus.TooManyRequests }));
  const isThrottledOwner = await isReadThrottled({ request, env, ownerId, now });
  if (isThrottledOwner) return withRetryAfter(new Response(null, { status: HttpStatus.TooManyRequests }));
  await stampOwnerSeen({ env, ownerId, now }).catch(logCrash);
  if (isSuspended) return suspendedRefusal();
  if (request.method !== MCP_METHOD) return methodNotAllowed();
  return null;
}

function rejectedCredential(env: Env): Response {
  return unauthorized(mcpChallengeOf({ env, isCredentialSent: true }));
}

async function eraOf(request: Request): Promise<ProtocolEra> {
  const isLegacy = await isLegacyRequest(request);
  return isLegacy ? ProtocolEra.Legacy : ProtocolEra.Modern;
}

async function serveOwnerScope({
  request,
  env,
  owner,
  reach,
  clientName,
  now,
}: {
  request: Request;
  env: Env;
  owner: SessionOwner;
  reach: OwnerReach;
  clientName: string;
  now: number;
}): Promise<Response> {
  const scope = { env, owner, reach, now, clientNameOf: () => clientName, ...quotaFieldsOf({ env, ownerId: owner.ownerId, now }) };
  return createMcpHandler(() => buildOwnerMcpServer(scope), HANDLER_OPTIONS_OF_ERA[await eraOf(request)]).fetch(request);
}

// NB ADR 0109: a grant's app is named by its registration in both eras, so an OAuth client keeps no MCP session rows.
async function serveGrantProject({
  request,
  env,
  grantProject,
  clientName,
  now,
}: {
  request: Request;
  env: Env;
  grantProject: GrantProject;
  clientName: string;
  now: number;
}): Promise<Response> {
  const scope = mcpScopeOf({
    grantProject,
    now,
    clientNameOf: () => clientName,
    ...quotaFieldsOf({ env, ownerId: grantProject.ownerId, now }),
  });
  return serveScope({ request, scope, era: await eraOf(request) });
}

function grantGateOf(access: OAuthAccess): { limiterKey: string; ownerId: string; isSuspended: boolean } {
  if (access.scope === GrantShape.Owner) {
    return { limiterKey: access.owner.ownerId, ownerId: access.owner.ownerId, isSuspended: access.owner.isSuspended };
  }
  if (access.scope === GrantShape.Selection) {
    return { limiterKey: access.grantId, ownerId: access.owner.ownerId, isSuspended: access.owner.isSuspended };
  }
  return { limiterKey: access.grantId, ownerId: access.grantProject.ownerId, isSuspended: access.grantProject.isSuspended };
}

// NB ADR 0109: an OAuth access token is served as the project or the account its grant names, never more; ADR 0126 serves a selection by the owner server with the account tools left out.
async function serveAccessToken({ request, env, secret, now }: CredentialRequest): Promise<Response> {
  const access = await openOAuthAccess({ env, secret, now });
  if (access === null) return rejectedCredential(env);
  const refusal = await gateRefusalOf({ request, env, now, ...grantGateOf(access) });
  if (refusal !== null) return refusal;
  if (access.scope === GrantShape.Owner) {
    return serveOwnerScope({ request, env, owner: access.owner, reach: { shape: access.scope }, clientName: access.clientName, now });
  }
  if (access.scope === GrantShape.Selection) {
    const reach = { shape: access.scope, scopes: access.scopes };
    return serveOwnerScope({ request, env, owner: access.owner, reach, clientName: access.clientName, now });
  }
  return serveGrantProject({ request, env, grantProject: access.grantProject, clientName: access.clientName, now });
}

function formerCredentialRefusal(env: Env): Response {
  const issuer = oauthIssuerOf(env);
  const description = issuer === null ? MCP_COPY.apiKeysRemovedAtUnknownOrigin : MCP_COPY.apiKeysRemoved(mcpResourceOf(issuer));
  return Response.json(
    { error: MCP_INVALID_TOKEN_ERROR, error_description: description },
    { status: HttpStatus.Unauthorized, headers: { 'WWW-Authenticate': mcpChallengeOf({ env, isCredentialSent: true }) } },
  );
}

export async function serveMcp({ request, env, now }: { request: Request; env: Env; now: number }): Promise<Response> {
  const secret = bearerSecret(request);
  if (secret === null) return unauthorized(mcpChallengeOf({ env, isCredentialSent: false }));
  const isAccessToken = secret.startsWith(OAUTH_ACCESS_TOKEN_PREFIX);
  if (!isAccessToken) return formerCredentialRefusal(env);
  return serveAccessToken({ request, env, secret, now });
}
