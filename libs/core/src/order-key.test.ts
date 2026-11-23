import { describe, expect, test } from 'vitest';
import { orderKeyBetween } from './order-key';

const PROPERTY_MOVE_COUNT = 1_000;
const PROPERTY_SEED = 20_261_123;
const APPEND_COUNT = 1_000;
const SPLIT_COUNT = 1_000;
const MAX_APPENDED_KEY_LENGTH = 6;
const MAX_SPLIT_KEY_LENGTH = 200;
const SMALLEST_INTEGER_DIGIT_COUNT = 26;
const LARGEST_INTEGER_DIGIT_COUNT = 26;
const LONG_RUN_COUNT = 5_000;
const LONG_RUN_MAX_KEY_LENGTH = 4;
const KEY_PATTERN = /^[a-zA-Z][0-9A-Za-z]*$/;
const TRAILING_ZERO_PATTERN = /0$/;
const POSITIVE_HEAD_START = 'a'.charCodeAt(0);
const NEGATIVE_HEAD_END = 'Z'.charCodeAt(0);
const HEAD_LENGTH_OFFSET = 2;
const MULBERRY_INCREMENT = 0x6d2b79f5;
const MULBERRY_FIRST_SHIFT = 15;
const MULBERRY_SECOND_SHIFT = 7;
const MULBERRY_THIRD_SHIFT = 14;
const MULBERRY_FIRST_MIX = 1;
const MULBERRY_SECOND_MIX = 61;
const UINT32_RANGE = 4_294_967_296;
const MOVE_KINDS = 3;

enum MoveKind {
  First,
  Last,
  Between,
}

type PositionContext = { length: number; nextRandom: () => number };

const POSITION_OF_MOVE: Record<MoveKind, (context: PositionContext) => number> = {
  [MoveKind.First]: () => 0,
  [MoveKind.Last]: ({ length }) => length,
  [MoveKind.Between]: ({ length, nextRandom }) => Math.floor(nextRandom() * (length + 1)),
};

function mulberry32(seed: number): () => number {
  let state = seed;
  return function nextRandom(): number {
    state = (state + MULBERRY_INCREMENT) | 0;
    let mixed = Math.imul(state ^ (state >>> MULBERRY_FIRST_SHIFT), MULBERRY_FIRST_MIX | state);
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> MULBERRY_SECOND_SHIFT), MULBERRY_SECOND_MIX | mixed)) ^ mixed;
    return ((mixed ^ (mixed >>> MULBERRY_THIRD_SHIFT)) >>> 0) / UINT32_RANGE;
  };
}

function integerLengthOf(key: string): number {
  const head = key.charCodeAt(0);
  const isPositiveHead = head >= POSITIVE_HEAD_START;
  if (isPositiveHead) return head - POSITIVE_HEAD_START + HEAD_LENGTH_OFFSET;
  return NEGATIVE_HEAD_END - head + HEAD_LENGTH_OFFSET;
}

function fractionOf(key: string): string {
  return key.slice(integerLengthOf(key));
}

function keyAt({ keys, index }: { keys: string[]; index: number }): string | null {
  const key = keys[index];
  if (key === undefined) return null;
  return key;
}

function isStrictlyIncreasing(keys: string[]): boolean {
  const sortedKeys = [...keys].sort();
  const hasNoDuplicate = new Set(keys).size === keys.length;
  return hasNoDuplicate && sortedKeys.every((key, index) => key === keys[index]);
}

function appendKeys(count: number): string[] {
  return Array.from({ length: count }).reduce<string[]>(
    (keys) => [...keys, orderKeyBetween({ before: keyAt({ keys, index: keys.length - 1 }), after: null })],
    [],
  );
}

function prependKeys(count: number): string[] {
  return Array.from({ length: count }).reduce<string[]>(
    (keys) => [orderKeyBetween({ before: null, after: keyAt({ keys, index: 0 }) }), ...keys],
    [],
  );
}

function longestKeyLength(keys: string[]): number {
  return Math.max(...keys.map((key) => key.length));
}

