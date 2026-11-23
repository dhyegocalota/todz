const DIGITS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const BASE = DIGITS.length;
const ZERO_DIGIT = DIGITS.charAt(0);
const LAST_DIGIT = DIGITS.charAt(BASE - 1);
const POSITIVE_HEAD_START = 'a';
const POSITIVE_HEAD_END = 'z';
const NEGATIVE_HEAD_START = 'A';
const NEGATIVE_HEAD_END = 'Z';
const HEAD_LENGTH_OFFSET = 2;
const INTEGER_ZERO = `${POSITIVE_HEAD_START}${ZERO_DIGIT}`;
const SMALLEST_INTEGER = `${NEGATIVE_HEAD_START}${ZERO_DIGIT.repeat(NEGATIVE_HEAD_END.charCodeAt(0) - NEGATIVE_HEAD_START.charCodeAt(0) + 1)}`;
const NEXT_DIGIT_STEP = 1;
const PREVIOUS_DIGIT_STEP = -1;
const HEAD_STEP_UP = 1;
const HEAD_STEP_DOWN = -1;
const HALF = 2;
const ORDER_ERROR_BEFORE_NOT_BELOW_AFTER = 'before must sort strictly below after';
const ORDER_ERROR_NO_ROOM = 'no key fits in that range';

type DigitShift = { digits: string[]; overflow: boolean };

function integerLengthOf(head: string): number {
  const code = head.charCodeAt(0);
  const isPositiveHead = head >= POSITIVE_HEAD_START && head <= POSITIVE_HEAD_END;
  const isNegativeHead = head >= NEGATIVE_HEAD_START && head <= NEGATIVE_HEAD_END;
  if (isPositiveHead) return code - POSITIVE_HEAD_START.charCodeAt(0) + HEAD_LENGTH_OFFSET;
  if (isNegativeHead) return NEGATIVE_HEAD_END.charCodeAt(0) - code + HEAD_LENGTH_OFFSET;
  throw new RangeError(ORDER_ERROR_NO_ROOM);
}

function integerPartOf(key: string): string {
  return key.slice(0, integerLengthOf(key.charAt(0)));
}

function shiftHead({ head, step }: { head: string; step: number }): string {
  return String.fromCharCode(head.charCodeAt(0) + step);
}

function shiftDigits({ digits, step }: { digits: string[]; step: number }): DigitShift {
  return digits.reduceRight<DigitShift>(
    (shifted, digit) => {
      if (!shifted.overflow) return { digits: [digit, ...shifted.digits], overflow: false };
      const shiftedIndex = DIGITS.indexOf(digit) + step;
      const overflowsAlphabet = shiftedIndex < 0 || shiftedIndex >= BASE;
      const wrappedIndex = (shiftedIndex + BASE) % BASE;
      return { digits: [DIGITS.charAt(wrappedIndex), ...shifted.digits], overflow: overflowsAlphabet };
    },
    { digits: [], overflow: true },
  );
}

function incrementInteger(integer: string): string | null {
  const head = integer.charAt(0);
  const { digits, overflow } = shiftDigits({ digits: [...integer.slice(1)], step: NEXT_DIGIT_STEP });
  if (!overflow) return `${head}${digits.join('')}`;
  if (head === NEGATIVE_HEAD_END) return INTEGER_ZERO;
  if (head === POSITIVE_HEAD_END) return null;
  const nextHead = shiftHead({ head, step: HEAD_STEP_UP });
  const resizedDigits = nextHead > POSITIVE_HEAD_START ? [...digits, ZERO_DIGIT] : digits.slice(0, -1);
  return `${nextHead}${resizedDigits.join('')}`;
}

