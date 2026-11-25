import { fieldOf, listOf, recordOf, textOf } from './json-reader';
import { type RecordedRequest, type RecordingFetch, recordingFetch } from './recording-fetch';

export const FAKE_SESSION_IDENTIFIER = 'session-1';
export const FIRST_FAKE_TASK_NUMBER = 100;

export type FakeMcpOptions = {
  toolAnswers?: Record<string, (argumentsOfCall: Record<string, unknown>) => string>;
  failingTools?: string[];
  isUnauthorized?: boolean;
};

export type FakeMcpServer = RecordingFetch & {
  rpcMethods: () => string[];
  toolCalls: () => { name: string; arguments: Record<string, unknown> }[];
};

const JSON_RPC_VERSION = '2.0';
const MODERN_VERSION = '2026-07-28';
const LEGACY_VERSION = '2025-11-25';

function rpcMethodOf(request: RecordedRequest): string | null {
  if (request.method !== 'POST') return null;
  return textOf(fieldOf({ value: request.body, name: 'method' }));
}

function afterATurn(response: Response): Promise<Response> {
  return new Promise((resolve) => setImmediate(() => resolve(response)));
}

function labelOf(request: RecordedRequest): string {
  const rpcMethod = rpcMethodOf(request);
  if (rpcMethod === null) return request.method;
  return rpcMethod;
}

function resultResponse({
  request,
  result,
  headers = {},
}: {
  request: RecordedRequest;
  result: unknown;
  headers?: Record<string, string>;
}): Response {
  const id = fieldOf({ value: request.body, name: 'id' });
  return Response.json({ jsonrpc: JSON_RPC_VERSION, id, result }, { headers });
}

function toolCallOf(request: RecordedRequest): { name: string; arguments: Record<string, unknown> } {
  const params = fieldOf({ value: request.body, name: 'params' });
  return { name: textOf(fieldOf({ value: params, name: 'name' })), arguments: recordOf(fieldOf({ value: params, name: 'arguments' })) };
}

export function fakeMcpServer({ toolAnswers = {}, failingTools = [], isUnauthorized = false }: FakeMcpOptions = {}): FakeMcpServer {
  const counter = { nextTaskNumber: FIRST_FAKE_TASK_NUMBER };
  const defaultAnswers: Record<string, (argumentsOfCall: Record<string, unknown>) => string> = {
    list: () => 'Open tasks: 2 of 7\nT-1 first\nT-2 second',
    add: (argumentsOfCall) =>
      listOf(argumentsOfCall.tasks)
        .map((task) => `Added T-${counter.nextTaskNumber++} ${textOf(fieldOf({ value: task, name: 'title' }))}`)
        .join('\n'),
    done: (argumentsOfCall) =>
      listOf(argumentsOfCall.ids)
        .map((identifier) => `Done ${textOf(identifier)} finished`)
        .join('\n'),
  };
  const server = recordingFetch((request) => {
    const rpcMethod = rpcMethodOf(request);
    if (request.method === 'DELETE') return new Response(null, { status: 200 });
    if (rpcMethod === null) return afterATurn(new Response(null, { status: 405 }));
    if (rpcMethod === 'initialize') {
      const result = { protocolVersion: LEGACY_VERSION, capabilities: { tools: {} }, serverInfo: { name: 'fake', version: '1' } };
      return resultResponse({ request, result, headers: { 'Mcp-Session-Id': FAKE_SESSION_IDENTIFIER } });
    }
    if (rpcMethod === 'server/discover') {
      return resultResponse({
        request,
        result: { ttlMs: 0, cacheScope: 'private', supportedVersions: [MODERN_VERSION], capabilities: {} },
      });
    }
    if (rpcMethod !== 'tools/call') return new Response(null, { status: 202 });
    if (isUnauthorized) return new Response(null, { status: 401 });
    const call = toolCallOf(request);
    const answer = { ...defaultAnswers, ...toolAnswers }[call.name];
    if (answer === undefined) throw new Error(`the fake server has no tool ${call.name}`);
    const isError = failingTools.includes(call.name);
    return resultResponse({
      request,
      result: { resultType: 'complete', isError, content: [{ type: 'text', text: answer(call.arguments) }] },
    });
  });
  const rpcMethods = () => server.requests.map(labelOf);
  const toolCalls = () => server.requests.filter((request) => rpcMethodOf(request) === 'tools/call').map(toolCallOf);
  return { ...server, rpcMethods, toolCalls };
}
