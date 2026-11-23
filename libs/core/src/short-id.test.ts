import { describe, expect, test } from 'vitest';
import { formatShortId, parseShortId } from './short-id';

const TWELFTH_TASK_NUMBER = 12;
const LARGEST_SHORT_ID_NUMBER = 999_999_999;

const IDEOGRAPHIC_SPACE = String.fromCharCode(0x3000);
const FULL_WIDTH_DIGIT_ZERO = 0xff10;
const ARABIC_INDIC_DIGIT_ZERO = 0x660;

function shiftedDigits({ digits, zeroCodePoint }: { digits: string; zeroCodePoint: number }): string {
  return [...digits].map((digit) => String.fromCharCode(zeroCodePoint + Number(digit))).join('');
}

function fullWidthDigits(digits: string): string {
  return shiftedDigits({ digits, zeroCodePoint: FULL_WIDTH_DIGIT_ZERO });
}

function arabicIndicDigits(digits: string): string {
  return shiftedDigits({ digits, zeroCodePoint: ARABIC_INDIC_DIGIT_ZERO });
}

describe('formatShortId', () => {
  test('prefixes the number', () => {
    expect(formatShortId(TWELFTH_TASK_NUMBER)).toBe('T-12');
  });
});

describe('parseShortId', () => {
  test.each(['T-12', ' t-12 ', 'T-12\n'])('reads %j as 12', (text) => {
    expect(parseShortId(text)).toBe(TWELFTH_TASK_NUMBER);
  });

  test.each([`T-${fullWidthDigits('12')}`, `T-${arabicIndicDigits('12')}`, 'T-12\n34', `T-1${arabicIndicDigits('2')}`])(
    'rejects non-ASCII digits and inner line breaks in %j (pin)',
    (text) => {
      expect(parseShortId(text)).toBeNull();
    },
  );

  test('trims a leading ideographic space (pin)', () => {
    expect(parseShortId(`${IDEOGRAPHIC_SPACE}T-12`)).toBe(TWELFTH_TASK_NUMBER);
  });

  test('accepts the largest number', () => {
    expect(parseShortId('T-999999999')).toBe(LARGEST_SHORT_ID_NUMBER);
  });

  test.each(['T-0', 'T-012', '12', 'T12', 'T-', 'T-1.5', 'T--1', 'T-1000000000', ''])('rejects %j', (text) => {
    expect(parseShortId(text)).toBeNull();
  });
});
