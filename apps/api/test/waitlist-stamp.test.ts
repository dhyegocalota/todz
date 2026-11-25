import { WAITLIST_FILL_HOLD_MS, WAITLIST_MINIMUM_FILL_MS } from '@todz/types';
import { describe, expect, test } from 'vitest';
import { StampVerdict, renderStampOf, stampVerdictOf } from '../src/site/waitlist-stamp';

const SECRET = '1x0000000000000000000000000000000AA';
const OTHER_SECRET = '2x0000000000000000000000000000000BB';
const RENDERED_AT = 1_790_000_000_000;
const STAMP_PATTERN = /^\d{13}\.[A-Za-z0-9_-]{43}$/;
const OVERSIZED_STAMP_LENGTH = 5_000;
const SEPARATOR = '.';
const NOW_AFTER_HOLD = RENDERED_AT + WAITLIST_FILL_HOLD_MS;

async function stampAt(secret: string): Promise<string> {
  return renderStampOf({ secret, renderedAt: RENDERED_AT });
}

function signatureOf(stamp: string): string {
  return stamp.slice(stamp.indexOf(SEPARATOR) + 1);
}

describe('renderStampOf', () => {
  test('writes the time, a dot and a 43 character base64url signature', async () => {
    expect(await stampAt(SECRET)).toMatch(STAMP_PATTERN);
  });

  test('is equal for the same time and secret', async () => {
    expect(await stampAt(SECRET)).toBe(await stampAt(SECRET));
  });

  test('differs by secret', async () => {
    expect(await stampAt(SECRET)).not.toBe(await stampAt(OTHER_SECRET));
  });
});

describe('stampVerdictOf', () => {
  test('finds Patient at exactly the minimum after the render', async () => {
    const verdict = await stampVerdictOf({ secret: SECRET, stamp: await stampAt(SECRET), now: RENDERED_AT + WAITLIST_MINIMUM_FILL_MS });
    expect(verdict).toBe(StampVerdict.Patient);
  });

  test('finds TooFast one millisecond earlier', async () => {
    const verdict = await stampVerdictOf({ secret: SECRET, stamp: await stampAt(SECRET), now: RENDERED_AT + WAITLIST_MINIMUM_FILL_MS - 1 });
    expect(verdict).toBe(StampVerdict.TooFast);
  });

  test('finds Forged when the stamp is from the future', async () => {
    const verdict = await stampVerdictOf({ secret: SECRET, stamp: await stampAt(SECRET), now: RENDERED_AT - 1 });
    expect(verdict).toBe(StampVerdict.Forged);
  });

  test('finds Forged when one character of the signature changes', async () => {
    const stamp = await stampAt(SECRET);
    const signature = signatureOf(stamp);
    const alteredFirstCharacter = signature.startsWith('A') ? 'B' : 'A';
    const altered = `${RENDERED_AT}${SEPARATOR}${alteredFirstCharacter}${signature.slice(1)}`;
    expect(await stampVerdictOf({ secret: SECRET, stamp: altered, now: NOW_AFTER_HOLD })).toBe(StampVerdict.Forged);
  });

  test('finds Forged when the time changes and the signature does not', async () => {
    const earlier = `${RENDERED_AT - WAITLIST_FILL_HOLD_MS}${SEPARATOR}${signatureOf(await stampAt(SECRET))}`;
    expect(await stampVerdictOf({ secret: SECRET, stamp: earlier, now: NOW_AFTER_HOLD })).toBe(StampVerdict.Forged);
  });

  test('finds Forged when signed with another secret', async () => {
    expect(await stampVerdictOf({ secret: SECRET, stamp: await stampAt(OTHER_SECRET), now: NOW_AFTER_HOLD })).toBe(StampVerdict.Forged);
  });

  test.each([['1'], ['abc.def'], ['x'.repeat(OVERSIZED_STAMP_LENGTH)]])('finds Forged for the malformed stamp %#', async (stamp) => {
    expect(await stampVerdictOf({ secret: SECRET, stamp, now: NOW_AFTER_HOLD })).toBe(StampVerdict.Forged);
  });

  test.each([[''], [undefined]])('finds Missing for %j', async (stamp) => {
    expect(await stampVerdictOf({ secret: SECRET, stamp, now: NOW_AFTER_HOLD })).toBe(StampVerdict.Missing);
  });

  test('pin: the minimum is shorter than the client hold', () => {
    expect(WAITLIST_MINIMUM_FILL_MS).toBeLessThan(WAITLIST_FILL_HOLD_MS);
  });
});
