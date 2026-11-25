import { describe, expect, test } from 'vitest';
import { type ExecFile, readKeychainKey } from './keychain-key';

const MISSING_MESSAGE = 'the todz-perf-key Keychain item is missing';
const KEY = 'todz_perf_secret_value';

describe('readKeychainKey', () => {
  test('the key is read by exactly the security command, under a 5 second timeout', async () => {
    const calls: { file: string; args: string[]; timeout: number }[] = [];
    const execFile: ExecFile = async (file, args, { timeout }) => {
      calls.push({ file, args, timeout });
      return { stdout: `${KEY}\n` };
    };
    expect(await readKeychainKey({ execFile })).toBe(KEY);
    expect(calls).toEqual([{ file: 'security', args: ['find-generic-password', '-s', 'todz-perf-key', '-w'], timeout: 5_000 }]);
  });

  test('a non-zero exit is the missing item', async () => {
    const execFile: ExecFile = async () => {
      throw Object.assign(new Error('The specified item could not be found'), { code: 44 });
    };
    await expect(readKeychainKey({ execFile })).rejects.toThrow(MISSING_MESSAGE);
  });

  test('a timeout, an approval dialog still waiting, is the missing item', async () => {
    const execFile: ExecFile = async () => {
      throw Object.assign(new Error('Command failed: security'), { killed: true, signal: 'SIGTERM' });
    };
    await expect(readKeychainKey({ execFile })).rejects.toThrow(MISSING_MESSAGE);
  });

  test('an empty answer is the missing item', async () => {
    await expect(readKeychainKey({ execFile: async () => ({ stdout: '\n' }) })).rejects.toThrow(MISSING_MESSAGE);
  });

  test('the failure message never carries what the command printed', async () => {
    const execFile: ExecFile = async () => {
      throw new Error(`security printed ${KEY}`);
    };
    const failure = await readKeychainKey({ execFile }).catch((error: Error) => error);
    expect(failure).toEqual(new Error(MISSING_MESSAGE));
    expect(String(failure)).not.toContain(KEY);
  });
});
