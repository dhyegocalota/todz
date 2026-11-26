import type { Env } from './env';

export enum BudgetSource {
  Analytics = 'analytics',
  Estimate = 'estimate',
}

export type BudgetSourceChoice = { source: BudgetSource.Analytics; token: string } | { source: BudgetSource.Estimate };

export const ESTIMATE_ONLY_NOTICE = 'budget guard: estimate only';

export function budgetSourceOf(env: Env): BudgetSourceChoice {
  const token = env.CLOUDFLARE_ANALYTICS_TOKEN;
  if (!token) return { source: BudgetSource.Estimate };
  return { source: BudgetSource.Analytics, token };
}
