import type { Metric } from './metric';

export type MetricWrite = { day: string; metric: Metric; dimension: string; amount: number };

export type MetricRow = { day: string; metric: string; dimension: string; count: number };

export async function incrementMetrics({ database, writes }: { database: D1Database; writes: MetricWrite[] }): Promise<void> {
  throw new Error('incrementMetrics is not implemented');
}

export async function replaceMetrics({ database, writes }: { database: D1Database; writes: MetricWrite[] }): Promise<void> {
  throw new Error('replaceMetrics is not implemented');
}

export async function incrementWithinCap({
  database,
  day,
  metric,
  capMax,
}: {
  database: D1Database;
  day: string;
  metric: Metric;
  capMax: number;
}): Promise<boolean> {
  throw new Error('incrementWithinCap is not implemented');
}

export async function metricRowsSince({ database, sinceDay }: { database: D1Database; sinceDay: string }): Promise<MetricRow[]> {
  throw new Error('metricRowsSince is not implemented');
}

export async function pruneMetrics({ database, now }: { database: D1Database; now: number }): Promise<void> {
  throw new Error('pruneMetrics is not implemented');
}
