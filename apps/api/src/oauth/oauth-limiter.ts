import { clientRateKey } from '../client-rate-key';
import type { Env } from '../env';
import { HttpHeader } from '../http-header';
import { LimitRefusal, limitRefusal } from '../limit-refusal';
import { isLocalHost } from '../local-origin';
import { OAUTH_PATH_PREFIX, OAuthPath } from './oauth-paths';

export enum OAuthLimit {
  Route = 'route',
  Registration = 'registration',
  GlobalRegistration = 'global-registration',
}

const LIMITER_OF_LIMIT: Record<OAuthLimit, (env: Env) => RateLimit | undefined> = {
  [OAuthLimit.Route]: (env) => env.OAUTH_LIMITER,
  [OAuthLimit.Registration]: (env) => env.OAUTH_REGISTER_LIMITER,
  [OAuthLimit.GlobalRegistration]: (env) => env.OAUTH_REGISTER_GLOBAL_LIMITER,
};

const KEY_OF_LIMIT: Record<OAuthLimit, (clientKey: string) => string> = {
  [OAuthLimit.Route]: (clientKey) => `${OAUTH_PATH_PREFIX}:${clientKey}`,
  [OAuthLimit.Registration]: (clientKey) => `${OAuthPath.Register}:${clientKey}`,
  [OAuthLimit.GlobalRegistration]: () => OAuthPath.Register,
};

// NB ADR 0109: on a public host an OAuth route fails closed without its limiters or the client address, and only a local host skips them.
export async function oauthLimitRefusalOf({
  request,
  env,
  limits,
}: {
  request: Request;
  env: Env;
  limits: OAuthLimit[];
}): Promise<LimitRefusal | null> {
  if (isLocalHost({ env, request })) return null;
  const clientAddress = request.headers.get(HttpHeader.ClientAddress);
  const hasEveryLimiter = limits.every((limit) => LIMITER_OF_LIMIT[limit](env) !== undefined);
  const isUnguarded = clientAddress === null || !hasEveryLimiter;
  if (isUnguarded) return LimitRefusal.Unavailable;
  const clientKey = clientRateKey({ address: clientAddress });
  const refusals = await Promise.all(
    limits.map((limit) => limitRefusal({ limiter: LIMITER_OF_LIMIT[limit](env), key: KEY_OF_LIMIT[limit](clientKey) })),
  );
  const [refusal] = refusals.filter((candidate) => candidate !== null);
  if (refusal === undefined) return null;
  return refusal;
}
