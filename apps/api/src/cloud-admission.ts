import { cloudAccountsMaxOf } from './cloud-accounts-max';
import {
  activityBoundsOf,
  admissionSinceOf,
  countActiveAccounts,
  countOutstandingAdmissions,
  isActiveOwner,
  isAdmittedAddress,
} from './cloud-queue-store';
import { findIdentityOwner } from './directory-owners';
import type { Env } from './env';
import { cloudFullResponse } from './owner-errors';
import { SignInProviderKind } from './sign-in-provider';
import { adminEmailOf } from './site/admin-session';

export type CloudCap = { accountsMax: number; isExempt: boolean; sinceMilliseconds: number; sinceDay: string; admissionSince: number };

// NB ADR 0099: the cap gates only a new address and an account idle for 90 days; an active account, an admitted address and the admin are never refused.
export async function isExemptAddress({ env, address, now }: { env: Env; address: string; now: number }): Promise<boolean> {
  if (address === adminEmailOf(env)) return true;
  return isAdmittedAddress({ directory: env.DIRECTORY, email: address, now });
}

export async function isCloudFullFor({ env, address, now }: { env: Env; address: string; now: number }): Promise<boolean> {
  const accountsMax = cloudAccountsMaxOf(env);
  if (accountsMax === null) return false;
  if (await isExemptAddress({ env, address, now })) return false;
  const directory = env.DIRECTORY;
  const ownerId = await findIdentityOwner({ directory, provider: SignInProviderKind.Email, subject: address });
  if (ownerId !== null && (await isActiveOwner({ directory, ownerId, now }))) return false;
  return (await admissionRoomOf({ env, now })) === 0;
}

export async function cloudCapOf({ env, address, now }: { env: Env; address: string; now: number }): Promise<CloudCap | null> {
  const accountsMax = cloudAccountsMaxOf(env);
  if (accountsMax === null) return null;
  return {
    accountsMax,
    isExempt: await isExemptAddress({ env, address, now }),
    ...activityBoundsOf(now),
    admissionSince: admissionSinceOf(now),
  };
}

export async function admissionRoomOf({ env, now }: { env: Env; now: number }): Promise<number | null> {
  const accountsMax = cloudAccountsMaxOf(env);
  if (accountsMax === null) return null;
  const directory = env.DIRECTORY;
  const [active, outstanding] = await Promise.all([
    countActiveAccounts({ directory, now }),
    countOutstandingAdmissions({ directory, now }),
  ]);
  return Math.max(accountsMax - active - outstanding, 0);
}

export async function cloudFullRefusalOf({ env, address, now }: { env: Env; address: string; now: number }): Promise<Response | null> {
  if (!(await isCloudFullFor({ env, address, now }))) return null;
  return cloudFullResponse();
}
