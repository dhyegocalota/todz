import {
  type CreateMcpHandlerOptions,
  INVALID_PARAMS,
  JSONRPC_VERSION,
  createMcpHandler,
  isInitializeRequest,
  isLegacyRequest,
} from '@modelcontextprotocol/server';
import { agentActor } from '@todz/core';
import { ActorKind, OAUTH_ACCESS_TOKEN_PREFIX, OWNER_KEY_PREFIX, RuleIssue } from '@todz/types';
import { z } from 'zod';
import { bearerSecret, unauthorized } from './bearer-secret';
import type { Env } from './env';
import { HttpStatus } from './http-status';
import { MCP_COPY } from './mcp-copy';
import { FAIR_USE_COPY } from './fair-use-copy';
import { fairUseLimitsOf } from './fair-use-limits';
import { buildOwnerMcpServer } from './mcp-owner-server';
import { type McpServerScope, buildMcpServer, envelopeClientName } from './mcp-server';
import { isReadThrottled } from './cloud-read-throttle';
import { logCrash } from './crash-log';
import { stampOwnerSeen } from './owner-last-seen';
import { writeRefusalTextOf } from './owner-write-quota';
import { openMcpSession } from './mcp-sessions';
import { calendarDateInTimeZone } from './owner-today';
import { parsedJson } from './parsed-json';
import { resultOf } from './project-result';
import { mcpChallengeOf } from './oauth/oauth-metadata';
import { OAuthScope } from './oauth/oauth-scope';
import { type KeyProject, type OAuthAccess, type SessionOwner, openKeyProject, openOAuthAccess, openOwnerKey } from './project-routing';
import { isSignedInRateLimited, withRetryAfter } from './signed-in-limiter';

const SESSION_REQUIRED_CODE = -32000;
const SESSION_NOT_FOUND_CODE = -32001;
const ACCOUNT_SUSPENDED_CODE = -32003;
const SESSION_HEADER = 'Mcp-Session-Id';
const MCP_METHOD = 'POST';
const INITIALIZE_METHOD = 'initialize';

enum ProtocolEra {
  Legacy = 'legacy',
  Modern = 'modern',
}

enum McpCredential {
  OwnerKey = 'owner-key',
  AccessToken = 'access-token',
  ProjectKey = 'project-key',
}

type CredentialRequest = { request: Request; env: Env; secret: string; now: number };

// NB ADR 0016: a 2025-era request is served statelessly, a modern one by a handler that rejects the 2025 era.
const HANDLER_OPTIONS_OF_ERA: Record<ProtocolEra, CreateMcpHandlerOptions> = {
  [ProtocolEra.Legacy]: {},
  [ProtocolEra.Modern]: { legacy: 'reject' },
};

const InitializeMessageSchema = z.object({
  id: z.union([z.string(), z.number()]),
  method: z.literal(INITIALIZE_METHOD),
  params: z.unknown().optional(),
});
const InitializeParamsSchema = z.object({ clientInfo: z.object({ name: z.string() }) });

type RequestId = z.infer<typeof InitializeMessageSchema>['id'];

type LegacyRequest = { request: Request; env: Env; keyProject: KeyProject; today: string; now: number };

function methodNotAllowed(): Response {
  return new Response(null, { status: HttpStatus.MethodNotAllowed, headers: { Allow: MCP_METHOD } });
}

function jsonRpcError({ status, id, code, message }: { status: number; id: RequestId | null; code: number; message: string }): Response {
  return Response.json({ jsonrpc: JSONRPC_VERSION, id, error: { code, message } }, { status });
}

