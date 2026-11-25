import { APP_VERSION_HEADER, MINIMUM_APP_VERSION } from '@todz/types';
import { createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { env, exports } from 'cloudflare:workers';
import { z } from 'zod';
import type { Env } from '../src/env';
import { serveOwner } from '../src/owner-endpoint';

const WORKER_ORIGIN = 'http://localhost:8787';
const DEFAULT_TIME_ZONE = 'UTC';
const CREATED_STATUS = 201;
const JSON_MEDIA_TYPE = 'application/json';

const SignInAnswerSchema = z.object({ session_token: z.string(), owner: z.object({ id: z.string(), time_zone: z.string() }) });

export type OwnerCall = {
  method: string;
  path: string;
  token?: string;
  body?: unknown;
  rawBody?: string;
  headers?: Record<string, string>;
  origin?: string;
};

export type SignedInOwner = { token: string; ownerId: string; identityToken: string };

function requestOf(call: OwnerCall): Request {
  const { method, path, token, body, rawBody, headers, origin = WORKER_ORIGIN } = call;
  const authorization: Record<string, string> = token === undefined ? {} : { Authorization: `Bearer ${token}` };
  const payload = body === undefined ? rawBody : JSON.stringify(body);
  const contentType: Record<string, string> =
    payload === undefined ? {} : { 'Content-Type': JSON_MEDIA_TYPE, 'Content-Length': String(new TextEncoder().encode(payload).length) };
  const appVersion = { [APP_VERSION_HEADER]: MINIMUM_APP_VERSION };
  return new Request(`${origin}${path}`, { method, headers: { ...appVersion, ...authorization, ...contentType, ...headers }, body: payload });
}

export function ownerCall(call: OwnerCall): Promise<Response> {
  return exports.default.fetch(requestOf(call));
}

export async function serveOwnerCall({
  call,
  now,
  workerEnv = env,
  executionContext,
}: {
  call: OwnerCall;
  now: number;
  workerEnv?: Env;
  executionContext?: ExecutionContext;
}): Promise<Response> {
  if (executionContext !== undefined) return serveOwner({ request: requestOf(call), env: workerEnv, now, executionContext });
  const settledContext = createExecutionContext();
  const response = await serveOwner({ request: requestOf(call), env: workerEnv, now, executionContext: settledContext });
  await waitOnExecutionContext(settledContext);
  return response;
}

export function workerEnvWith(settings: Partial<Env>): Env {
  return { DIRECTORY: env.DIRECTORY, PROJECT_STORE: env.PROJECT_STORE, ...settings };
}

export function recordingEnv(settings: Partial<Env> = {}): { workerEnv: Env; statements: string[] } {
  const statements: string[] = [];
  const directory = new Proxy(env.DIRECTORY, {
    get(target, property) {
      const member = Reflect.get(target, property);
      if (typeof member !== 'function') return member;
      return (...parameters: unknown[]) => {
        if (property === 'prepare') statements.push(String(parameters[0]));
        return member.apply(target, parameters);
      };
    },
  }) as D1Database;
  return { workerEnv: { DIRECTORY: directory, PROJECT_STORE: env.PROJECT_STORE, ...settings }, statements };
}

export function signInCall({ identityToken, timeZone }: { identityToken: string; timeZone: string }): OwnerCall {
  return { method: 'POST', path: '/owner/sessions', body: { identity_token: identityToken, time_zone: timeZone } };
}

export async function signInOwner({
  identityToken = crypto.randomUUID(),
  timeZone = DEFAULT_TIME_ZONE,
}: { identityToken?: string; timeZone?: string } = {}): Promise<SignedInOwner> {
  const response = await ownerCall(signInCall({ identityToken, timeZone }));
  if (response.status !== CREATED_STATUS) throw new Error(`sign-in answered ${response.status}`);
  const answer = SignInAnswerSchema.parse(await response.json());
  return { token: answer.session_token, ownerId: answer.owner.id, identityToken };
}

export type OwnedProject = SignedInOwner & { projectId: string };

export async function createOwnedProject(): Promise<OwnedProject> {
  const owner = await signInOwner();
  const response = await ownerCall({ method: 'POST', path: '/owner/workspaces', token: owner.token, body: { name: 'Work' } });
  const { workspace } = await response.json<{ workspace: { projects: { id: string }[] } }>();
  const [inbox] = workspace.projects;
  if (inbox === undefined) throw new Error('a workspace has an Inbox');
  return { ...owner, projectId: inbox.id };
}

export async function issueMcpKey({ token, projectId }: { token: string; projectId: string }): Promise<string> {
  const response = await ownerCall({ method: 'POST', path: `/owner/projects/${projectId}/keys`, token });
  if (response.status !== CREATED_STATUS) throw new Error(`issue key answered ${response.status}`);
  const { secret } = await response.json<{ secret: string }>();
  return secret;
}

export function projectCall({
  project,
  method,
  path,
  body,
  rawBody,
  headers,
}: {
  project: OwnedProject;
  method: string;
  path: string;
  body?: unknown;
  rawBody?: string;
  headers?: Record<string, string>;
}): Promise<Response> {
  return ownerCall({ method, path: `/owner/projects/${project.projectId}${path}`, token: project.token, body, rawBody, headers });
}
