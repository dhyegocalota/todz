import { HEALTH_SERVICE_NAME } from '@todz/types';
import type { Env } from './env';
import { HttpHeader, NO_STORE } from './http-header';
import { noRouteResponse } from './owner-errors';
import { publicOriginOf } from './sign-in-links';

export const HEALTH_PATH = '/health';
const HEALTH_METHOD = 'GET';

export async function serveHealth({ request, env }: { request: Request; env: Env }): Promise<Response> {
  if (request.method !== HEALTH_METHOD) return noRouteResponse();
  const publicOrigin = publicOriginOf(env.PUBLIC_ORIGIN);
  if (publicOrigin === null) return noRouteResponse();
  return Response.json({ service: HEALTH_SERVICE_NAME, origin: publicOrigin }, { headers: { [HttpHeader.CacheControl]: NO_STORE } });
}
