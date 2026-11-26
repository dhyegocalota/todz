import type { Env } from './env';

export enum BudgetSource {
  Analytics = 'analytics',
  Estimate = 'estimate',
}

export type BudgetSourceChoice = { source: BudgetSource.Analytics; token: string; accountTag: string } | { source: BudgetSource.Estimate };

export const ESTIMATE_ONLY_NOTICE = 'budget guard: estimate only';

export function budgetSourceOf(env: Env): BudgetSourceChoice {
  const { CLOUDFLARE_ANALYTICS_TOKEN: token, CLOUDFLARE_ACCOUNT_ID: accountTag } = env;
  if (!token || !accountTag) return { source: BudgetSource.Estimate };
  return { source: BudgetSource.Analytics, token, accountTag };
}

export function fallbackNoticeOf(reason: string): string {
  return `${ESTIMATE_ONLY_NOTICE} — analytics failed: ${reason}`;
}
