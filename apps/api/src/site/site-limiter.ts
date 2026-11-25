import type { Env } from '../env';
import { HttpHeader } from '../http-header';
import { isLocalSiteHost } from '../local-origin';

export enum SiteLimitRefusal {
  TryAgain = 'try-again',
  Unavailable = 'unavailable',
}

export async function limitRefusal({ limiter, key }: { limiter: RateLimit | undefined; key: string }): Promise<SiteLimitRefusal | null> {
  if (limiter === undefined) return SiteLimitRefusal.Unavailable;
  const outcome = await limiter.limit({ key }).catch(() => null);
  if (outcome === null) return SiteLimitRefusal.Unavailable;
  if (outcome.success) return null;
  return SiteLimitRefusal.TryAgain;
}

export function isSiteUnguarded({ request, env, limiters }: { request: Request; env: Env; limiters: (RateLimit | undefined)[] }): boolean {
  if (isLocalSiteHost({ env, request })) return false;
  const hasEveryLimiter = limiters.every((limiter) => limiter !== undefined);
  return request.headers.get(HttpHeader.ClientAddress) === null || !hasEveryLimiter;
}
