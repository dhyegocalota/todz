import { LAST_INDEX, MILLISECONDS_PER_DAY } from '@todz/types';
import { escapedHtml } from '../escaped-html';
import { HttpHeader } from '../http-header';
import { HttpStatus } from '../http-status';
import { siteKeyOf } from '../turnstile-page';
import { Metric } from '../telemetry/metric';
import { EARLIEST_DAY, type MetricRow, metricRowsSince } from '../telemetry/metrics-store';
import { ADMIN_METRICS_DAYS, SPARKLINE_HEIGHT, SPARKLINE_WIDTH } from '../telemetry/telemetry-constants';
import { utcDayOf } from '../telemetry/telemetry-day';
import { adminCardAnswerOf, adminClosedAnswerOf, adminPageAnswerOf, adminRedirectAnswerOf } from './admin-answer';
import { ADMIN_COPY } from './admin-copy';
import { AdminNotice } from './admin-notice';
import { ADMIN_RESPONSE_HEADERS, AdminPath } from './admin-paths';
import { adminEmailOf, hasAdminSession } from './admin-session';
import { SiteGlyph, glyphHtml } from './site-glyphs';
import { adminPageResponse, siteContentSecurityPolicy } from './site-headers';
import { CONTENT_ID, SitePageKind, siteDocumentHtml } from './site-shell';
import { SITE_STYLE } from './site-style';
import type { SiteContext } from './site-endpoint';

const CSV_CONTENT_TYPE = 'text/csv; charset=utf-8';
const CSV_DISPOSITION = 'attachment; filename="todz-metrics.csv"';
const CSV_HEADER_FIELDS = ['day', 'metric', 'dimension', 'count'];
const CSV_FIELD_SEPARATOR = ',';
const CSV_LINE_BREAK = '\r\n';
const CSV_QUOTE = '"';
const FORMULA_START_PATTERN = /^[=+\-@\t\r]/;
const FORMULA_GUARD = "'";
const COUNT_FORMAT = new Intl.NumberFormat('en-US');
const SPARKLINE_STROKE_WIDTH = 2;
const SPARKLINE_PADDING = SPARKLINE_STROKE_WIDTH;
const GAUGE_METRICS: Metric[] = [Metric.OwnersTotal, Metric.WorkspacesTotal, Metric.ProjectsTotal];

const CONTENT_SECURITY_POLICY = await siteContentSecurityPolicy({
  style: SITE_STYLE,
  scripts: [],
  widgetOrigin: null,
  connectsToSelf: false,
  declaresManifest: false,
});

type MetricSeries = { metric: Metric; values: number[] };

function csvFieldOf(value: string): string {
  const isFormulaStart = FORMULA_START_PATTERN.test(value);
  const guarded = isFormulaStart ? `${FORMULA_GUARD}${value}` : value;
  return `${CSV_QUOTE}${guarded.replaceAll(CSV_QUOTE, `${CSV_QUOTE}${CSV_QUOTE}`)}${CSV_QUOTE}`;
}

function csvLineOf(fields: string[]): string {
  return `${fields.map(csvFieldOf).join(CSV_FIELD_SEPARATOR)}${CSV_LINE_BREAK}`;
}

export function metricsCsvOf(rows: MetricRow[]): string {
  const lines = rows.map(({ day, metric, dimension, count }) => [day, metric, dimension, String(count)]);
  return [CSV_HEADER_FIELDS, ...lines].map(csvLineOf).join('');
}

function windowDaysOf(now: number): string[] {
  return Array.from({ length: ADMIN_METRICS_DAYS }, (_, index) => utcDayOf(now - (ADMIN_METRICS_DAYS - 1 - index) * MILLISECONDS_PER_DAY));
}

function seriesOf({ rows, days }: { rows: MetricRow[]; days: string[] }): MetricSeries[] {
  return Object.values(Metric).flatMap((metric) => {
    const metricRows = rows.filter((row) => row.metric === metric);
    if (metricRows.length === 0) return [];
    const values = days.map((day) => metricRows.filter((row) => row.day === day).reduce((total, { count }) => total + count, 0));
    return [{ metric, values }];
  });
}

function totalOf({ metric, values }: MetricSeries): number {
  const sum = values.reduce((total, value) => total + value, 0);
  if (!GAUGE_METRICS.includes(metric)) return sum;
  const latest = values.filter((value) => value > 0).at(LAST_INDEX);
  if (latest === undefined) return sum;
  return latest;
}

function sparklinePointsOf(values: number[]): string {
  const peak = Math.max(...values, 1);
  const stepWidth = (SPARKLINE_WIDTH - 2 * SPARKLINE_PADDING) / (values.length - 1);
  const usableHeight = SPARKLINE_HEIGHT - 2 * SPARKLINE_PADDING;
  return values
    .map(
      (value, index) =>
        `${(SPARKLINE_PADDING + index * stepWidth).toFixed(1)},${(SPARKLINE_PADDING + usableHeight * (1 - value / peak)).toFixed(1)}`,
    )
    .join(' ');
}

