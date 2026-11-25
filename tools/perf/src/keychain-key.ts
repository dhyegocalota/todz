import { KEYCHAIN_TIMEOUT_MS } from './budgets';

export type ExecFile = (file: string, args: string[], options: { timeout: number }) => Promise<{ stdout: string }>;

const KEYCHAIN_SERVICE = 'todz-perf-key';
const MISSING_MESSAGE = `the ${KEYCHAIN_SERVICE} Keychain item is missing`;

export async function readKeychainKey({ execFile }: { execFile: ExecFile }): Promise<string> {
  const answer = await execFile('security', ['find-generic-password', '-s', KEYCHAIN_SERVICE, '-w'], {
    timeout: KEYCHAIN_TIMEOUT_MS,
  }).catch(() => null);
  if (answer === null) throw new Error(MISSING_MESSAGE);
  const key = answer.stdout.trim();
  if (key === '') throw new Error(MISSING_MESSAGE);
  return key;
}
