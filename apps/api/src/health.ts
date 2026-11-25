import type { Env } from './env';
import { HttpHeader, NO_STORE } from './http-header';
import { noRouteResponse } from './owner-errors';

export const HEALTH_PATH = '/health';
const HEALTH_METHOD = 'GET';
const SERVICE_NAME = 'todz';

export async function serveHealth({ request, env }: { request: Request; env: Env }): Promise<Response> {
  if (request.method !== HEALTH_METHOD) return noRouteResponse();
  if (env.PUBLIC_ORIGIN === undefined) return noRouteResponse();
  return Response.json({ service: SERVICE_NAME, origin: env.PUBLIC_ORIGIN }, { headers: { [HttpHeader.CacheControl]: NO_STORE } });
}
