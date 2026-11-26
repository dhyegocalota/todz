import { type Metric, NO_DIMENSION, OTHER_DIMENSION, dimensionOf } from './metric';
import { METRICS_RETENTION_MS, METRIC_DIMENSIONS_PER_DAY_MAX } from './telemetry-constants';
import { utcDayOf } from './telemetry-day';

export type MetricWrite = { day: string; metric: Metric; dimension: string; amount: number };

export type MetricRow = { day: string; metric: string; dimension: string; count: number };

export const EARLIEST_DAY = '0000-00-00';

const INSERT_WITHIN_DAILY_CAP = `INSERT INTO metrics_daily (day, metric, dimension, count)
SELECT ?1, ?2, CASE
  WHEN ?3 = '${OTHER_DIMENSION}' THEN ?3
  WHEN EXISTS (SELECT 1 FROM metrics_daily WHERE day = ?1 AND metric = ?2 AND dimension = ?3) THEN ?3
  WHEN (SELECT count(*) FROM metrics_daily WHERE day = ?1 AND metric = ?2 AND dimension <> '${OTHER_DIMENSION}') < ?4 THEN ?3
  ELSE '${OTHER_DIMENSION}'
END, ?5 WHERE true`;
const ADD_ON_CONFLICT = 'ON CONFLICT (day, metric, dimension) DO UPDATE SET count = count + excluded.count';
const REPLACE_ON_CONFLICT = 'ON CONFLICT (day, metric, dimension) DO UPDATE SET count = excluded.count';
const INCREMENT_WITHIN_CAP = `INSERT INTO metrics_daily (day, metric, dimension, count) VALUES (?1, ?2, ?3, 1)
ON CONFLICT (day, metric, dimension) DO UPDATE SET count = count + 1 WHERE count < ?4`;
const ROWS_SINCE = 'SELECT day, metric, dimension, count FROM metrics_daily WHERE day >= ? ORDER BY day, metric, dimension';
const PRUNE = 'DELETE FROM metrics_daily WHERE day < ?';

async function writeMetrics({
  database,
  writes,
  conflict,
}: {
  database: D1Database;
  writes: MetricWrite[];
  conflict: string;
}): Promise<void> {
  if (writes.length === 0) return;
  await database.batch(
    writes.map(({ day, metric, dimension, amount }) =>
      database
        .prepare(`${INSERT_WITHIN_DAILY_CAP} ${conflict}`)
        .bind(day, metric, dimensionOf({ metric, candidate: dimension }), METRIC_DIMENSIONS_PER_DAY_MAX, amount),
    ),
  );
}

export function incrementMetrics({ database, writes }: { database: D1Database; writes: MetricWrite[] }): Promise<void> {
  return writeMetrics({ database, writes, conflict: ADD_ON_CONFLICT });
}

export function replaceMetrics({ database, writes }: { database: D1Database; writes: MetricWrite[] }): Promise<void> {
  return writeMetrics({ database, writes, conflict: REPLACE_ON_CONFLICT });
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
  const outcome = await database.prepare(INCREMENT_WITHIN_CAP).bind(day, metric, NO_DIMENSION, capMax).run();
  return outcome.meta.changes > 0;
}

export async function metricRowsSince({ database, sinceDay }: { database: D1Database; sinceDay: string }): Promise<MetricRow[]> {
  const { results } = await database.prepare(ROWS_SINCE).bind(sinceDay).all<MetricRow>();
  return results;
}

export async function pruneMetrics({ database, now }: { database: D1Database; now: number }): Promise<void> {
  await database
    .prepare(PRUNE)
    .bind(utcDayOf(now - METRICS_RETENTION_MS))
    .run();
}
