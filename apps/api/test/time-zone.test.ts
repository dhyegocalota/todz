import { describe, expect, test } from 'vitest';
import { canonicalTimeZone } from '../src/time-zone';

const TIME_ZONE_MAX_LENGTH = 64;

describe('canonicalTimeZone', () => {
  test.each([
    ['UTC', 'UTC'],
    ['utc', 'UTC'],
    ['America/Sao_Paulo', 'America/Sao_Paulo'],
    ['america/sao_paulo', 'America/Sao_Paulo'],
    ['Asia/Kolkata', 'Asia/Kolkata'],
    ['Etc/GMT+1', 'Etc/GMT+1'],
  ])('%s is stored as %s', (raw, canonical) => {
    expect(canonicalTimeZone(raw)).toBe(canonical);
  });

  test.each([['Nope/Zone'], [''], [' UTC'], ['UTC '], ['Europe/Lisbon\n'], ['+01:00'], ['-03:00'], ['+0100']])('%j is refused', (raw) => {
    expect(canonicalTimeZone(raw)).toBeNull();
  });

  test('a name longer than the maximum is refused', () => {
    expect(canonicalTimeZone(`America/${'a'.repeat(TIME_ZONE_MAX_LENGTH)}`)).toBeNull();
  });
});
