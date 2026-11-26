import { cloudAccountsMaxOf } from './cloud-accounts-max';
import type { Env } from './env';
import { utcDayOf } from './telemetry/telemetry-day';

const STAMP_LAST_SEEN = 'UPDATE owners SET last_seen_day = ?1 WHERE id = ?2 AND (last_seen_day IS NULL OR last_seen_day < ?1)';

// NB ADR 0099: a signed-in owner is active the day it is seen, so a read-only owner keeps its spot; the statement writes at most once a day.
export async function stampOwnerSeen({ env, ownerId, now }: { env: Env; ownerId: string; now: number }): Promise<void> {
  if (cloudAccountsMaxOf(env) === null) return;
  await env.DIRECTORY.prepare(STAMP_LAST_SEEN).bind(utcDayOf(now), ownerId).run();
}