describe('orderKeyBetween', () => {
  test('an empty list gets a non-empty key', () => {
    expect(orderKeyBetween({ before: null, after: null }).length).toBeGreaterThan(0);
  });

  test('a key before the first sorts below it', () => {
    const first = orderKeyBetween({ before: null, after: null });
    expect(orderKeyBetween({ before: null, after: first })).toSatisfy((key: string) => key < first);
  });

  test('a key after the last sorts above it', () => {
    const last = orderKeyBetween({ before: null, after: null });
    expect(orderKeyBetween({ before: last, after: null })).toSatisfy((key: string) => key > last);
  });

  test('a key between two neighbours sorts strictly between them', () => {
    const lower = orderKeyBetween({ before: null, after: null });
    const upper = orderKeyBetween({ before: lower, after: null });
    const middle = orderKeyBetween({ before: lower, after: upper });
    expect(isStrictlyIncreasing([lower, middle, upper])).toBe(true);
  });

  test('a key between two keys that share an integer sorts strictly between them', () => {
    const middle = orderKeyBetween({ before: 'a0', after: 'a0V' });
    expect(isStrictlyIncreasing(['a0', middle, 'a0V'])).toBe(true);
  });

  test.each([
    { before: 'a1', after: 'a1' },
    { before: 'a2', after: 'a1' },
  ])('throws a RangeError when before is $before and after is $after', ({ before, after }) => {
    expect(() => orderKeyBetween({ before, after })).toThrow(RangeError);
  });

  test('a thousand seeded random insertions keep the list strictly increasing in the scheme alphabet', () => {
    const nextRandom = mulberry32(PROPERTY_SEED);
    const keys = Array.from({ length: PROPERTY_MOVE_COUNT }).reduce<string[]>((current) => {
      const moveKind: MoveKind = Math.floor(nextRandom() * MOVE_KINDS);
      const position = POSITION_OF_MOVE[moveKind]({ length: current.length, nextRandom });
      const key = orderKeyBetween({
        before: keyAt({ keys: current, index: position - 1 }),
        after: keyAt({ keys: current, index: position }),
      });
      return [...current.slice(0, position), key, ...current.slice(position)];
    }, []);
    expect(keys).toHaveLength(PROPERTY_MOVE_COUNT);
    expect(isStrictlyIncreasing(keys)).toBe(true);
    expect(keys.every((key) => KEY_PATTERN.test(key))).toBe(true);
    expect(keys.some((key) => TRAILING_ZERO_PATTERN.test(fractionOf(key)))).toBe(false);
  });

  test('nothing sorts below the smallest integer key', () => {
    const smallestInteger = `A${'0'.repeat(SMALLEST_INTEGER_DIGIT_COUNT)}`;
    expect(() => orderKeyBetween({ before: null, after: smallestInteger })).toThrow(RangeError);
  });

  test('a key above the largest integer key sorts above it', () => {
    const largestInteger = `z${'z'.repeat(LARGEST_INTEGER_DIGIT_COUNT)}`;
    const above = orderKeyBetween({ before: largestInteger, after: null });
    expect(isStrictlyIncreasing([largestInteger, above])).toBe(true);
  });

  test.each([
    { before: 'az', after: 'b00' },
    { before: 'Zz', after: 'a0' },
    { before: 'a0V', after: 'a1' },
    { before: 'a0', after: 'a0V' },
    { before: 'a0V', after: 'a0V1' },
  ])('a key between $before and $after sorts strictly between them', ({ before, after }) => {
    expect(isStrictlyIncreasing([before, orderKeyBetween({ before, after }), after])).toBe(true);
  });

  test('five thousand appends and prepends stay at most four characters', () => {
    expect(longestKeyLength(appendKeys(LONG_RUN_COUNT))).toBeLessThanOrEqual(LONG_RUN_MAX_KEY_LENGTH);
    expect(longestKeyLength(prependKeys(LONG_RUN_COUNT))).toBeLessThanOrEqual(LONG_RUN_MAX_KEY_LENGTH);
  });

  test('a thousand appends keep every key at most six characters and increasing', () => {
    const keys = appendKeys(APPEND_COUNT);
    expect(isStrictlyIncreasing(keys)).toBe(true);
    expect(longestKeyLength(keys)).toBeLessThanOrEqual(MAX_APPENDED_KEY_LENGTH);
  });

  test('a thousand prepends keep every key at most six characters and increasing', () => {
    const keys = prependKeys(APPEND_COUNT);
    expect(isStrictlyIncreasing(keys)).toBe(true);
    expect(longestKeyLength(keys)).toBeLessThanOrEqual(MAX_APPENDED_KEY_LENGTH);
  });

  test('a thousand splits of the same gap keep every key under two hundred characters', () => {
    const lower = orderKeyBetween({ before: null, after: null });
    const upper = orderKeyBetween({ before: lower, after: null });
    const narrowingGap = Array.from({ length: SPLIT_COUNT }).reduce<string[]>(
      (keys) => [...keys, orderKeyBetween({ before: lower, after: keyAt({ keys, index: keys.length - 1 }) })],
      [upper],
    );
    expect(isStrictlyIncreasing([lower, ...[...narrowingGap].reverse()])).toBe(true);
    expect(longestKeyLength(narrowingGap)).toBeLessThan(MAX_SPLIT_KEY_LENGTH);
  });
});
