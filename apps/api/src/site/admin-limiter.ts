import { clientRateKey } from '../client-rate-key';
import { digestCredential } from '../credential-digest';
import type { Env } from '../env';
import { HttpHeader } from '../http-header';
import { isLocalSiteHost } from '../local-origin';
import { AdminPath } from './admin-paths';
import { AdminNotice } from './admin-waitlist';

export enum AdminLimit {
  Client = 'client',
  Address = 'address',
  Global = 'global',
}

export type AdminRefusal = AdminNotice.TryAgain | AdminNotice.Closed;

const LIMITER_OF_LIMIT: Record<AdminLimit, (env: Env) => RateLimit | undefined> = {
  [AdminLimit.Client]: (env) => env.ADMIN_LIMITER,
  [AdminLimit.Address]: (env) => env.ADMIN_ADDRESS_LIMITER,
  [AdminLimit.Global]: (env) => env.ADMIN_GLOBAL_LIMITER,
};

async function limitRefusal({ env, limit, key }: { env: Env; limit: AdminLimit; key: string }): Promise<AdminRefusal | null> {
  const limiter = LIMITER_OF_LIMIT[limit](env);
  if (limiter === undefined) return AdminNotice.Closed;
  const outcome = await limiter.limit({ key }).catch(() => null);
  if (outcome === null) return AdminNotice.Closed;
  if (outcome.success) return null;
  return AdminNotice.TryAgain;
}

export function isAdminUnguarded({ request, env, limits }: { request: Request; env: Env; limits: AdminLimit[] }): boolean {
  if (isLocalSiteHost({ env, request })) return false;
  const hasEveryLimiter = limits.every((limit) => LIMITER_OF_LIMIT[limit](env) !== undefined);
  return request.headers.get(HttpHeader.ClientAddress) === null || !hasEveryLimiter;
}

export async function adminClientRefusal({
  request,
  env,
  path,
}: {
  request: Request;
  env: Env;
  path: AdminPath;
}): Promise<AdminRefusal | null> {
  if (isLocalSiteHost({ env, request })) return null;
  const clientAddress = request.headers.get(HttpHeader.ClientAddress);
  if (clientAddress === null) return AdminNotice.Closed;
  return limitRefusal({ env, limit: AdminLimit.Client, key: `${path}:${clientRateKey({ address: clientAddress })}` });
}

export async function adminAddressRefusal({
  request,
  env,
  address,
}: {
  request: Request;
  env: Env;
  address: string;
}): Promise<AdminRefusal | null> {
  if (isLocalSiteHost({ env, request })) return null;
  return limitRefusal({ env, limit: AdminLimit.Address, key: `${AdminPath.SignInLinks}:${await digestCredential(address)}` });
}

export async function adminGlobalRefusal({ request, env }: { request: Request; env: Env }): Promise<AdminRefusal | null> {
  if (isLocalSiteHost({ env, request })) return null;
  return limitRefusal({ env, limit: AdminLimit.Global, key: AdminPath.SignInLinks });
}
