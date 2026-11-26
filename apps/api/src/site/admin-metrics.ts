import type { MetricRow } from '../telemetry/metrics-store';
import type { SiteContext } from './site-endpoint';

export function metricsCsvOf(rows: MetricRow[]): string {
  throw new Error('metricsCsvOf is not implemented');
}

export async function serveAdminMetrics(context: SiteContext): Promise<Response> {
  throw new Error('serveAdminMetrics is not implemented');
}

export async function serveAdminMetricsExport(context: SiteContext): Promise<Response> {
  throw new Error('serveAdminMetricsExport is not implemented');
}
