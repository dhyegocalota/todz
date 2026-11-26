import { cloudAccountsMaxOf } from './cloud-accounts-max';
import { countActiveAccounts, isActiveOwner, isAdmittedAddress } from './cloud-queue-store';
import { findIdentityOwner } from './directory-owners';
import type { Env } from './env';
import { cloudFullResponse } from './owner-errors';
import { SignInProviderKind } from './sign-in-provider';

// NB ADR 0099: the cap gates only a new address and an account idle for 90 days; an active account is never refused.
export async function isCloudFullFor({ env, address, now }: { env: Env; address: string; now: number }): Promise<boolean> {
  const accountsMax = cloudAccountsMaxOf(env);
  if (accountsMax === null) return false;
  const directory = env.DIRECTORY;
  if (await isAdmittedAddress({ directory, email: address })) return false;
  const ownerId = await findIdentityOwner({ directory, provider: SignInProviderKind.Email, subject: address });
  if (ownerId !== null && (await isActiveOwner({ directory, ownerId, now }))) return false;
  return (await countActiveAccounts({ directory, now })) >= accountsMax;
}

export async function cloudFullRefusalOf({ env, address, now }: { env: Env; address: string; now: number }): Promise<Response | null> {
  if (!(await isCloudFullFor({ env, address, now }))) return null;
  return cloudFullResponse();
}
