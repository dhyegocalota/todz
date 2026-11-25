import { describe, expect, test } from 'vitest';
import { isAppVersionAccepted } from '../src/app-version';

const MINIMUM = '0.2.0';
const LONG_MALFORMED = '1.'.repeat(100);

describe('isAppVersionAccepted', () => {
  test.each(['0.2.0', '0.2', '1', '0.10.0', '1.0.0'])('accepts %s against 0.2.0', (candidate) => {
    expect(isAppVersionAccepted({ candidate, minimum: MINIMUM })).toBe(true);
  });

  test.each(['0.1.9', '0.1', '0'])('refuses %s against 0.2.0', (candidate) => {
    expect(isAppVersionAccepted({ candidate, minimum: MINIMUM })).toBe(false);
  });

  test('compares numbers, not text', () => {
    expect(isAppVersionAccepted({ candidate: '0.10.0', minimum: '0.10.0' })).toBe(true);
    expect(isAppVersionAccepted({ candidate: '0.9.9', minimum: '0.10.0' })).toBe(false);
  });

  test.each(['', 'v0.2.0', '0.2.0-beta', '0.2.0.1', '0..2', ' 0.2.0', '0.2.0 ', '١.٠', '1234567890', LONG_MALFORMED])(
    'refuses the malformed %j',
    (candidate) => {
      expect(isAppVersionAccepted({ candidate, minimum: MINIMUM })).toBe(false);
    },
  );

  test('refuses a missing version', () => {
    expect(isAppVersionAccepted({ candidate: null, minimum: MINIMUM })).toBe(false);
  });
});