function tileHtml(series: MetricSeries): string {
  const label = ADMIN_COPY.metrics.labelOf[series.metric];
  const chartLabel = ADMIN_COPY.metrics.chartLabel({ label, days: ADMIN_METRICS_DAYS });
  return `<div class="stat-tile glass"><dt>${escapedHtml(label)}</dt><dd>${COUNT_FORMAT.format(totalOf(series))}</dd><svg data-metric="${series.metric}" width="${SPARKLINE_WIDTH}" height="${SPARKLINE_HEIGHT}" viewBox="0 0 ${SPARKLINE_WIDTH} ${SPARKLINE_HEIGHT}" role="img" aria-label="${escapedHtml(chartLabel)}"><polyline points="${sparklinePointsOf(series.values)}" fill="none" stroke="currentColor" stroke-width="${SPARKLINE_STROKE_WIDTH}" stroke-linecap="round" stroke-linejoin="round"/></svg></div>`;
}

function emptyHtml(): string {
  const { metrics } = ADMIN_COPY;
  return `<div class="empty-card glass">
<h2 class="empty-title">${escapedHtml(metrics.emptyTitle)}</h2>
<p class="empty-body">${escapedHtml(metrics.emptyBody)}</p>
</div>`;
}

function metricsHtml(series: MetricSeries[]): string {
  const { metrics, panel } = ADMIN_COPY;
  const listing = series.length === 0 ? emptyHtml() : `<dl class="stat-list">\n${series.map(tileHtml).join('\n')}\n</dl>`;
  return siteDocumentHtml({
    kind: SitePageKind.Private,
    title: ADMIN_COPY.meta.metricsTitle,
    description: ADMIN_COPY.meta.description,
    main: `<main id="${CONTENT_ID}">
<div class="admin-panel rise">
<div class="panel-head">
<h1 class="panel-title">${escapedHtml(metrics.title)}</h1>
<nav class="panel-actions" aria-label="${escapedHtml(ADMIN_COPY.shell.navLabel)}">
<a class="admin-action" href="${AdminPath.Usage}">${escapedHtml(ADMIN_COPY.usage.link)}</a>
<a class="admin-action" href="${AdminPath.CloudQueue}">${escapedHtml(ADMIN_COPY.cloudQueue.link)}</a>
<a class="admin-action" href="${AdminPath.MetricsExport}" download>${escapedHtml(metrics.download)}</a>
<form method="post" action="${AdminPath.SignOut}"><button class="nav-link nav-button" type="submit">${escapedHtml(panel.signOut)}</button></form>
</nav>
</div>
<h2 class="visually-hidden">${escapedHtml(metrics.summaryHeading)}</h2>
${listing}
</div>
</main>`,
    scripts: [],
  });
}

export async function serveAdminMetrics({ request, env }: SiteContext): Promise<Response> {
  if (adminEmailOf(env) === null) return adminClosedAnswerOf({ env });
  const isSignedIn = await hasAdminSession({ request, env, now: Date.now() }).catch(() => null);
  if (isSignedIn === null) return adminClosedAnswerOf({ env });
  if (!isSignedIn) return adminCardAnswerOf({ notice: AdminNotice.None, siteKey: siteKeyOf(env) });
  const now = Date.now();
  const days = windowDaysOf(now);
  const rows = await metricRowsSince({ database: env.DIRECTORY, sinceDay: days[0]! }).catch(() => null);
  if (rows === null) return adminClosedAnswerOf({ env });
  const page = adminPageResponse({ html: metricsHtml(seriesOf({ rows, days })), contentSecurityPolicy: CONTENT_SECURITY_POLICY });
  return adminPageAnswerOf({ page, status: HttpStatus.Ok });
}

export async function serveAdminMetricsExport({ request, env }: SiteContext): Promise<Response> {
  const isSignedIn = await hasAdminSession({ request, env, now: Date.now() }).catch(() => null);
  if (isSignedIn === null) return adminClosedAnswerOf({ env });
  if (!isSignedIn) return adminRedirectAnswerOf();
  const rows = await metricRowsSince({ database: env.DIRECTORY, sinceDay: EARLIEST_DAY }).catch(() => null);
  if (rows === null) return adminClosedAnswerOf({ env });
  return new Response(metricsCsvOf(rows), {
    headers: { ...ADMIN_RESPONSE_HEADERS, [HttpHeader.ContentType]: CSV_CONTENT_TYPE, [HttpHeader.ContentDisposition]: CSV_DISPOSITION },
  });
}
