import { describe, expect, test } from 'vitest';
import { formatShortId, parseShortId } from './short-id';

const TWELFTH_TASK_NUMBER = 12;
const LARGEST_SHORT_ID_NUMBER = 999_999_999;

describe('formatShortId', () => {
  test('prefixes the number', () => {
    expect(formatShortId(TWELFTH_TASK_NUMBER)).toBe('T-12');
  });
});

describe('parseShortId', () => {
  test.each(['T-12', ' t-12 ', 'T-12\n'])('reads %j as 12', (text) => {
    expect(parseShortId(text)).toBe(TWELFTH_TASK_NUMBER);
  });

  test('accepts the largest number', () => {
    expect(parseShortId('T-999999999')).toBe(LARGEST_SHORT_ID_NUMBER);
  });

  test.each(['T-0', 'T-012', '12', 'T12', 'T-', 'T-1.5', 'T--1', 'T-1000000000', ''])('rejects %j', (text) => {
    expect(parseShortId(text)).toBeNull();
  });
});
