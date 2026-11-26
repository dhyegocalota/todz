import { enqueueAddress } from './cloud-queue-store';
import { isDisposableEmailAddress } from './disposable-email-domains';
import { isOwnDomainAddress } from './email-address';
import type { Env } from './env';

export enum QueueJoin {
  Accepted = 'accepted',
  Refused = 'refused',
}

export async function joinQueue({ env, address, now }: { env: Env; address: string; now: number }): Promise<QueueJoin> {
  if (isDisposableEmailAddress(address)) return QueueJoin.Refused;
  if (isOwnDomainAddress(address)) return QueueJoin.Accepted;
  await enqueueAddress({ directory: env.DIRECTORY, email: address, now });
  return QueueJoin.Accepted;
}
