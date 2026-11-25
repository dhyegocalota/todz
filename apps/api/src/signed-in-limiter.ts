import { SIGNED_IN_RATE_LIMIT_PERIOD_SECONDS } from '@todz/types';
import type { Env } from './env';
import { HttpHeader } from './http-header';
import { LimitRefusal, limitRefusal } from './limit-refusal';
import { isLocalHost } from './local-origin';

export const SIGNED_IN_RETRY_AFTER = String(SIGNED_IN_RATE_LIMIT_PERIOD_SECONDS);

// NB ADR 0073: a signed-in limiter that is missing or down serves the request; only a refusal stops it.
export async function isSignedInRateLimited({
  request,
  env,
  limiter,
  key,
}: {
  request: Request;
  env: Env;
  limiter: RateLimit | undefined;
  key: string;
}): Promise<boolean> {
  if (isLocalHost({ env, request })) return false;
  return (await limitRefusal({ limiter, key })) === LimitRefusal.TryAgain;
}

export function withRetryAfter(refusal: Response): Response {
  refusal.headers.set(HttpHeader.RetryAfter, SIGNED_IN_RETRY_AFTER);
  return refusal;
}
