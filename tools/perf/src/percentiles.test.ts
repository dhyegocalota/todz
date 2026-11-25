import { describe, expect, test } from 'vitest';
import { percentileOf } from './percentiles';

const ONE_TO_HUNDRED = Array.from({ length: 100 }, (_, index) => index + 1);

describe('percentileOf', () => {
  test('the nearest rank of one to a hundred is the percentile itself', () => {
    expect(percentileOf({ samples: ONE_TO_HUNDRED, percentile: 95 })).toBe(95);
    expect(percentileOf({ samples: ONE_TO_HUNDRED, percentile: 50 })).toBe(50);
    expect(percentileOf({ samples: ONE_TO_HUNDRED, percentile: 99 })).toBe(99);
  });

  test('a single sample is every percentile', () => {
    expect([1, 50, 95, 99, 100].map((percentile) => percentileOf({ samples: [7], percentile }))).toEqual([7, 7, 7, 7, 7]);
  });

  test('an unsorted input gives the answers of the sorted one and is left as it was', () => {
    const shuffled = [...ONE_TO_HUNDRED].reverse();
    expect(percentileOf({ samples: shuffled, percentile: 95 })).toBe(95);
    expect(shuffled[0]).toBe(100);
  });

  test('no samples throw', () => {
    expect(() => percentileOf({ samples: [], percentile: 50 })).toThrow('no samples');
  });
});
