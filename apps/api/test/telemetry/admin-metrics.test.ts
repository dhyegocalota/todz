import { MILLISECONDS_PER_DAY, MILLISECONDS_PER_MINUTE } from '@todz/types';
import { createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, test } from 'vitest';
import { digestCredential } from '../../src/credential-digest';
import type { Env } from '../../src/env';
import { serveAdminMetrics, serveAdminMetricsExport, metricsCsvOf } from '../../src/site/admin-metrics';
import { AdminPath } from '../../src/site/admin-paths';
import { ADMIN_SESSION_LIFETIME_MS, AdminCookie } from '../../src/site/admin-session';
import { openAdminSession } from '../../src/site/admin-store';
import { Metric, NO_DIMENSION } from '../../src/telemetry/metric';
import { replaceMetrics } from '../../src/telemetry/metrics-store';
import { utcDayOf } from '../../src/telemetry/telemetry-day';
import { recordingEnv, workerEnvWith } from '../owner-client';

const SITE_ORIGIN = 'https://todz.app';
const ADMIN_ADDRESS = 'hello@todz.app';
const SESSION_SECRET = 'an-admin-session-secret';
const OK_STATUS = 200;
const SEE_OTHER_STATUS = 303;
const UNAVAILABLE_STATUS = 503;
const CSV_HEADER = '"day","metric","dimension","count"\r\n';
const SIGNED_IN_COOKIE = `${AdminCookie.Session}=${SESSION_SECRET}`;
const ALLOWED_TABLES = /metrics_daily|admin_sessions/;

function dayAgo(days: number): string {
  return utcDayOf(Date.now() - days * MILLISECONDS_PER_DAY);
}

function requestOf({ path, cookie }: { path: AdminPath; cookie: string | null }): Request {
  const headers = cookie === null ? undefined : { Cookie: cookie };
  return new Request(`${SITE_ORIGIN}${path}`, { headers });
}

async function served({
  route,
  path,
  cookie = SIGNED_IN_COOKIE,
  settings = {},
}: {
  route: typeof serveAdminMetrics;
  path: AdminPath;
  cookie?: string | null;
  settings?: Partial<Env>;
}): Promise<Response> {
  const executionContext = createExecutionContext();
  const response = await route({
    request: requestOf({ path, cookie }),
    env: workerEnvWith({ SITE_ORIGIN, ADMIN_EMAIL: ADMIN_ADDRESS, ...settings }),
    executionContext,
  });
  await waitOnExecutionContext(executionContext);
  return response;
}

async function openSession(): Promise<void> {
  await openAdminSession({
    database: env.DIRECTORY,
    digest: await digestCredential(SESSION_SECRET),
    email: ADMIN_ADDRESS,
    now: Date.now() - MILLISECONDS_PER_MINUTE,
    expiresAt: Date.now() + ADMIN_SESSION_LIFETIME_MS,
  });
}

async function seedTaskDays(): Promise<void> {
  await replaceMetrics({
    database: env.DIRECTORY,
    writes: [
      { day: dayAgo(2), metric: Metric.TasksAdded, dimension: NO_DIMENSION, amount: 2 },
      { day: dayAgo(1), metric: Metric.TasksAdded, dimension: NO_DIMENSION, amount: 3 },
    ],
  });
}

beforeEach(async () => {
  await env.DIRECTORY.batch([env.DIRECTORY.prepare('DELETE FROM metrics_daily'), env.DIRECTORY.prepare('DELETE FROM admin_sessions')]);
});

