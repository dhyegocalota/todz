import { clientRateKey } from '../client-rate-key';
import type { Env } from '../env';
import { HttpHeader } from '../http-header';
import { HttpMethod } from '../http-method';
import { limitRefusal } from '../limit-refusal';
import { appVersionDimensionOf } from '../telemetry/app-version-dimension';
import { Metric } from '../telemetry/metric';
import { incrementMetrics } from '../telemetry/metrics-store';
import { sparkleClientOf } from '../telemetry/sparkle-user-agent';
import { utcDayOf } from '../telemetry/telemetry-day';
import { isTelemetryOn } from '../telemetry/telemetry-mode';
import type { SiteContext } from './site-endpoint';

export const APPCAST_PATH = '/download/appcast.xml';

const APPCAST_LIMITER_KEY = 'appcast';
const APPCAST_CONTENT_TYPE = 'application/xml; charset=utf-8';
const APPCAST_CACHE_CONTROL = 'public, max-age=300';

async function countAppcastRequest({ request, env }: { request: Request; env: Env }): Promise<void> {
  const client = sparkleClientOf(request.headers.get(HttpHeader.UserAgent));
  const clientAddress = request.headers.get(HttpHeader.ClientAddress);
  if (client === null || clientAddress === null) return;
  const addressRefusal = await limitRefusal({ limiter: env.APPCAST_ADDRESS_LIMITER, key: clientRateKey({ address: clientAddress }) });
  if (addressRefusal !== null) return;
  const globalRefusal = await limitRefusal({ limiter: env.APPCAST_LIMITER, key: APPCAST_LIMITER_KEY });
  if (globalRefusal !== null) return;
  const dimension = await appVersionDimensionOf({ env, appVersion: client.appVersion, macosMajor: client.macosMajor });
  await incrementMetrics({
    database: env.DIRECTORY,
    writes: [{ day: utcDayOf(Date.now()), metric: Metric.AppcastRequests, dimension, amount: 1 }],
  });
}

// NB ADR 0082: the appcast is the one asset the Worker runs first for, to count a Sparkle check per version without storing the user agent; its headers are set here because the headers file does not apply to a Worker response.
export async function serveAppcast({ request, env, executionContext }: SiteContext): Promise<Response> {
  if (env.ASSETS === undefined) throw new Error('the ASSETS binding is missing');
  const isCounted = request.method === HttpMethod.Get && isTelemetryOn(env);
  if (isCounted) executionContext.waitUntil(countAppcastRequest({ request, env }));
  const asset = await env.ASSETS.fetch(request);
  if (!asset.ok) return asset;
  const feed = new Response(asset.body, asset);
  feed.headers.set(HttpHeader.ContentType, APPCAST_CONTENT_TYPE);
  feed.headers.set(HttpHeader.CacheControl, APPCAST_CACHE_CONTROL);
  return feed;
}
