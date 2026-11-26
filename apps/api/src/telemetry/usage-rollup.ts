import { USAGE_RATE_LIMIT_PERIOD_SECONDS } from '@todz/types';
import { z } from 'zod';
import { clientRateKey } from '../client-rate-key';
import type { Env } from '../env';
import { HttpHeader } from '../http-header';
import { HttpMethod } from '../http-method';
import { HttpStatus } from '../http-status';
import { LimitRefusal, limitRefusal } from '../limit-refusal';
import { noRouteResponse } from '../owner-errors';
import { parsedJson } from '../parsed-json';
import { appVersionDimensionOf } from './app-version-dimension';
import { Metric, UsageEvent } from './metric';
import { incrementMetrics, incrementWithinCap } from './metrics-store';
import { USAGE_BODY_MAX_BYTES, USAGE_COUNT_MAX, USAGE_ROLLUPS_PER_DAY_MAX } from './telemetry-constants';
import { utcDayOf } from './telemetry-day';
import { isTelemetryOn } from './telemetry-mode';

export const USAGE_PATH = '/telemetry/usage';

const GLOBAL_LIMITER_KEY = 'usage';
const CONTENT_LENGTH_PATTERN = /^\d+$/;
const APP_VERSION_PATTERN = /^\d{1,3}\.\d{1,3}\.\d{1,3}$/;
const MACOS_MAJOR_MIN = 10;
const MACOS_MAJOR_MAX = 99;
const COUNT_SCHEMA = z.number().int().min(0).max(USAGE_COUNT_MAX).optional();

const UsageRollupSchema = z.strictObject({
  installId: z.uuid(),
  appVersion: z.string().regex(APP_VERSION_PATTERN),
  macosMajor: z.number().int().min(MACOS_MAJOR_MIN).max(MACOS_MAJOR_MAX),
  counts: z.strictObject(Object.fromEntries(Object.values(UsageEvent).map((event) => [event, COUNT_SCHEMA]))),
});

type UsageRollup = z.infer<typeof UsageRollupSchema>;

const ANSWER_OF_REFUSAL: Record<LimitRefusal, () => Response> = {
  [LimitRefusal.TryAgain]: tryAgainResponse,
  [LimitRefusal.Unavailable]: () => new Response(null, { status: HttpStatus.Unavailable }),
};

function tryAgainResponse(): Response {
  return new Response(null, {
    status: HttpStatus.TooManyRequests,
    headers: { [HttpHeader.RetryAfter]: String(USAGE_RATE_LIMIT_PERIOD_SECONDS) },
  });
}

function status(code: HttpStatus): Response {
  return new Response(null, { status: code });
}

function isOverSize(request: Request): boolean {
  const contentLength = request.headers.get(HttpHeader.ContentLength);
  if (contentLength === null) return true;
  return !CONTENT_LENGTH_PATTERN.test(contentLength) || Number(contentLength) > USAGE_BODY_MAX_BYTES;
}

async function refusalOf({ limiter, key }: { limiter: RateLimit | undefined; key: string }): Promise<Response | null> {
  const refusal = await limitRefusal({ limiter, key });
  if (refusal === null) return null;
  return ANSWER_OF_REFUSAL[refusal]();
}

async function recordRollup({ env, rollup }: { env: Env; rollup: UsageRollup }): Promise<boolean> {
  const { DIRECTORY: database } = env;
  const day = utcDayOf(Date.now());
  const isWithinCap = await incrementWithinCap({ database, day, metric: Metric.UsageRollups, capMax: USAGE_ROLLUPS_PER_DAY_MAX });
  if (!isWithinCap) return false;
  const eventWrites = Object.values(UsageEvent).flatMap((event) => {
    const count = rollup.counts[event];
    if (count === undefined || count === 0) return [];
    return [{ day, metric: Metric.UsageEvents, dimension: event, amount: count }];
  });
  const versionWrite = {
    day,
    metric: Metric.UsageVersions,
    dimension: await appVersionDimensionOf({ env, appVersion: rollup.appVersion, macosMajor: String(rollup.macosMajor) }),
    amount: 1,
  };
  await incrementMetrics({ database, writes: [versionWrite, ...eventWrites] });
  return true;
}

// NB ADR 0082: the install identifier only keys a rate limiter; it is never stored, and a body over two kilobytes is refused before it is parsed.
export async function serveUsageRollup({ request, env }: { request: Request; env: Env }): Promise<Response> {
  if (!isTelemetryOn(env)) return noRouteResponse();
  if (request.method !== HttpMethod.Post) return status(HttpStatus.MethodNotAllowed);
  if (isOverSize(request)) return status(HttpStatus.PayloadTooLarge);
  const clientAddress = request.headers.get(HttpHeader.ClientAddress);
  if (clientAddress === null) return status(HttpStatus.Unavailable);
  const clientRefusal = await refusalOf({ limiter: env.USAGE_LIMITER, key: clientRateKey({ address: clientAddress }) });
  if (clientRefusal !== null) return clientRefusal;
  const globalRefusal = await refusalOf({ limiter: env.USAGE_GLOBAL_LIMITER, key: GLOBAL_LIMITER_KEY });
  if (globalRefusal !== null) return globalRefusal;
  const parsed = UsageRollupSchema.safeParse(parsedJson(await request.text()));
  if (!parsed.success) return status(HttpStatus.Unprocessable);
  const installRefusal = await refusalOf({ limiter: env.USAGE_INSTALL_LIMITER, key: parsed.data.installId });
  if (installRefusal !== null) return installRefusal;
  const isRecorded = await recordRollup({ env, rollup: parsed.data });
  if (!isRecorded) return tryAgainResponse();
  return status(HttpStatus.NoContent);
}
