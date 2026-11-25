import { SIGN_IN_RATE_LIMIT_PERIOD_SECONDS } from '@todz/types';
import { clientRateKey } from './client-rate-key';
import { digestCredential } from './credential-digest';
import type { Env } from './env';
import { isLocalHost } from './local-origin';
import { OwnerErrorCode, errorResponse } from './owner-errors';
import type { PublicRoute } from './owner-request';
import { OwnerRoute } from './owner-routes';

const CLIENT_ADDRESS_HEADER = 'CF-Connecting-IP';
const RETRY_AFTER_HEADER = 'Retry-After';

enum SignInLimit {
  Client = 'client',
  Address = 'address',
  Global = 'global',
}

const LIMITER_OF_LIMIT: Record<SignInLimit, (env: Env) => RateLimit | undefined> = {
  [SignInLimit.Client]: (env) => env.SIGN_IN_LIMITER,
  [SignInLimit.Address]: (env) => env.SIGN_IN_ADDRESS_LIMITER,
  [SignInLimit.Global]: (env) => env.SIGN_IN_GLOBAL_LIMITER,
};

const LIMITS_OF_ROUTE: Record<PublicRoute, SignInLimit[]> = {
  [OwnerRoute.ReadSignInMethod]: [SignInLimit.Client],
  [OwnerRoute.RequestSignInLink]: [SignInLimit.Client, SignInLimit.Address, SignInLimit.Global],
  [OwnerRoute.SignIn]: [SignInLimit.Client, SignInLimit.Global],
};

export function signInRefusal(): Response {
  const refusal = errorResponse(OwnerErrorCode.SignInRefused);
  refusal.headers.set(RETRY_AFTER_HEADER, String(SIGN_IN_RATE_LIMIT_PERIOD_SECONDS));
  return refusal;
}

async function limitRefusal({ limiter, key }: { limiter: RateLimit | undefined; key: string }): Promise<Response | null> {
  if (limiter === undefined) return errorResponse(OwnerErrorCode.SignInUnavailable);
  const outcome = await limiter.limit({ key }).catch(() => null);
  if (outcome === null) return errorResponse(OwnerErrorCode.SignInUnavailable);
  if (outcome.success) return null;
  return signInRefusal();
}

// NB ADR 0045: on a public host a public sign-in route fails closed without its limiters or the client address, and only a local host skips them.
export async function signInLimitRefusal({
  request,
  env,
  route,
}: {
  request: Request;
  env: Env;
  route: PublicRoute;
}): Promise<Response | null> {
  if (isLocalHost({ env, request })) return null;
  const clientAddress = request.headers.get(CLIENT_ADDRESS_HEADER);
  const hasEveryLimiter = LIMITS_OF_ROUTE[route].every((limit) => LIMITER_OF_LIMIT[limit](env) !== undefined);
  const isUnguarded = clientAddress === null || !hasEveryLimiter;
  if (isUnguarded) return errorResponse(OwnerErrorCode.SignInUnavailable);
  return limitRefusal({ limiter: env.SIGN_IN_LIMITER, key: `${route}:${clientRateKey({ address: clientAddress })}` });
}

export async function addressLimitRefusal({
  request,
  env,
  address,
}: {
  request: Request;
  env: Env;
  address: string;
}): Promise<Response | null> {
  if (isLocalHost({ env, request })) return null;
  const key = `${OwnerRoute.RequestSignInLink}:${await digestCredential(address)}`;
  return limitRefusal({ limiter: env.SIGN_IN_ADDRESS_LIMITER, key });
}

export async function globalLimitRefusal({
  request,
  env,
  route,
}: {
  request: Request;
  env: Env;
  route: PublicRoute;
}): Promise<Response | null> {
  if (isLocalHost({ env, request })) return null;
  return limitRefusal({ limiter: env.SIGN_IN_GLOBAL_LIMITER, key: route });
}
