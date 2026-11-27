import type { Env } from '../env';
import { deleteSpentOAuthRows } from './oauth-store';

// NB ADR 0109: the nightly run deletes expired codes, sessions and tokens and the registrations no endpoint would still accept.
export async function runOAuthCleanup({ scheduledTime, env }: { scheduledTime: number; env: Env }): Promise<void> {
  await deleteSpentOAuthRows({ directory: env.DIRECTORY, now: scheduledTime });
}
