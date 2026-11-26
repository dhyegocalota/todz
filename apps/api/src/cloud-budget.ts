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

export type BudgetUsage = Record<BudgetDimension, number>;

export type EstimateInput = { monthWrites: number; readRequests: number; emails: number };

export type MeasuredTotals = { workerRequests: number; durableObjectRequests: number; directoryRowsWritten: number };

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

function estimatedUseOf({ dimension, estimate }: { dimension: BudgetDimension; estimate: EstimateInput }): number {
  const writes = estimate.monthWrites * COST_OF_WRITE[dimension];
  const reads = estimate.readRequests * COST_OF_READ[dimension];
  const emails = estimate.emails * COST_OF_EMAIL[dimension];
  return writes + reads + emails;
}

export function estimatedUsageOf(estimate: EstimateInput): BudgetUsage {
  return {
    [BudgetDimension.WorkerRequests]: estimatedUseOf({ dimension: BudgetDimension.WorkerRequests, estimate }),
    [BudgetDimension.DurableObjectRequests]: estimatedUseOf({ dimension: BudgetDimension.DurableObjectRequests, estimate }),
    [BudgetDimension.DurableObjectRows]: estimatedUseOf({ dimension: BudgetDimension.DurableObjectRows, estimate }),
    [BudgetDimension.DirectoryRows]: estimatedUseOf({ dimension: BudgetDimension.DirectoryRows, estimate }),
    [BudgetDimension.Emails]: estimatedUseOf({ dimension: BudgetDimension.Emails, estimate }),
  };
}

export function measuredUsageOf({
  measured,
  monthWrites,
  emails,
}: {
  measured: MeasuredTotals;
  monthWrites: number;
  emails: number;
}): BudgetUsage {
  return {
    [BudgetDimension.WorkerRequests]: measured.workerRequests,
    [BudgetDimension.DurableObjectRequests]: measured.durableObjectRequests,
    [BudgetDimension.DurableObjectRows]: monthWrites * COST_OF_WRITE[BudgetDimension.DurableObjectRows],
    [BudgetDimension.DirectoryRows]: measured.directoryRowsWritten,
    [BudgetDimension.Emails]: emails,
  };
}

function levelOf(ratio: number): BudgetLevel {
  if (ratio >= CLOUD_BUDGET_REFUSAL_RATIO) return BudgetLevel.Refusing;
  if (ratio >= CLOUD_BUDGET_WARNING_RATIO) return BudgetLevel.Warning;
  return BudgetLevel.Normal;
}

export function budgetStatusOf(usage: BudgetUsage): BudgetStatus {
  const ratios = Object.values(BudgetDimension).map((dimension) => ({
    dimension,
    ratio: usage[dimension] / ALLOWANCE_OF_DIMENSION[dimension],
  }));
  const [busiest] = [...ratios].sort((left, right) => right.ratio - left.ratio);
  if (busiest === undefined) throw new Error('a budget has dimensions');
  return { level: levelOf(busiest.ratio), dimension: busiest.dimension };
}
