import type { Env } from '../env';
import { HttpHeader } from '../http-header';
import { isLocalSiteHost } from '../local-origin';

export function isSiteUnguarded({ request, env, limiters }: { request: Request; env: Env; limiters: (RateLimit | undefined)[] }): boolean {
  if (isLocalSiteHost({ env, request })) return false;
  const hasEveryLimiter = limiters.every((limiter) => limiter !== undefined);
  return request.headers.get(HttpHeader.ClientAddress) === null || !hasEveryLimiter;
}
