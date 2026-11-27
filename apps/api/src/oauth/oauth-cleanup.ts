import type { Env } from '../env';
import { OAUTH_IDLE_CLIENT_LIFETIME_MS } from './oauth-paths';
import { deleteSpentOAuthRows } from './oauth-store';

// NB ADR 0109: the nightly run deletes expired codes, sessions and tokens and the registrations idle for 30 days without a grant.
export async function runOAuthCleanup({ scheduledTime, env }: { scheduledTime: number; env: Env }): Promise<void> {
  await deleteSpentOAuthRows({ directory: env.DIRECTORY, now: scheduledTime, idleSince: scheduledTime - OAUTH_IDLE_CLIENT_LIFETIME_MS });
}
