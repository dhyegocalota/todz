import { MILLISECONDS_PER_SECOND, SIGN_IN_RATE_LIMIT_PERIOD_SECONDS } from '@todz/types';
import { clientRateKey } from './client-rate-key';
import { digestCredential } from './credential-digest';
import type { Env } from './env';
import { HttpHeader } from './http-header';
import { LimitRefusal, limitRefusal } from './limit-refusal';
import { isLocalHost } from './local-origin';
import { OwnerErrorCode, errorResponse } from './owner-errors';
import type { PublicRoute } from './owner-request';
import { OwnerRoute } from './owner-routes';

enum SignInLimit {
  Client = 'client',
  Address = 'address',
  Global = 'global',
  Code = 'code',
}

const LIMITER_OF_LIMIT: Record<SignInLimit, (env: Env) => RateLimit | undefined> = {
  [SignInLimit.Client]: (env) => env.SIGN_IN_LIMITER,
  [SignInLimit.Address]: (env) => env.SIGN_IN_ADDRESS_LIMITER,
  [SignInLimit.Global]: (env) => env.SIGN_IN_GLOBAL_LIMITER,
  [SignInLimit.Code]: (env) => env.SIGN_IN_CODE_LIMITER,
};

const LIMITS_OF_ROUTE: Record<PublicRoute, SignInLimit[]> = {
  [OwnerRoute.ReadSignInMethod]: [SignInLimit.Client],
  [OwnerRoute.RequestSignInLink]: [SignInLimit.Client, SignInLimit.Address, SignInLimit.Global],
  [OwnerRoute.SignIn]: [SignInLimit.Client, SignInLimit.Global],
};

export function signInRefusal(): Response {
  const refusal = errorResponse(OwnerErrorCode.SignInRefused);
  refusal.headers.set(HttpHeader.RetryAfter, String(SIGN_IN_RATE_LIMIT_PERIOD_SECONDS));
  return refusal;
}

const ANSWER_OF_REFUSAL: Record<LimitRefusal, () => Response> = {
  [LimitRefusal.TryAgain]: signInRefusal,
  [LimitRefusal.Unavailable]: () => errorResponse(OwnerErrorCode.SignInUnavailable),
};

async function refusalOfLimit({ limiter, key }: { limiter: RateLimit | undefined; key: string }): Promise<Response | null> {
  const refusal = await limitRefusal({ limiter, key });
  if (refusal === null) return null;
  return ANSWER_OF_REFUSAL[refusal]();
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
  const clientAddress = request.headers.get(HttpHeader.ClientAddress);
  const hasEveryLimiter = LIMITS_OF_ROUTE[route].every((limit) => LIMITER_OF_LIMIT[limit](env) !== undefined);
  const isUnguarded = clientAddress === null || !hasEveryLimiter;
  if (isUnguarded) return errorResponse(OwnerErrorCode.SignInUnavailable);
  return refusalOfLimit({ limiter: env.SIGN_IN_LIMITER, key: `${route}:${clientRateKey({ address: clientAddress })}` });
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
  return refusalOfLimit({ limiter: env.SIGN_IN_ADDRESS_LIMITER, key });
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
  return refusalOfLimit({ limiter: env.SIGN_IN_GLOBAL_LIMITER, key: route });
}

export function codeLockedResponse(retryAfterMs: number): Response {
  const refusal = errorResponse(OwnerErrorCode.CodeLocked);
  refusal.headers.set(HttpHeader.RetryAfter, String(Math.ceil(retryAfterMs / MILLISECONDS_PER_SECOND)));
  return refusal;
}

const ANSWER_OF_CODE_REFUSAL: Record<LimitRefusal, () => Response> = {
  [LimitRefusal.TryAgain]: () => codeLockedResponse(SIGN_IN_RATE_LIMIT_PERIOD_SECONDS * MILLISECONDS_PER_SECOND),
  [LimitRefusal.Unavailable]: () => errorResponse(OwnerErrorCode.SignInUnavailable),
};

// NB ADR 0127: a code attempt counts against its own per-client limiter, and on a public host it fails closed without the limiter or the client address.
export async function codeLimitRefusal({ request, env }: { request: Request; env: Env }): Promise<Response | null> {
  if (isLocalHost({ env, request })) return null;
  const clientAddress = request.headers.get(HttpHeader.ClientAddress);
  const isUnguarded = clientAddress === null || env.SIGN_IN_CODE_LIMITER === undefined;
  if (isUnguarded) return errorResponse(OwnerErrorCode.SignInUnavailable);
  const refusal = await limitRefusal({
    limiter: env.SIGN_IN_CODE_LIMITER,
    key: `${OwnerRoute.SignIn}:${SignInLimit.Code}:${clientRateKey({ address: clientAddress })}`,
  });
  if (refusal === null) return null;
  return ANSWER_OF_CODE_REFUSAL[refusal]();
}
