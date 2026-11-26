import { BYTES_PER_KIBIBYTE, BYTES_PER_MEBIBYTE, FairUseLimit, OWNER_STORED_BYTES_MAX } from '@todz/types';
import { describe, expect, test } from 'vitest';
import { FAIR_USE_COPY } from '../src/fair-use-copy';

function storageMessageOf(max: number): string {
  return FAIR_USE_COPY.limitMessageOf({ limit: FairUseLimit.StoredBytes, max });
}

describe('the storage limit message', () => {
  test('names the default in whole megabytes', () => {
    expect(storageMessageOf(OWNER_STORED_BYTES_MAX)).toContain('limit of 50 MB of task text');
  });

  test('rounds a fractional megabyte count to one decimal', () => {
    expect(storageMessageOf(1.5 * BYTES_PER_MEBIBYTE)).toContain('limit of 1.5 MB of task text');
    expect(storageMessageOf(BYTES_PER_MEBIBYTE + 1)).toContain('limit of 1 MB of task text');
  });

  test('names a limit under a megabyte in kilobytes with one decimal', () => {
    expect(storageMessageOf(3_000)).toContain('limit of 2.9 KB of task text');
    expect(storageMessageOf(4 * BYTES_PER_KIBIBYTE)).toContain('limit of 4 KB of task text');
  });
});
