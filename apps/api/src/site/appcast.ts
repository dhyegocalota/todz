import type { Env } from '../env';
import { HttpHeader } from '../http-header';
import { HttpMethod } from '../http-method';
import { limitRefusal } from '../limit-refusal';
import { DIMENSION_SEPARATOR, Metric } from '../telemetry/metric';
import { incrementMetrics } from '../telemetry/metrics-store';
import { sparkleClientOf } from '../telemetry/sparkle-user-agent';
import { utcDayOf } from '../telemetry/telemetry-day';
import { isTelemetryOn } from '../telemetry/telemetry-mode';
import type { SiteContext } from './site-endpoint';

export const APPCAST_PATH = '/download/appcast.xml';

const APPCAST_LIMITER_KEY = 'appcast';

async function countAppcastRequest({ request, env }: { request: Request; env: Env }): Promise<void> {
  const client = sparkleClientOf(request.headers.get(HttpHeader.UserAgent));
  if (client === null) return;
  const refusal = await limitRefusal({ limiter: env.APPCAST_LIMITER, key: APPCAST_LIMITER_KEY });
  if (refusal !== null) return;
  const dimension = `${client.appVersion}${DIMENSION_SEPARATOR}${client.macosMajor}`;
  await incrementMetrics({
    database: env.DIRECTORY,
    writes: [{ day: utcDayOf(Date.now()), metric: Metric.AppcastRequests, dimension, amount: 1 }],
  });
}

// NB ADR 0082: the appcast is the one asset the Worker runs first for, to count a Sparkle check per version without storing the user agent.
export async function serveAppcast({ request, env, executionContext }: SiteContext): Promise<Response> {
  if (env.ASSETS === undefined) throw new Error('the ASSETS binding is missing');
  const isCounted = request.method === HttpMethod.Get && isTelemetryOn(env);
  if (isCounted) executionContext.waitUntil(countAppcastRequest({ request, env }));
  return env.ASSETS.fetch(request);
}
