import { describe, expect, test } from 'vitest';
import { calendarDateInTimeZone } from '../src/owner-today';

const AFTER_MIDNIGHT_IN_UTC = Date.parse('2026-11-24T01:30:00Z');
const HALF_AN_HOUR_BEFORE_NEW_YEAR_IN_UTC = Date.parse('2026-12-31T23:30:00Z');
const TWO_AM_ON_MARCH_FIRST_IN_UTC = Date.parse('2026-03-01T02:00:00Z');

describe('calendarDateInTimeZone', () => {
  test.each([
    { timeZone: 'America/Sao_Paulo', now: AFTER_MIDNIGHT_IN_UTC, today: '2026-11-23' },
    { timeZone: 'UTC', now: AFTER_MIDNIGHT_IN_UTC, today: '2026-11-24' },
    { timeZone: 'Pacific/Kiritimati', now: AFTER_MIDNIGHT_IN_UTC, today: '2026-11-24' },
    { timeZone: 'Asia/Tokyo', now: HALF_AN_HOUR_BEFORE_NEW_YEAR_IN_UTC, today: '2027-01-01' },
    { timeZone: 'America/Los_Angeles', now: TWO_AM_ON_MARCH_FIRST_IN_UTC, today: '2026-02-28' },
  ])('in $timeZone is $today', ({ timeZone, now, today }) => {
    expect(calendarDateInTimeZone({ timeZone, now })).toBe(today);
  });

  test('a zone that does not exist throws a RangeError', () => {
    expect(() => calendarDateInTimeZone({ timeZone: 'Not/A_Zone', now: AFTER_MIDNIGHT_IN_UTC })).toThrow(RangeError);
  });
});
