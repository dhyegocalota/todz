import { SIGN_IN_RATE_LIMIT_PERIOD_SECONDS } from '@todz/types';
import { clientRateKey } from './client-rate-key';
import { isLocalOrigin } from './local-origin';
import type { Env } from './env';
import { OwnerErrorCode, errorResponse } from './owner-errors';
import { OwnerRoute } from './owner-routes';

const CLIENT_ADDRESS_HEADER = 'CF-Connecting-IP';
const RETRY_AFTER_HEADER = 'Retry-After';
const LIMITED_ROUTES: OwnerRoute[] = [OwnerRoute.SignIn, OwnerRoute.RequestSignInLink];

// NB ADR 0044: the local runtime sets the client address itself, so only a request that arrived on a public host is limited.
export async function signInLimitRefusal({
  request,
  env,
  route,
}: {
  request: Request;
  env: Env;
  route: OwnerRoute;
}): Promise<Response | null> {
  const clientAddress = request.headers.get(CLIENT_ADDRESS_HEADER);
  const { SIGN_IN_LIMITER: limiter } = env;
  if (!LIMITED_ROUTES.includes(route)) return null;
  if (isLocalOrigin(request.url)) return null;
  if (clientAddress === null) return null;
  if (limiter === undefined) return null;
  const { success } = await limiter.limit({ key: `${route}:${clientRateKey({ address: clientAddress })}` });
  if (success) return null;
  const refusal = errorResponse(OwnerErrorCode.TooManyRequests);
  refusal.headers.set(RETRY_AFTER_HEADER, String(SIGN_IN_RATE_LIMIT_PERIOD_SECONDS));
  return refusal;
}
