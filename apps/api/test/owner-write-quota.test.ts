import { FairUseLimit } from '@todz/types';
import { env } from 'cloudflare:workers';
import { describe, expect, test } from 'vitest';
import { fairUseLimitsOf } from '../src/fair-use-limits';
import { WriteRefusal, reserveOwnerWrites, setOwnerSuspension } from '../src/owner-usage-store';
import { signInOwner } from './owner-client';

const DAY = '2026-11-26';
const NEXT_DAY = '2026-11-27';
const NOW = Date.parse('2026-11-26T12:00:00Z');
const DAILY_WRITES_CAP = 10;
const STORED_BYTES_CAP = 1_000;
const CONCURRENT_RESERVATIONS = 20;

const LIMITS = {
  ...fairUseLimitsOf(env),
  [FairUseLimit.DailyWrites]: DAILY_WRITES_CAP,
  [FairUseLimit.StoredBytes]: STORED_BYTES_CAP,
};

type UsageRow = { writes: number; bytes: number };

function reserve({
  ownerId,
  day,
  writes,
  bytes,
}: {
  ownerId: string;
  day: string;
  writes: number;
  bytes: number;
}): Promise<WriteRefusal | null> {
  return reserveOwnerWrites({ directory: env.DIRECTORY, ownerId, day, writes, bytes, limits: LIMITS });
}

async function usageOf({ ownerId, day }: { ownerId: string; day: string }): Promise<UsageRow | null> {
  return env.DIRECTORY.prepare('SELECT writes, bytes FROM owner_usage WHERE owner_id = ? AND day = ?').bind(ownerId, day).first<UsageRow>();
}

describe('the write reservation', () => {
  test('a reservation under the caps records its writes and bytes for the day', async () => {
    const { ownerId } = await signInOwner();
    expect(await reserve({ ownerId, day: DAY, writes: 2, bytes: 100 })).toBeNull();
    expect(await usageOf({ ownerId, day: DAY })).toEqual({ writes: 2, bytes: 100 });
  });

  test('the reservation that passes the daily cap is refused and records nothing', async () => {
    const { ownerId } = await signInOwner();
    await reserve({ ownerId, day: DAY, writes: DAILY_WRITES_CAP - 2, bytes: 10 });
    expect(await reserve({ ownerId, day: DAY, writes: 3, bytes: 10 })).toBe(WriteRefusal.DailyWrites);
    expect(await usageOf({ ownerId, day: DAY })).toEqual({ writes: DAILY_WRITES_CAP - 2, bytes: 10 });
  });

  test('the reservation that passes the stored cap is refused and records nothing', async () => {
    const { ownerId } = await signInOwner();
    await reserve({ ownerId, day: DAY, writes: 1, bytes: STORED_BYTES_CAP - 50 });
    expect(await reserve({ ownerId, day: DAY, writes: 1, bytes: 51 })).toBe(WriteRefusal.StoredBytes);
    expect(await usageOf({ ownerId, day: DAY })).toEqual({ writes: 1, bytes: STORED_BYTES_CAP - 50 });
  });

  test('concurrent reservations at the last unit accept exactly the units left', async () => {
    const { ownerId } = await signInOwner();
    await reserve({ ownerId, day: DAY, writes: DAILY_WRITES_CAP - 5, bytes: 0 });
    const outcomes = await Promise.all(
      Array.from({ length: CONCURRENT_RESERVATIONS }, () => reserve({ ownerId, day: DAY, writes: 1, bytes: 0 })),
    );
    expect(outcomes.filter((outcome) => outcome === null)).toHaveLength(5);
    expect(await usageOf({ ownerId, day: DAY })).toEqual({ writes: DAILY_WRITES_CAP, bytes: 0 });
  });

  test('a new day starts a fresh daily count while the stored total carries over', async () => {
    const { ownerId } = await signInOwner();
    await reserve({ ownerId, day: DAY, writes: DAILY_WRITES_CAP, bytes: 100 });
    expect(await reserve({ ownerId, day: DAY, writes: 1, bytes: 1 })).toBe(WriteRefusal.DailyWrites);
    expect(await reserve({ ownerId, day: NEXT_DAY, writes: DAILY_WRITES_CAP - 1, bytes: 100 })).toBeNull();
    expect(await reserve({ ownerId, day: NEXT_DAY, writes: 1, bytes: STORED_BYTES_CAP - 200 + 1 })).toBe(WriteRefusal.StoredBytes);
  });

  test('a suspended owner is refused and records nothing', async () => {
    const { ownerId } = await signInOwner();
    await setOwnerSuspension({ directory: env.DIRECTORY, ownerId, suspendedAt: NOW });
    expect(await reserve({ ownerId, day: DAY, writes: 1, bytes: 1 })).toBe(WriteRefusal.Suspended);
    expect(await usageOf({ ownerId, day: DAY })).toBeNull();
  });
});
