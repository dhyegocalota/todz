import type { Env } from './env';
import { isHeavyWriterRefusedOnCloud } from './owner-write-quota';
import { isSignedInRateLimited } from './signed-in-limiter';

// NB ADR 0099: at 95% the accounts that write above the average also read at a low per-owner rate, because the USD 5 rule is firmer than "reads keep working".
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
  if (!(await isHeavyWriterRefusedOnCloud({ env, ownerId, now }))) return false;
  return isSignedInRateLimited({ request, env, limiter: env.CLOUD_READ_LIMITER, key: ownerId });
}
