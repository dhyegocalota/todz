import { cloudAccountsMaxOf } from './cloud-accounts-max';
import type { Env } from './env';
import { utcDayOf } from './telemetry/telemetry-day';

const STAMP_LAST_SEEN = 'UPDATE owners SET last_seen_day = ?1 WHERE id = ?2 AND (last_seen_day IS NULL OR last_seen_day < ?1)';
const STAMPED_OWNERS_MAX = 10_000;

const stampedDayOfOwner = new Map<string, string>();

export function forgetStampedOwners(): void {
  stampedDayOfOwner.clear();
}

// NB ADR 0099: a signed-in owner or an agent key is active the day it is seen, so a read-only owner keeps its spot; an isolate stamps an owner once a day and the statement writes at most once a day.
export async function stampOwnerSeen({ env, ownerId, now }: { env: Env; ownerId: string; now: number }): Promise<void> {
  if (cloudAccountsMaxOf(env) === null) return;
  const day = utcDayOf(now);
  if (stampedDayOfOwner.get(ownerId) === day) return;
  await env.DIRECTORY.prepare(STAMP_LAST_SEEN).bind(day, ownerId).run();
  if (stampedDayOfOwner.size >= STAMPED_OWNERS_MAX) stampedDayOfOwner.clear();
  stampedDayOfOwner.set(ownerId, day);
}
