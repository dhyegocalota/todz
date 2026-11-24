import { describe, expect, test } from 'vitest';
import { enumValueOf } from '../src/enum-value';

enum Flavor {
  Sweet = 'sweet',
  Sour = 'sour',
}

describe('enumValueOf', () => {
  test('returns the member whose value matches the candidate', () => {
    expect(enumValueOf({ enumeration: Flavor, candidate: 'sour' })).toBe(Flavor.Sour);
  });

  test('returns null when no member matches the candidate', () => {
    expect(enumValueOf({ enumeration: Flavor, candidate: 'bitter' })).toBeNull();
  });
});
