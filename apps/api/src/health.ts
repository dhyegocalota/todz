import { HEALTH_SERVICE_NAME, MINIMUM_APP_VERSION } from '@todz/types';
import type { Env } from './env';
import { HttpHeader, NO_STORE } from './http-header';
import { HttpMethod } from './http-method';
import { noRouteResponse } from './owner-errors';
import { SERVER_VERSION } from './server-version';
import { publicOriginOf } from './sign-in-links';

export const HEALTH_PATH = '/health';
const HEALTH_METHODS: string[] = [HttpMethod.Get, HttpMethod.Head];

export async function serveHealth({ request, env }: { request: Request; env: Env }): Promise<Response> {
  if (!HEALTH_METHODS.includes(request.method)) return noRouteResponse();
  const publicOrigin = publicOriginOf(env.PUBLIC_ORIGIN);
  if (publicOrigin === null) return noRouteResponse();
  const response = Response.json(
    { service: HEALTH_SERVICE_NAME, origin: publicOrigin, version: SERVER_VERSION, minimum_app_version: MINIMUM_APP_VERSION },
    { headers: { [HttpHeader.CacheControl]: NO_STORE } },
  );
  if (request.method === HttpMethod.Head) return new Response(null, { headers: response.headers });
  return response;
}
