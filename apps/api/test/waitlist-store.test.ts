import { MILLISECONDS_PER_SECOND } from '@todz/types';
import { env } from 'cloudflare:workers';
import { describe, expect, test } from 'vitest';
import { joinWaitlist, recordConfirmationFailure } from '../src/site/waitlist-store';
import { freshAddress } from './email-sign-in-client';
import { CLOCK_NOW } from './task-fixtures';
import { waitlistRows } from './waitlist-rows';

const LATER = CLOCK_NOW + MILLISECONDS_PER_SECOND;
const FAILED_AT = LATER + MILLISECONDS_PER_SECOND;

describe('the waitlist store', () => {
  test('a first join keeps the address with its join time and claims the confirmation', async () => {
    const address = freshAddress();
    expect(await joinWaitlist({ database: env.DIRECTORY, address, now: CLOCK_NOW })).toBe(true);
    expect(await waitlistRows(address)).toEqual([
      { address, joined_at: CLOCK_NOW, confirmation_claimed_at: CLOCK_NOW, confirmation_failed_at: null },
    ]);
  });

  test('a second join of the address keeps one row, its first times, and claims nothing', async () => {
    const address = freshAddress();
    await joinWaitlist({ database: env.DIRECTORY, address, now: CLOCK_NOW });
    expect(await joinWaitlist({ database: env.DIRECTORY, address, now: LATER })).toBe(false);
    expect(await waitlistRows(address)).toEqual([
      { address, joined_at: CLOCK_NOW, confirmation_claimed_at: CLOCK_NOW, confirmation_failed_at: null },
    ]);
  });

  test('two concurrent joins of the address keep one row and only one claims the confirmation', async () => {
    const address = freshAddress();
    const claims = await Promise.all([
      joinWaitlist({ database: env.DIRECTORY, address, now: CLOCK_NOW }),
      joinWaitlist({ database: env.DIRECTORY, address, now: CLOCK_NOW }),
    ]);
    expect(claims.filter((isClaimed) => isClaimed)).toHaveLength(1);
    expect(await waitlistRows(address)).toHaveLength(1);
  });

  test('two addresses each claim their own confirmation', async () => {
    const [first, second] = [freshAddress(), freshAddress()];
    expect(await joinWaitlist({ database: env.DIRECTORY, address: first, now: CLOCK_NOW })).toBe(true);
    expect(await joinWaitlist({ database: env.DIRECTORY, address: second, now: CLOCK_NOW })).toBe(true);
  });

  test('a failed confirmation is recorded on the row and keeps its claim', async () => {
    const address = freshAddress();
    await joinWaitlist({ database: env.DIRECTORY, address, now: CLOCK_NOW });
    await recordConfirmationFailure({ database: env.DIRECTORY, address, now: FAILED_AT });
    expect(await waitlistRows(address)).toEqual([
      { address, joined_at: CLOCK_NOW, confirmation_claimed_at: CLOCK_NOW, confirmation_failed_at: FAILED_AT },
    ]);
  });

  test('recording a failure for an address not on the list adds no row', async () => {
    const address = freshAddress();
    await recordConfirmationFailure({ database: env.DIRECTORY, address, now: FAILED_AT });
    expect(await waitlistRows(address)).toEqual([]);
  });
});