function validClientName(params: unknown): string | null {
  const parsedParams = InitializeParamsSchema.safeParse(params);
  if (!parsedParams.success) return null;
  const actorResult = resultOf(() => agentActor(parsedParams.data.clientInfo.name));
  if (!actorResult.ok) return null;
  const actor = actorResult.value;
  if (actor.kind !== ActorKind.Agent) return null;
  return actor.clientName;
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

function legacyScope({ legacyRequest, clientName }: { legacyRequest: LegacyRequest; clientName: string }): McpServerScope {
  const { env, keyProject, today, now } = legacyRequest;
  return {
    project: keyProject.project,
    workspace: keyProject.workspace,
    today,
    agentNudge: keyProject.agentNudge,
    clientNameOf: () => clientName,
    ...quotaFieldsOf({ env, ownerId: keyProject.ownerId, now }),
  };
}

async function initializeSession({
  legacyRequest,
  body,
  id,
  params,
}: {
  legacyRequest: LegacyRequest;
  body: unknown;
  id: RequestId;
  params: unknown;
}): Promise<Response> {
  const { request, env, keyProject, now } = legacyRequest;
  const clientName = validClientName(params);
  if (clientName === null) {
    return jsonRpcError({
      status: HttpStatus.BadRequest,
      id,
      code: INVALID_PARAMS,
      message: MCP_COPY.ruleIssue[RuleIssue.ClientNameInvalid],
    });
  }
  const response = await serveScope({ request, scope: legacyScope({ legacyRequest, clientName }), era: ProtocolEra.Legacy });
  const isAcceptedInitialize = isInitializeRequest(body) && response.ok;
  if (!isAcceptedInitialize) return response;
  const sessionId = await openMcpSession({ directory: env.DIRECTORY, keyDigest: keyProject.keyDigest, clientName, now });
  const sessionResponse = new Response(response.body, response);
  sessionResponse.headers.set(SESSION_HEADER, sessionId);
  return sessionResponse;
}

async function serveLegacy(legacyRequest: LegacyRequest): Promise<Response> {
  const { request, keyProject } = legacyRequest;
  const body = parsedJson(await request.clone().text());
  const initializeMessage = InitializeMessageSchema.safeParse(body);
  if (initializeMessage.success) {
    return initializeSession({ legacyRequest, body, id: initializeMessage.data.id, params: initializeMessage.data.params });
  }
  const sessionId = request.headers.get(SESSION_HEADER);
  const isMissingSession = sessionId === null || sessionId.trim() === '';
  if (isMissingSession) {
    return jsonRpcError({ status: HttpStatus.BadRequest, id: null, code: SESSION_REQUIRED_CODE, message: MCP_COPY.sessionRequired });
  }
  const { sessionClientName: clientName } = keyProject;
  if (clientName === null) {
    return jsonRpcError({ status: HttpStatus.NotFound, id: null, code: SESSION_NOT_FOUND_CODE, message: MCP_COPY.sessionNotFound });
  }
  return serveScope({ request, scope: legacyScope({ legacyRequest, clientName }), era: ProtocolEra.Legacy });
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
  now,
}: {
  request: Request;
  env: Env;
  owner: SessionOwner;
  now: number;
}): Promise<Response> {
  const scope = { env, owner, now, ...quotaFieldsOf({ env, ownerId: owner.ownerId, now }) };
  return createMcpHandler(() => buildOwnerMcpServer(scope), HANDLER_OPTIONS_OF_ERA[await eraOf(request)]).fetch(request);
}

async function serveOwnerKey({ request, env, secret, now }: CredentialRequest): Promise<Response> {
  const access = await openOwnerKey({ env, secret });
  if (access === null) return rejectedCredential(env);
  const { owner } = access;
  const refusal = await gateRefusalOf({
    request,
    env,
    limiterKey: owner.ownerId,
    ownerId: owner.ownerId,
    isSuspended: owner.isSuspended,
    now,
  });
  if (refusal !== null) return refusal;
  return serveOwnerScope({ request, env, owner, now });
}

