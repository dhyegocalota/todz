import { describe, expect, test } from 'vitest';
import { replyAddressOf, replySecretOf } from '../../src/day-email/reply-recipient';

const SECRET = 'ab'.repeat(16);

describe('replySecretOf', () => {
  test.each([[`reply+${SECRET}@todz.app`], [`REPLY+${SECRET.toUpperCase()}@TODZ.APP`]])(
    '%s gives the secret in lower case',
    (recipient) => {
      expect(replySecretOf(recipient)).toBe(SECRET);
    },
  );

  test.each([
    [`reply+${SECRET.slice(1)}@todz.app`],
    [`reply+${SECRET}0@todz.app`],
    [`reply+${SECRET.slice(1)}g@todz.app`],
    ['reply@todz.app'],
    [`reply+${SECRET}@evil.test`],
    [`reply+${SECRET}@todz.app.evil.test`],
    [`hello+${SECRET}@todz.app`],
    [`xreply+${SECRET}@todz.app`],
    [` reply+${SECRET}@todz.app`],
    [`reply+${SECRET}@todz.app\n`],
    ['hello@todz.app'],
    [''],
  ])('%j gives none', (recipient) => {
    expect(replySecretOf(recipient)).toBeNull();
  });
});

describe('replyAddressOf', () => {
  test('the address issued for a secret is the recipient that gives the secret back', () => {
    expect(replyAddressOf(SECRET)).toBe(`reply+${SECRET}@todz.app`);
    expect(replySecretOf(replyAddressOf(SECRET))).toBe(SECRET);
  });
});