describe('the metrics page', () => {
  test('a signed-in admin sees one inline sparkline per metric with data and its 30-day total', async () => {
    await openSession();
    await seedTaskDays();
    const response = await served({ route: serveAdminMetrics, path: AdminPath.Metrics });
    const html = await response.text();
    expect(response.status).toBe(OK_STATUS);
    expect(html).toContain(`data-metric="${Metric.TasksAdded}"`);
    expect(html).toContain('<polyline');
    expect(html).toContain('<dd>5</dd>');
    expect(html).toContain(AdminPath.MetricsExport);
  });

  test('the page carries no script and its policy allows none', async () => {
    await openSession();
    await seedTaskDays();
    const response = await served({ route: serveAdminMetrics, path: AdminPath.Metrics });
    const html = await response.text();
    expect(html.match(/<script/g)).toHaveLength(1);
    expect(response.headers.get('Content-Security-Policy')?.match(/'sha256-/g)).toHaveLength(2);
    expect(response.headers.get('Content-Security-Policy')).toContain("default-src 'none'");
    expect(response.headers.get('Cache-Control')).toBe('no-store');
  });

  test('a visitor with no session sees the sign-in card and none of the numbers', async () => {
    await seedTaskDays();
    const html = await (await served({ route: serveAdminMetrics, path: AdminPath.Metrics, cookie: null })).text();
    expect(html).not.toContain('data-metric');
    expect(html).not.toContain('<polyline');
  });

  test('a session for another address is not an admin', async () => {
    await seedTaskDays();
    const html = await (
      await served({ route: serveAdminMetrics, path: AdminPath.Metrics, cookie: `${AdminCookie.Session}=another-secret` })
    ).text();
    expect(html).not.toContain('data-metric');
  });

  test('without an admin address the page is closed', async () => {
    await openSession();
    const response = await served({ route: serveAdminMetrics, path: AdminPath.Metrics, settings: { ADMIN_EMAIL: undefined } });
    expect(response.status).toBe(UNAVAILABLE_STATUS);
  });

  test('the page reads only the rollups, never the directory tables', async () => {
    await openSession();
    await seedTaskDays();
    const { workerEnv, statements } = recordingEnv({ SITE_ORIGIN, ADMIN_EMAIL: ADMIN_ADDRESS });
    const executionContext = createExecutionContext();
    await serveAdminMetrics({
      request: requestOf({ path: AdminPath.Metrics, cookie: SIGNED_IN_COOKIE }),
      env: workerEnv,
      executionContext,
    });
    await waitOnExecutionContext(executionContext);
    expect(statements.length).toBeGreaterThan(0);
    statements.forEach((statement) => expect(statement).toMatch(ALLOWED_TABLES));
  });

  test('a day older than thirty days is not drawn', async () => {
    await openSession();
    await replaceMetrics({
      database: env.DIRECTORY,
      writes: [{ day: dayAgo(40), metric: Metric.TasksAdded, dimension: NO_DIMENSION, amount: 9 }],
    });
    const html = await (await served({ route: serveAdminMetrics, path: AdminPath.Metrics })).text();
    expect(html).not.toContain(`data-metric="${Metric.TasksAdded}"`);
  });
});

describe('the metrics CSV', () => {
  test('an empty store is the header line alone', () => {
    expect(metricsCsvOf([])).toBe(CSV_HEADER);
  });

  test('every field is quoted and every line ends with CRLF', () => {
    expect(metricsCsvOf([{ day: '2026-11-25', metric: 'appcast_requests', dimension: '0.2.1|15', count: 4 }])).toBe(
      `${CSV_HEADER}"2026-11-25","appcast_requests","0.2.1|15","4"\r\n`,
    );
  });

  test('a signed-in admin downloads every retained row as a CSV attachment', async () => {
    await openSession();
    await seedTaskDays();
    await replaceMetrics({
      database: env.DIRECTORY,
      writes: [{ day: dayAgo(40), metric: Metric.OwnersTotal, dimension: NO_DIMENSION, amount: 1 }],
    });
    const response = await served({ route: serveAdminMetricsExport, path: AdminPath.MetricsExport });
    const lines = (await response.text()).split('\r\n').filter((line) => line !== '');
    expect(response.status).toBe(OK_STATUS);
    expect(response.headers.get('Content-Type')).toBe('text/csv; charset=utf-8');
    expect(response.headers.get('Content-Disposition')).toBe('attachment; filename="todz-metrics.csv"');
    expect(lines).toHaveLength(4);
  });

  test('a visitor with no session is sent to the panel and gets no rows', async () => {
    await seedTaskDays();
    const response = await served({ route: serveAdminMetricsExport, path: AdminPath.MetricsExport, cookie: null });
    expect(response.status).toBe(SEE_OTHER_STATUS);
    expect(response.headers.get('Location')).toBe(AdminPath.Panel);
    expect(await response.text()).toBe('');
  });
});
