import { CLOUD_LEVEL_CACHE_MS } from '@todz/types';
import { BudgetLevel } from './cloud-budget';
import { recordedLevelOf } from './cloud-budget-store';
import { cloudMonthOf } from './cloud-month';
import type { Env } from './env';

type CachedLevel = { month: string; level: Promise<BudgetLevel | null>; readAt: number };

let cachedLevel: CachedLevel | null = null;

export function forgetCloudLevel(): void {
  cachedLevel = null;
}

function isFresh({ cached, month, now }: { cached: CachedLevel; month: string; now: number }): boolean {
  return cached.month === month && now >= cached.readAt && now - cached.readAt < CLOUD_LEVEL_CACHE_MS;
}

// NB ADR 0099: an isolate reads the month's level once a minute, so a normal month adds no statement to a request.
export function cloudLevelOf({ env, now }: { env: Env; now: number }): Promise<BudgetLevel | null> {
  const { month } = cloudMonthOf(now);
  const cached = cachedLevel;
  if (cached !== null && isFresh({ cached, month, now })) return cached.level;
  const level = recordedLevelOf({ directory: env.DIRECTORY, month });
  const reading = { month, level, readAt: now };
  cachedLevel = reading;
  level.catch(() => {
    if (cachedLevel === reading) cachedLevel = null;
  });
  return level;
}

export async function isRefusingMonth({ env, now }: { env: Env; now: number }): Promise<boolean> {
  return (await cloudLevelOf({ env, now })) === BudgetLevel.Refusing;
}
