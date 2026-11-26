import { MILLISECONDS_PER_DAY } from '@todz/types';
import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, test } from 'vitest';
import { Metric, NO_DIMENSION, OTHER_DIMENSION } from '../../src/telemetry/metric';
import { incrementMetrics, incrementWithinCap, metricRowsSince, pruneMetrics, replaceMetrics } from '../../src/telemetry/metrics-store';
import { METRICS_RETENTION_DAYS, METRIC_DIMENSIONS_PER_DAY_MAX } from '../../src/telemetry/telemetry-constants';
import { utcDayOf } from '../../src/telemetry/telemetry-day';

const DAY = '2026-11-25';
const NOW = Date.UTC(2026, 10, 26, 3);
const CAP = 3;

type StoredRow = { day: string; metric: string; dimension: string; count: number };

async function storedRows(): Promise<StoredRow[]> {
  const { results } = await env.DIRECTORY.prepare(
    'SELECT day, metric, dimension, count FROM metrics_daily ORDER BY day, metric, dimension',
  ).all<StoredRow>();
  return results;
}

function versionDimension(index: number): string {
  return `1.0.${index}|15`;
}

beforeEach(async () => {
  await env.DIRECTORY.prepare('DELETE FROM metrics_daily').run();
});

describe('the metrics table', () => {
  test('it has the four rollup columns and nothing else', async () => {
    const { results } = await env.DIRECTORY.prepare("SELECT name FROM pragma_table_info('metrics_daily') ORDER BY cid").all<{
      name: string;
    }>();
    expect(results.map(({ name }) => name)).toEqual(['day', 'metric', 'dimension', 'count']);
  });
});

describe('incrementing', () => {
  test('two writes to the same day, metric and dimension are one row', async () => {
    const write = { day: DAY, metric: Metric.TasksAdded, dimension: NO_DIMENSION, amount: 2 };
    await incrementMetrics({ database: env.DIRECTORY, writes: [write] });
    await incrementMetrics({ database: env.DIRECTORY, writes: [write, { ...write, amount: 5 }] });
    expect(await storedRows()).toEqual([{ day: DAY, metric: Metric.TasksAdded, dimension: NO_DIMENSION, count: 9 }]);
  });

  test('a dimension outside the allow-list is stored as other, never as given', async () => {
    const stranger = 'maria@example.com';
    await incrementMetrics({ database: env.DIRECTORY, writes: [{ day: DAY, metric: Metric.AgentWrites, dimension: stranger, amount: 1 }] });
    const rows = await storedRows();
    expect(rows).toEqual([{ day: DAY, metric: Metric.AgentWrites, dimension: OTHER_DIMENSION, count: 1 }]);
    expect(JSON.stringify(rows)).not.toContain(stranger);
  });

  test('a metric without a dimension drops any dimension it is given', async () => {
    await incrementMetrics({ database: env.DIRECTORY, writes: [{ day: DAY, metric: Metric.OwnersNew, dimension: 'x', amount: 1 }] });
    expect((await storedRows())[0]?.dimension).toBe(NO_DIMENSION);
  });

  test('once a metric has the daily cap of dimension values a new one counts into other', async () => {
    const values = Array.from({ length: METRIC_DIMENSIONS_PER_DAY_MAX }, (_, index) => versionDimension(index));
    await incrementMetrics({
      database: env.DIRECTORY,
      writes: values.map((dimension) => ({ day: DAY, metric: Metric.AppcastRequests, dimension, amount: 1 })),
    });
    await incrementMetrics({
      database: env.DIRECTORY,
      writes: [
        { day: DAY, metric: Metric.AppcastRequests, dimension: '9.9.9|15', amount: 4 },
        { day: DAY, metric: Metric.AppcastRequests, dimension: versionDimension(0), amount: 1 },
      ],
    });
    const rows = await storedRows();
    expect(rows).toHaveLength(METRIC_DIMENSIONS_PER_DAY_MAX + 1);
    expect(rows.find(({ dimension }) => dimension === OTHER_DIMENSION)?.count).toBe(4);
    expect(rows.find(({ dimension }) => dimension === versionDimension(0))?.count).toBe(2);
    expect(rows.some(({ dimension }) => dimension === '9.9.9|15')).toBe(false);
  });

  test('the cap is per metric and per day', async () => {
    const values = Array.from({ length: METRIC_DIMENSIONS_PER_DAY_MAX }, (_, index) => versionDimension(index));
    await incrementMetrics({
      database: env.DIRECTORY,
      writes: values.map((dimension) => ({ day: DAY, metric: Metric.AppcastRequests, dimension, amount: 1 })),
    });
    await incrementMetrics({
      database: env.DIRECTORY,
      writes: [
        { day: DAY, metric: Metric.UsageVersions, dimension: '9.9.9|15', amount: 1 },
        { day: '2026-11-26', metric: Metric.AppcastRequests, dimension: '9.9.9|15', amount: 1 },
      ],
    });
    const rows = await storedRows();
    expect(rows.filter(({ dimension }) => dimension === '9.9.9|15')).toHaveLength(2);
  });
});

describe('replacing', () => {
  test('a second run of the same day overwrites the count instead of adding to it', async () => {
    const write = { day: DAY, metric: Metric.OwnersTotal, dimension: NO_DIMENSION, amount: 7 };
    await replaceMetrics({ database: env.DIRECTORY, writes: [write] });
    await replaceMetrics({ database: env.DIRECTORY, writes: [{ ...write, amount: 8 }] });
    expect(await storedRows()).toEqual([{ day: DAY, metric: Metric.OwnersTotal, dimension: NO_DIMENSION, count: 8 }]);
  });
});

describe('the capped counter', () => {
  test('it counts up to the cap and refuses after it', async () => {
    const attempts = await Promise.all(
      Array.from({ length: CAP + 2 }, () =>
        incrementWithinCap({ database: env.DIRECTORY, day: DAY, metric: Metric.UsageRollups, capMax: CAP }),
      ),
    );
    expect(attempts.filter(Boolean)).toHaveLength(CAP);
    expect(await storedRows()).toEqual([{ day: DAY, metric: Metric.UsageRollups, dimension: NO_DIMENSION, count: CAP }]);
  });
});

describe('reading', () => {
  test('only the days since the given day are returned, oldest first', async () => {
    await replaceMetrics({
      database: env.DIRECTORY,
      writes: ['2026-11-01', '2026-11-20', DAY].map((day) => ({ day, metric: Metric.OwnersTotal, dimension: NO_DIMENSION, amount: 1 })),
    });
    const rows = await metricRowsSince({ database: env.DIRECTORY, sinceDay: '2026-11-20' });
    expect(rows.map(({ day }) => day)).toEqual(['2026-11-20', DAY]);
  });
});

describe('retention', () => {
  test('rows older than thirteen months are deleted and newer ones stay', async () => {
    const expiredDay = utcDayOf(NOW - (METRICS_RETENTION_DAYS + 1) * MILLISECONDS_PER_DAY);
    const keptDay = utcDayOf(NOW - (METRICS_RETENTION_DAYS - 1) * MILLISECONDS_PER_DAY);
    await replaceMetrics({
      database: env.DIRECTORY,
      writes: [expiredDay, keptDay].map((day) => ({ day, metric: Metric.OwnersTotal, dimension: NO_DIMENSION, amount: 1 })),
    });
    await pruneMetrics({ database: env.DIRECTORY, now: NOW });
    expect((await storedRows()).map(({ day }) => day)).toEqual([keptDay]);
  });
});
