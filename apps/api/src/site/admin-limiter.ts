import { clientRateKey } from '../client-rate-key';
import { digestCredential } from '../credential-digest';
import type { Env } from '../env';
import { HttpHeader } from '../http-header';
import { LimitRefusal, limitRefusal } from '../limit-refusal';
import { isLocalSiteHost } from '../local-origin';
import { AdminNotice } from './admin-notice';
import { AdminPath } from './admin-paths';
import { isSiteUnguarded } from './site-limiter';

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

const NOTICE_OF_REFUSAL: Record<LimitRefusal, AdminRefusal> = {
  [LimitRefusal.TryAgain]: AdminNotice.TryAgain,
  [LimitRefusal.Unavailable]: AdminNotice.Closed,
};

async function refusalOfLimit({ env, limit, key }: { env: Env; limit: AdminLimit; key: string }): Promise<AdminRefusal | null> {
  const refusal = await limitRefusal({ limiter: LIMITER_OF_LIMIT[limit](env), key });
  if (refusal === null) return null;
  return NOTICE_OF_REFUSAL[refusal];
}

export function isAdminUnguarded({ request, env, limits }: { request: Request; env: Env; limits: AdminLimit[] }): boolean {
  const limiters = limits.map((limit) => LIMITER_OF_LIMIT[limit](env));
  return isSiteUnguarded({ request, env, limiters });
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
  if (clientAddress === null) return NOTICE_OF_REFUSAL[LimitRefusal.Unavailable];
  return refusalOfLimit({ env, limit: AdminLimit.Client, key: `${path}:${clientRateKey({ address: clientAddress })}` });
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
  return refusalOfLimit({ env, limit: AdminLimit.Address, key: `${AdminPath.SignInLinks}:${await digestCredential(address)}` });
}

export async function adminGlobalRefusal({ request, env }: { request: Request; env: Env }): Promise<AdminRefusal | null> {
  if (isLocalSiteHost({ env, request })) return null;
  return refusalOfLimit({ env, limit: AdminLimit.Global, key: AdminPath.SignInLinks });
}

export function isAdminCodeUnguarded({ request, env }: { request: Request; env: Env }): boolean {
  return isSiteUnguarded({ request, env, limiters: [env.ADMIN_LIMITER, env.SIGN_IN_CODE_LIMITER] });
}

const CODE_NOTICE_OF_REFUSAL: Record<LimitRefusal, AdminNotice.CodeLocked | AdminNotice.Closed> = {
  [LimitRefusal.TryAgain]: AdminNotice.CodeLocked,
  [LimitRefusal.Unavailable]: AdminNotice.Closed,
};

// NB ADR 0127: the admin code attempts count against the same per-client code limiter as the app's, and fail closed on a public host without it.
export async function adminCodeRefusal({
  request,
  env,
}: {
  request: Request;
  env: Env;
}): Promise<AdminNotice.CodeLocked | AdminNotice.Closed | null> {
  if (isLocalSiteHost({ env, request })) return null;
  const clientAddress = request.headers.get(HttpHeader.ClientAddress);
  if (clientAddress === null) return AdminNotice.Closed;
  const refusal = await limitRefusal({
    limiter: env.SIGN_IN_CODE_LIMITER,
    key: `${AdminPath.CodeSessions}:${clientRateKey({ address: clientAddress })}`,
  });
  if (refusal === null) return null;
  return CODE_NOTICE_OF_REFUSAL[refusal];
}