function decrementInteger(integer: string): string | null {
  const head = integer.charAt(0);
  const { digits, overflow } = shiftDigits({ digits: [...integer.slice(1)], step: PREVIOUS_DIGIT_STEP });
  if (!overflow) return `${head}${digits.join('')}`;
  if (head === POSITIVE_HEAD_START) return `${NEGATIVE_HEAD_END}${LAST_DIGIT}`;
  if (head === NEGATIVE_HEAD_START) return null;
  const previousHead = shiftHead({ head, step: HEAD_STEP_DOWN });
  const resizedDigits = previousHead < NEGATIVE_HEAD_END ? [...digits, LAST_DIGIT] : digits.slice(0, -1);
  return `${previousHead}${resizedDigits.join('')}`;
}

function digitAt({ text, index }: { text: string; index: number }): string {
  if (index >= text.length) return ZERO_DIGIT;
  return text.charAt(index);
}

function sharedPrefixLength({ lower, upper }: { lower: string; upper: string }): number {
  const firstDifference = [...upper].findIndex((digit, index) => digitAt({ text: lower, index }) !== digit);
  return firstDifference === -1 ? upper.length : firstDifference;
}

function midpoint({ lower, upper }: { lower: string; upper: string | null }): string {
  const prefixLength = upper === null ? 0 : sharedPrefixLength({ lower, upper });
  const hasSharedPrefix = upper !== null && prefixLength > 0;
  if (hasSharedPrefix) {
    return upper.slice(0, prefixLength) + midpoint({ lower: lower.slice(prefixLength), upper: upper.slice(prefixLength) });
  }
  const lowerDigit = lower === '' ? 0 : DIGITS.indexOf(lower.charAt(0));
  const upperDigit = upper === null ? BASE : DIGITS.indexOf(upper.charAt(0));
  const hasRoomForDigit = upperDigit - lowerDigit > 1;
  if (hasRoomForDigit) return DIGITS.charAt(Math.round((lowerDigit + upperDigit) / HALF));
  const isUpperLongerThanOneDigit = upper !== null && upper.length > 1;
  if (isUpperLongerThanOneDigit) return upper.charAt(0);
  return DIGITS.charAt(lowerDigit) + midpoint({ lower: lower.slice(1), upper: null });
}

function keyAbove(before: string): string {
  const integer = integerPartOf(before);
  const fraction = before.slice(integer.length);
  const incremented = incrementInteger(integer);
  if (incremented === null) return integer + midpoint({ lower: fraction, upper: null });
  return incremented;
}

function keyBelow(after: string): string {
  const integer = integerPartOf(after);
  const fraction = after.slice(integer.length);
  if (integer === SMALLEST_INTEGER) return integer + midpoint({ lower: '', upper: fraction });
  if (integer < after) return integer;
  const decremented = decrementInteger(integer);
  if (decremented === null) throw new RangeError(ORDER_ERROR_NO_ROOM);
  return decremented;
}

function keyStrictlyBetween({ before, after }: { before: string; after: string }): string {
  const beforeInteger = integerPartOf(before);
  const beforeFraction = before.slice(beforeInteger.length);
  const afterInteger = integerPartOf(after);
  const afterFraction = after.slice(afterInteger.length);
  if (beforeInteger === afterInteger) {
    return beforeInteger + midpoint({ lower: beforeFraction, upper: afterFraction });
  }
  const incremented = incrementInteger(beforeInteger);
  if (incremented === null) throw new RangeError(ORDER_ERROR_NO_ROOM);
  if (incremented < after) return incremented;
  return beforeInteger + midpoint({ lower: beforeFraction, upper: null });
}

// NB ADR 0009: keys are fractional strings compared as plain strings, and a move writes one key.
export function orderKeyBetween({ before, after }: { before: string | null; after: string | null }): string {
  const isOutOfOrder = before !== null && after !== null && before >= after;
  if (isOutOfOrder) throw new RangeError(ORDER_ERROR_BEFORE_NOT_BELOW_AFTER);
  if (before === null) return after === null ? INTEGER_ZERO : keyBelow(after);
  if (after === null) return keyAbove(before);
  return keyStrictlyBetween({ before, after });
}
