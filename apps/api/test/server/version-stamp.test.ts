import { describe, expect, test } from 'vitest';
import { versionStamp } from '../../scripts/server/version-stamp';

const MALFORMED_MESSAGE = 'Cannot stamp the server version';

describe('versionStamp', () => {
  test('is the commit date in dots, a plus and the first seven characters of the hash', () => {
    expect(versionStamp({ commitDate: '2026-11-25', commitHash: '3f9c2ab8d1e0' })).toBe('2026.11.25+3f9c2ab');
  });

  test('is the same for the same commit', () => {
    const commit = { commitDate: '2026-01-05', commitHash: '0123456789abcdef0123456789abcdef01234567' };
    expect(versionStamp(commit)).toBe(versionStamp(commit));
    expect(versionStamp(commit)).toBe('2026.01.05+0123456');
  });

  test.each([
    { name: 'a short hash', commitDate: '2026-11-25', commitHash: '3f9c2a' },
    { name: 'a hash that is not hexadecimal', commitDate: '2026-11-25', commitHash: 'zzzzzzzzzzzz' },
    { name: 'an empty hash', commitDate: '2026-11-25', commitHash: '' },
    { name: 'a date without zero padding', commitDate: '2026-1-5', commitHash: '3f9c2ab8d1e0' },
    { name: 'a date with a time', commitDate: '2026-11-25T10:00:00', commitHash: '3f9c2ab8d1e0' },
    { name: 'an empty date', commitDate: '', commitHash: '3f9c2ab8d1e0' },
  ])('refuses $name', ({ commitDate, commitHash }) => {
    expect(() => versionStamp({ commitDate, commitHash })).toThrow(MALFORMED_MESSAGE);
  });
});
