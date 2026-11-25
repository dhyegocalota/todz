import { clientRateKey } from '../client-rate-key';
import { digestCredential } from '../credential-digest';
import type { Env } from '../env';
import { isLocalSiteHost } from '../local-origin';
import { LandingNotice } from './landing-page';
import { JOIN_PATH } from './site-shell';

const CLIENT_ADDRESS_HEADER = 'CF-Connecting-IP';

enum WaitlistLimit {
  Client = 'client',
  Address = 'address',
  Global = 'global',
}

export type WaitlistRefusal = LandingNotice.TryAgain | LandingNotice.OpensSoon;

const LIMITER_OF_LIMIT: Record<WaitlistLimit, (env: Env) => RateLimit | undefined> = {
  [WaitlistLimit.Client]: (env) => env.WAITLIST_LIMITER,
  [WaitlistLimit.Address]: (env) => env.WAITLIST_ADDRESS_LIMITER,
  [WaitlistLimit.Global]: (env) => env.WAITLIST_GLOBAL_LIMITER,
};

async function limitRefusal({ env, limit, key }: { env: Env; limit: WaitlistLimit; key: string }): Promise<WaitlistRefusal | null> {
  const limiter = LIMITER_OF_LIMIT[limit](env);
  if (limiter === undefined) return LandingNotice.OpensSoon;
  const outcome = await limiter.limit({ key }).catch(() => null);
  if (outcome === null) return LandingNotice.OpensSoon;
  if (outcome.success) return null;
  return LandingNotice.TryAgain;
}

export function isWaitlistUnguarded({ request, env }: { request: Request; env: Env }): boolean {
  if (isLocalSiteHost({ env, request })) return false;
  const hasEveryLimiter = Object.values(WaitlistLimit).every((limit) => LIMITER_OF_LIMIT[limit](env) !== undefined);
  return request.headers.get(CLIENT_ADDRESS_HEADER) === null || !hasEveryLimiter;
}

export async function waitlistClientRefusal({ request, env }: { request: Request; env: Env }): Promise<WaitlistRefusal | null> {
  if (isLocalSiteHost({ env, request })) return null;
  const clientAddress = request.headers.get(CLIENT_ADDRESS_HEADER);
  if (clientAddress === null) return LandingNotice.OpensSoon;
  return limitRefusal({ env, limit: WaitlistLimit.Client, key: `${JOIN_PATH}:${clientRateKey({ address: clientAddress })}` });
}

export async function waitlistAddressRefusal({
  request,
  env,
  address,
}: {
  request: Request;
  env: Env;
  address: string;
}): Promise<WaitlistRefusal | null> {
  if (isLocalSiteHost({ env, request })) return null;
  return limitRefusal({ env, limit: WaitlistLimit.Address, key: `${JOIN_PATH}:${await digestCredential(address)}` });
}

export async function waitlistGlobalRefusal({ request, env }: { request: Request; env: Env }): Promise<WaitlistRefusal | null> {
  if (isLocalSiteHost({ env, request })) return null;
  return limitRefusal({ env, limit: WaitlistLimit.Global, key: JOIN_PATH });
}
