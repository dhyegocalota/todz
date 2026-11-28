import type { Env } from '../env';
import { backfillLegacyGrantScopes, deleteSpentOAuthRows } from './oauth-store';

// NB ADR 0109: the nightly run deletes expired codes, sessions and tokens and the registrations no endpoint would still accept; ADR 0126 adds the scopes of a grant stored before them.
export async function runOAuthCleanup({ scheduledTime, env }: { scheduledTime: number; env: Env }): Promise<void> {
  await deleteSpentOAuthRows({ directory: env.DIRECTORY, now: scheduledTime });
  await backfillLegacyGrantScopes(env.DIRECTORY);
}
