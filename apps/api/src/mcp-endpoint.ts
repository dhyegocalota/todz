import {
  type CreateMcpHandlerOptions,
  INVALID_PARAMS,
  JSONRPC_VERSION,
  createMcpHandler,
  isInitializeRequest,
  isLegacyRequest,
} from '@modelcontextprotocol/server';
import { agentActor } from '@todz/core';
import { ActorKind, RuleIssue } from '@todz/types';
import { z } from 'zod';
import { bearerSecret, unauthorized } from './bearer-secret';
import type { Env } from './env';
import { HttpStatus } from './http-status';
import { MCP_COPY } from './mcp-copy';
import { FAIR_USE_COPY } from './fair-use-copy';
import { fairUseLimitsOf } from './fair-use-limits';
import { writeRefusalTextOf } from './owner-write-quota';
import { type McpServerScope, buildMcpServer, envelopeClientName } from './mcp-server';
import { openMcpSession } from './mcp-sessions';
import { calendarDateInTimeZone } from './owner-today';
import { parsedJson } from './parsed-json';
import { resultOf } from './project-result';
import { type KeyProject, openKeyProject } from './project-routing';
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

function quotaFieldsOf({ env, keyProject, now }: { env: Env; keyProject: KeyProject; now: number }): Pick<McpServerScope, 'limits' | 'refusalTextOf'> {
  return {
    limits: fairUseLimitsOf(env),
    refusalTextOf: ({ writes, bytes }) => writeRefusalTextOf({ env, ownerId: keyProject.ownerId, now, writes, bytes }),
  };
}

function legacyScope({ legacyRequest, clientName }: { legacyRequest: LegacyRequest; clientName: string }): McpServerScope {
  const { env, keyProject, today, now } = legacyRequest;
  return {
    project: keyProject.project,
    today,
    agentNudge: keyProject.agentNudge,
    clientNameOf: () => clientName,
    ...quotaFieldsOf({ env, keyProject, now }),
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

export async function serveMcp({ request, env, now }: { request: Request; env: Env; now: number }): Promise<Response> {
  const secret = bearerSecret(request);
  if (secret === null) return unauthorized();
  const sessionId = request.headers.get(SESSION_HEADER);
  const hasSession = sessionId !== null && sessionId.trim() !== '';
  const keyProject = await openKeyProject({ env, secret, mcpSession: hasSession ? { sessionId, now } : undefined });
  if (keyProject === null) return unauthorized();
  if (keyProject.isSuspended) {
    return jsonRpcError({ status: HttpStatus.Forbidden, id: null, code: ACCOUNT_SUSPENDED_CODE, message: FAIR_USE_COPY.suspended });
  }
  const isRateLimited = await isSignedInRateLimited({ request, env, limiter: env.MCP_LIMITER, key: keyProject.keyDigest });
  if (isRateLimited) return withRetryAfter(new Response(null, { status: HttpStatus.TooManyRequests }));
  if (request.method !== MCP_METHOD) return methodNotAllowed();
  const today = calendarDateInTimeZone({ timeZone: keyProject.timeZone, now });
  const isLegacy = await isLegacyRequest(request);
  if (isLegacy) return serveLegacy({ request, env, keyProject, today, now });
  const scope = {
    project: keyProject.project,
    today,
    agentNudge: keyProject.agentNudge,
    clientNameOf: envelopeClientName,
    ...quotaFieldsOf({ env, keyProject, now }),
  };
  return serveScope({ request, scope, era: ProtocolEra.Modern });
}
