import { CLOUD_BUDGET_REFUSAL_RATIO, CLOUD_BUDGET_WARNING_RATIO } from '@todz/types';

export enum BudgetDimension {
  WorkerRequests = 'worker requests',
  DurableObjectRequests = 'Durable Object requests',
  DurableObjectRows = 'Durable Object rows written',
  DirectoryRows = 'D1 rows written',
  Emails = 'emails',
}

export enum BudgetLevel {
  Normal = 'normal',
  Warning = 'warning',
  Refusing = 'refusing',
}

export type BudgetUsage = { monthWrites: number; readRequests: number; emails: number };

export type BudgetStatus = { level: BudgetLevel; dimension: BudgetDimension };

// NB ADR 0099: the Workers Paid included allowances read from Cloudflare's pricing pages on 2026-11-26.
const ALLOWANCE_OF_DIMENSION: Record<BudgetDimension, number> = {
  [BudgetDimension.WorkerRequests]: 10_000_000,
  [BudgetDimension.DurableObjectRequests]: 1_000_000,
  [BudgetDimension.DurableObjectRows]: 50_000_000,
  [BudgetDimension.DirectoryRows]: 50_000_000,
  [BudgetDimension.Emails]: 3_000,
};

const COST_OF_WRITE: Record<BudgetDimension, number> = {
  [BudgetDimension.WorkerRequests]: 1,
  [BudgetDimension.DurableObjectRequests]: 1,
  [BudgetDimension.DurableObjectRows]: 13,
  [BudgetDimension.DirectoryRows]: 2,
  [BudgetDimension.Emails]: 0,
};

const COST_OF_READ: Record<BudgetDimension, number> = {
  [BudgetDimension.WorkerRequests]: 1,
  [BudgetDimension.DurableObjectRequests]: 1,
  [BudgetDimension.DurableObjectRows]: 0,
  [BudgetDimension.DirectoryRows]: 0,
  [BudgetDimension.Emails]: 0,
};

const COST_OF_EMAIL: Record<BudgetDimension, number> = {
  [BudgetDimension.WorkerRequests]: 0,
  [BudgetDimension.DurableObjectRequests]: 0,
  [BudgetDimension.DurableObjectRows]: 0,
  [BudgetDimension.DirectoryRows]: 0,
  [BudgetDimension.Emails]: 1,
};

function usedOf({ dimension, usage }: { dimension: BudgetDimension; usage: BudgetUsage }): number {
  const writes = usage.monthWrites * COST_OF_WRITE[dimension];
  const reads = usage.readRequests * COST_OF_READ[dimension];
  const emails = usage.emails * COST_OF_EMAIL[dimension];
  return writes + reads + emails;
}

function levelOf(ratio: number): BudgetLevel {
  if (ratio >= CLOUD_BUDGET_REFUSAL_RATIO) return BudgetLevel.Refusing;
  if (ratio >= CLOUD_BUDGET_WARNING_RATIO) return BudgetLevel.Warning;
  return BudgetLevel.Normal;
}

export function budgetStatusOf(usage: BudgetUsage): BudgetStatus {
  const ratios = Object.values(BudgetDimension).map((dimension) => ({
    dimension,
    ratio: usedOf({ dimension, usage }) / ALLOWANCE_OF_DIMENSION[dimension],
  }));
  const [busiest] = [...ratios].sort((left, right) => right.ratio - left.ratio);
  if (busiest === undefined) throw new Error('a budget has dimensions');
  return { level: levelOf(busiest.ratio), dimension: busiest.dimension };
}
