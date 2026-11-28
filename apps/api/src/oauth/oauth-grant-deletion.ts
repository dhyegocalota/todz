import type { Env } from '../env';
import { Metric } from '../telemetry/metric';
import { incrementMetrics } from '../telemetry/metrics-store';
import { utcDayOf } from '../telemetry/telemetry-day';
import { isTelemetryOn } from '../telemetry/telemetry-mode';
import type { GrantDeletionReason } from './oauth-grant-deletion-reason';
import { clientNamesOf } from './oauth-store';

const GRANT_DELETION_EVENT = 'oauth_grant_deleted';

// NB ADR 0125: every grant deletion logs its reason and the client name, never a token, a digest, an address or an owner id, and counts the reason.
export async function recordGrantDeletions({
  env,
  reason,
  clientIds,
  now,
}: {
  env: Env;
  reason: GrantDeletionReason;
  clientIds: string[];
  now: number;
}): Promise<void> {
  if (clientIds.length === 0) return;
  const clientNames = await clientNamesOf({ directory: env.DIRECTORY, clientIds });
  clientNames.forEach((clientName) => console.log(JSON.stringify({ event: GRANT_DELETION_EVENT, reason, client_name: clientName })));
  if (!isTelemetryOn(env)) return;
  await incrementMetrics({
    database: env.DIRECTORY,
    writes: [{ day: utcDayOf(now), metric: Metric.OAuthGrantsDeleted, dimension: reason, amount: clientIds.length }],
  });
}
