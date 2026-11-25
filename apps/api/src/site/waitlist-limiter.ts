import { clientRateKey } from '../client-rate-key';
import { digestCredential } from '../credential-digest';
import type { Env } from '../env';
import { HttpHeader } from '../http-header';
import { isLocalSiteHost } from '../local-origin';
import { LandingNotice } from './landing-page';
import { SiteLimitRefusal, isSiteUnguarded, limitRefusal } from './site-limiter';
import { JOIN_PATH } from './site-shell';

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

const NOTICE_OF_REFUSAL: Record<SiteLimitRefusal, WaitlistRefusal> = {
  [SiteLimitRefusal.TryAgain]: LandingNotice.TryAgain,
  [SiteLimitRefusal.Unavailable]: LandingNotice.OpensSoon,
};

async function refusalOfLimit({ env, limit, key }: { env: Env; limit: WaitlistLimit; key: string }): Promise<WaitlistRefusal | null> {
  const refusal = await limitRefusal({ limiter: LIMITER_OF_LIMIT[limit](env), key });
  if (refusal === null) return null;
  return NOTICE_OF_REFUSAL[refusal];
}

export function isWaitlistUnguarded({ request, env }: { request: Request; env: Env }): boolean {
  const limiters = Object.values(WaitlistLimit).map((limit) => LIMITER_OF_LIMIT[limit](env));
  return isSiteUnguarded({ request, env, limiters });
}

export async function waitlistClientRefusal({ request, env }: { request: Request; env: Env }): Promise<WaitlistRefusal | null> {
  if (isLocalSiteHost({ env, request })) return null;
  const clientAddress = request.headers.get(HttpHeader.ClientAddress);
  if (clientAddress === null) return NOTICE_OF_REFUSAL[SiteLimitRefusal.Unavailable];
  return refusalOfLimit({ env, limit: WaitlistLimit.Client, key: `${JOIN_PATH}:${clientRateKey({ address: clientAddress })}` });
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
  return refusalOfLimit({ env, limit: WaitlistLimit.Address, key: `${JOIN_PATH}:${await digestCredential(address)}` });
}

export async function waitlistGlobalRefusal({ request, env }: { request: Request; env: Env }): Promise<WaitlistRefusal | null> {
  if (isLocalSiteHost({ env, request })) return null;
  return refusalOfLimit({ env, limit: WaitlistLimit.Global, key: JOIN_PATH });
}