async function serveProjectKey({ request, env, secret, now }: CredentialRequest): Promise<Response> {
  const sessionId = request.headers.get(SESSION_HEADER);
  const hasSession = sessionId !== null && sessionId.trim() !== '';
  const keyProject = await openKeyProject({ env, secret, mcpSession: hasSession ? { sessionId, now } : undefined });
  if (keyProject === null) return rejectedCredential(env);
  const { keyDigest, ownerId, isSuspended } = keyProject;
  const refusal = await gateRefusalOf({ request, env, limiterKey: keyDigest, ownerId, isSuspended, now });
  if (refusal !== null) return refusal;
  const today = calendarDateInTimeZone({ timeZone: keyProject.timeZone, now });
  const isLegacy = await isLegacyRequest(request);
  if (isLegacy) return serveLegacy({ request, env, keyProject, today, now });
  const scope = {
    project: keyProject.project,
    workspace: keyProject.workspace,
    today,
    agentNudge: keyProject.agentNudge,
    clientNameOf: envelopeClientName,
    ...quotaFieldsOf({ env, ownerId, now }),
  };
  return serveScope({ request, scope, era: ProtocolEra.Modern });
}

// NB ADR 0109: a grant's app is named by its registration in both eras, so an OAuth client keeps no MCP session rows.
async function serveGrantProject({
  request,
  env,
  keyProject,
  clientName,
  now,
}: {
  request: Request;
  env: Env;
  keyProject: KeyProject;
  clientName: string;
  now: number;
}): Promise<Response> {
  const scope = {
    project: keyProject.project,
    workspace: keyProject.workspace,
    today: calendarDateInTimeZone({ timeZone: keyProject.timeZone, now }),
    agentNudge: keyProject.agentNudge,
    clientNameOf: () => clientName,
    ...quotaFieldsOf({ env, ownerId: keyProject.ownerId, now }),
  };
  return serveScope({ request, scope, era: await eraOf(request) });
}

function grantGateOf(access: OAuthAccess): { limiterKey: string; ownerId: string; isSuspended: boolean } {
  if (access.scope === OAuthScope.Owner) {
    return { limiterKey: access.owner.ownerId, ownerId: access.owner.ownerId, isSuspended: access.owner.isSuspended };
  }
  return { limiterKey: access.grantId, ownerId: access.keyProject.ownerId, isSuspended: access.keyProject.isSuspended };
}

// NB ADR 0109: an OAuth access token is served exactly as the equivalent project key or owner key, never more.
async function serveAccessToken({ request, env, secret, now }: CredentialRequest): Promise<Response> {
  const access = await openOAuthAccess({ env, secret, now });
  if (access === null) return rejectedCredential(env);
  const refusal = await gateRefusalOf({ request, env, now, ...grantGateOf(access) });
  if (refusal !== null) return refusal;
  if (access.scope === OAuthScope.Owner) return serveOwnerScope({ request, env, owner: access.owner, now });
  return serveGrantProject({ request, env, keyProject: access.keyProject, clientName: access.clientName, now });
}

const SERVE_OF_CREDENTIAL: Record<McpCredential, (credentialRequest: CredentialRequest) => Promise<Response>> = {
  [McpCredential.OwnerKey]: serveOwnerKey,
  [McpCredential.AccessToken]: serveAccessToken,
  [McpCredential.ProjectKey]: serveProjectKey,
};

function credentialOf(secret: string): McpCredential {
  if (secret.startsWith(OWNER_KEY_PREFIX)) return McpCredential.OwnerKey;
  if (secret.startsWith(OAUTH_ACCESS_TOKEN_PREFIX)) return McpCredential.AccessToken;
  return McpCredential.ProjectKey;
}

export async function serveMcp({ request, env, now }: { request: Request; env: Env; now: number }): Promise<Response> {
  const secret = bearerSecret(request);
  if (secret === null) return unauthorized(mcpChallengeOf({ env, isCredentialSent: false }));
  return SERVE_OF_CREDENTIAL[credentialOf(secret)]({ request, env, secret, now });
}
