import { EMAIL_CODE_LENGTH } from '@todz/types';

export const EMAIL_CODE_PATTERN = new RegExp(`^[0-9]{${EMAIL_CODE_LENGTH}}$`);

export enum CodeTable {
  SignInLinks = 'sign_in_links',
  AdminSignInLinks = 'admin_sign_in_links',
}

export enum CodeVerdict {
  Spent = 'spent',
  Wrong = 'wrong',
  Locked = 'locked',
}

export type CodeOutcome =
  { verdict: CodeVerdict.Spent; email: string } | { verdict: CodeVerdict.Wrong } | { verdict: CodeVerdict.Locked; retryAfterMs: number };

export type CodeSpending = {
  directory: D1Database;
  table: CodeTable;
  email: string;
  challenge: string;
  code: string;
  now: number;
};

export async function spendEmailCode(spending: CodeSpending): Promise<CodeOutcome> {
  throw new Error(`spendEmailCode is not implemented for ${spending.table}`);
}
