import { describe, expect, test } from 'vitest';
import { HOURS_PER_DAY, MILLISECONDS_PER_DAY, MILLISECONDS_PER_HOUR, MILLISECONDS_PER_MINUTE, MILLISECONDS_PER_SECOND } from './index';

const MILLISECONDS_IN_A_DAY = 86_400_000;
const MILLISECONDS_IN_AN_HOUR = 3_600_000;
const MILLISECONDS_IN_A_MINUTE = 60_000;

describe('time constants', () => {
  test('a minute is sixty seconds in milliseconds', () => {
    expect(MILLISECONDS_PER_MINUTE).toBe(MILLISECONDS_IN_A_MINUTE);
  });

  test('an hour is sixty minutes in milliseconds', () => {
    expect(MILLISECONDS_PER_HOUR).toBe(MILLISECONDS_IN_AN_HOUR);
  });

  test('a day is twenty-four hours in milliseconds', () => {
    expect(MILLISECONDS_PER_DAY).toBe(MILLISECONDS_IN_A_DAY);
    expect(MILLISECONDS_PER_DAY).toBe(HOURS_PER_DAY * MILLISECONDS_PER_HOUR);
  });

  test('every unit is a whole number of the one below', () => {
    expect(MILLISECONDS_PER_MINUTE % MILLISECONDS_PER_SECOND).toBe(0);
    expect(MILLISECONDS_PER_HOUR % MILLISECONDS_PER_MINUTE).toBe(0);
    expect(MILLISECONDS_PER_DAY % MILLISECONDS_PER_HOUR).toBe(0);
  });
});
