import type { Env } from './env';
import { POSITIVE_WHOLE_NUMBER_PATTERN } from './fair-use-limits';

const VARIABLE = 'CLOUD_ACCOUNTS_MAX';

export function cloudAccountsMaxOf(env: Env): number | null {
  const configured = env.CLOUD_ACCOUNTS_MAX;
  const isOff = configured === undefined || configured === '';
  if (isOff) return null;
  if (!POSITIVE_WHOLE_NUMBER_PATTERN.test(configured)) throw new Error(`${VARIABLE} must be a positive whole number`);
  return Number(configured);
}
