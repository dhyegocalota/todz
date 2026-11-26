import { cloudAccountsMaxOf } from './cloud-accounts-max';
import { isOwnerOfAddress } from './cloud-budget-store';
import { isRefusingMonth } from './cloud-level';
import type { Env } from './env';
import { isSignedInRateLimited } from './signed-in-limiter';
import { adminEmailOf } from './site/admin-session';

// NB ADR 0099: at 95% every owner but the admin's reads at a low per-owner rate, because the USD 5 rule is firmer than "reads keep working" and an account with no writes can still use up the request pools.
export async function isReadThrottled({
  request,
  env,
  ownerId,
  now,
}: {
  request: Request;
  env: Env;
  ownerId: string;
  now: number;
}): Promise<boolean> {
  if (cloudAccountsMaxOf(env) === null) return false;
  if (!(await isRefusingMonth({ env, now }))) return false;
  const adminAddress = adminEmailOf(env);
  const isAdminOwner = adminAddress !== null && (await isOwnerOfAddress({ directory: env.DIRECTORY, ownerId, address: adminAddress }));
  if (isAdminOwner) return false;
  return isSignedInRateLimited({ request, env, limiter: env.CLOUD_READ_LIMITER, key: ownerId });
}
