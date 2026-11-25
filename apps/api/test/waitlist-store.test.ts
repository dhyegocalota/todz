import { MILLISECONDS_PER_DAY, MILLISECONDS_PER_HOUR, MILLISECONDS_PER_SECOND, WAITLIST_DAILY_JOINS_MAX } from '@todz/types';
import { env } from 'cloudflare:workers';
import { describe, expect, onTestFinished, test } from 'vitest';
import { WaitlistJoin, joinWaitlistWithinLimit, recordConfirmationFailure } from '../src/site/waitlist-store';
import { freshAddress } from './email-sign-in-client';
import { CLOCK_NOW } from './task-fixtures';
import { deleteSeededJoins, seedJoins, waitlistRows } from './waitlist-client';

const FULL_DAY_OFFSET = 100 * MILLISECONDS_PER_DAY;
const OLD_DAY_OFFSET = 200 * MILLISECONDS_PER_DAY;
const KNOWN_DAY_OFFSET = 300 * MILLISECONDS_PER_DAY;
const LATER = CLOCK_NOW + MILLISECONDS_PER_SECOND;
const FAILED_AT = LATER + MILLISECONDS_PER_SECOND;

describe('the waitlist store', () => {
  test('a first join keeps the address with its join time and claims the confirmation', async () => {
    const address = freshAddress();
    expect(await joinWaitlistWithinLimit({ database: env.DIRECTORY, address, now: CLOCK_NOW })).toBe(WaitlistJoin.Claimed);
    expect(await waitlistRows(address)).toEqual([
      { address, joined_at: CLOCK_NOW, confirmation_claimed_at: CLOCK_NOW, confirmation_failed_at: null },
    ]);
  });

  test('a second join of the address keeps one row, its first times, and claims nothing', async () => {
    const address = freshAddress();
    await joinWaitlistWithinLimit({ database: env.DIRECTORY, address, now: CLOCK_NOW });
    expect(await joinWaitlistWithinLimit({ database: env.DIRECTORY, address, now: LATER })).toBe(WaitlistJoin.Known);
    expect(await waitlistRows(address)).toEqual([
      { address, joined_at: CLOCK_NOW, confirmation_claimed_at: CLOCK_NOW, confirmation_failed_at: null },
    ]);
  });

  test('two concurrent joins of the address keep one row and only one claims the confirmation', async () => {
    const address = freshAddress();
    const claims = await Promise.all([
      joinWaitlistWithinLimit({ database: env.DIRECTORY, address, now: CLOCK_NOW }),
      joinWaitlistWithinLimit({ database: env.DIRECTORY, address, now: CLOCK_NOW }),
    ]);
    expect(claims.filter((joined) => joined === WaitlistJoin.Claimed)).toHaveLength(1);
    expect(await waitlistRows(address)).toHaveLength(1);
  });

  test('two addresses each claim their own confirmation', async () => {
    const [first, second] = [freshAddress(), freshAddress()];
    expect(await joinWaitlistWithinLimit({ database: env.DIRECTORY, address: first, now: CLOCK_NOW })).toBe(WaitlistJoin.Claimed);
    expect(await joinWaitlistWithinLimit({ database: env.DIRECTORY, address: second, now: CLOCK_NOW })).toBe(WaitlistJoin.Claimed);
  });

  test('a failed confirmation is recorded on the row and keeps its claim', async () => {
    const address = freshAddress();
    await joinWaitlistWithinLimit({ database: env.DIRECTORY, address, now: CLOCK_NOW });
    await recordConfirmationFailure({ database: env.DIRECTORY, address, now: FAILED_AT });
    expect(await waitlistRows(address)).toEqual([
      { address, joined_at: CLOCK_NOW, confirmation_claimed_at: CLOCK_NOW, confirmation_failed_at: FAILED_AT },
    ]);
  });

  test('a join over the daily cap is full and keeps no row', async () => {
    const now = CLOCK_NOW + FULL_DAY_OFFSET;
    const prefix = await seedJoins({ count: WAITLIST_DAILY_JOINS_MAX, joinedAt: now - MILLISECONDS_PER_HOUR });
    onTestFinished(() => deleteSeededJoins(prefix));
    const address = freshAddress();
    expect(await joinWaitlistWithinLimit({ database: env.DIRECTORY, address, now })).toBe(WaitlistJoin.Full);
    expect(await waitlistRows(address)).toEqual([]);
  });

  test('joins older than a day do not count against the cap', async () => {
    const now = CLOCK_NOW + OLD_DAY_OFFSET;
    const prefix = await seedJoins({ count: WAITLIST_DAILY_JOINS_MAX, joinedAt: now - MILLISECONDS_PER_DAY });
    onTestFinished(() => deleteSeededJoins(prefix));
    const address = freshAddress();
    expect(await joinWaitlistWithinLimit({ database: env.DIRECTORY, address, now })).toBe(WaitlistJoin.Claimed);
    expect(await waitlistRows(address)).toHaveLength(1);
  });

  test('a known address over the cap is known, not full, so the answer stays alike', async () => {
    const now = CLOCK_NOW + KNOWN_DAY_OFFSET;
    const address = freshAddress();
    await joinWaitlistWithinLimit({ database: env.DIRECTORY, address, now: now - MILLISECONDS_PER_DAY });
    const prefix = await seedJoins({ count: WAITLIST_DAILY_JOINS_MAX, joinedAt: now - MILLISECONDS_PER_HOUR });
    onTestFinished(() => deleteSeededJoins(prefix));
    expect(await joinWaitlistWithinLimit({ database: env.DIRECTORY, address, now })).toBe(WaitlistJoin.Known);
  });

  test('recording a failure for an address not on the list adds no row', async () => {
    const address = freshAddress();
    await recordConfirmationFailure({ database: env.DIRECTORY, address, now: FAILED_AT });
    expect(await waitlistRows(address)).toEqual([]);
  });
});
