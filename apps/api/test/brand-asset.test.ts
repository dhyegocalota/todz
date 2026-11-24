import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

const LOCKUP_PATH = ['brand', 'todz-lockup.png'];
const SERVED_LOCKUP = join(import.meta.dirname, '..', 'public', ...LOCKUP_PATH);
const BRAND_LOCKUP = join(import.meta.dirname, '..', '..', '..', 'docs', ...LOCKUP_PATH);

describe('the lockup the mail header shows', () => {
  test('the Worker serves a byte copy of the lockup in docs/brand', () => {
    expect(readFileSync(SERVED_LOCKUP).equals(readFileSync(BRAND_LOCKUP))).toBe(true);
  });
});
