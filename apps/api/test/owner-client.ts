import { env, exports } from 'cloudflare:workers';
import { z } from 'zod';
import type { Env } from '../src/env';
import { serveOwner } from '../src/owner-endpoint';

const WORKER_ORIGIN = 'https://api.todz.test';
const DEFAULT_TIME_ZONE = 'UTC';
const CREATED_STATUS = 201;

const SignInAnswerSchema = z.object({ session_token: z.string(), owner: z.object({ id: z.string(), time_zone: z.string() }) });

export type OwnerCall = {
  method: string;
  path: string;
  token?: string;
  body?: unknown;
  rawBody?: string;
  headers?: Record<string, string>;
};

export type SignedInOwner = { token: string; ownerId: string; identityToken: string };

function requestOf(call: OwnerCall): Request {
  const { method, path, token, body, rawBody, headers } = call;
  const authorization: Record<string, string> = token === undefined ? {} : { Authorization: `Bearer ${token}` };
  const payload = body === undefined ? rawBody : JSON.stringify(body);
  return new Request(`${WORKER_ORIGIN}${path}`, { method, headers: { ...authorization, ...headers }, body: payload });
}

export function ownerCall(call: OwnerCall): Promise<Response> {
  return exports.default.fetch(requestOf(call));
}

export function serveOwnerCall({ call, now, workerEnv = env }: { call: OwnerCall; now: number; workerEnv?: Env }): Promise<Response> {
  return serveOwner({ request: requestOf(call), env: workerEnv, now });
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
