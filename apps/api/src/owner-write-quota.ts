import { FairUseLimit } from '@todz/types';
import type { Env } from './env';
import { FAIR_USE_COPY } from './fair-use-copy';
import { type FairUseLimits, fairUseLimitsOf } from './fair-use-limits';
import { limitResponse, suspendedResponse } from './owner-errors';
import type { SessionContext } from './owner-request';
import { WriteRefusal, reserveOwnerWrites } from './owner-usage-store';
import { utcDayOf } from './telemetry/telemetry-day';

export const ONE_WRITE = 1;
export const NO_TEXT_BYTES = 0;

type Text = string | null | undefined;

function isText(text: Text): text is string {
  return text !== null && text !== undefined;
}

export function textBytesOf(texts: Text[]): number {
  const encoder = new TextEncoder();
  return texts.filter(isText).reduce((total, text) => total + encoder.encode(text).byteLength, 0);
}

export function reserveWrites({
  env,
  ownerId,
  now,
  writes,
  bytes,
}: {
  env: Env;
  ownerId: string;
  now: number;
  writes: number;
  bytes: number;
}): Promise<WriteRefusal | null> {
  return reserveOwnerWrites({ directory: env.DIRECTORY, ownerId, day: utcDayOf(now), writes, bytes, limits: fairUseLimitsOf(env) });
}

export async function refusalOf({
  context,
  writes,
  bytes,
}: {
  context: SessionContext;
  writes: number;
  bytes: number;
}): Promise<Response | null> {
  const { env, owner, now } = context;
  const refusal = await reserveWrites({ env, ownerId: owner.ownerId, now, writes, bytes });
  if (refusal === null) return null;
  return fairUseRefusalResponse({ refusal, limits: fairUseLimitsOf(env), now });
}

export async function writeRefusalTextOf({
  env,
  ownerId,
  now,
  writes,
  bytes,
}: {
  env: Env;
  ownerId: string;
  now: number;
  writes: number;
  bytes: number;
}): Promise<string | null> {
  const refusal = await reserveWrites({ env, ownerId, now, writes, bytes });
  if (refusal === null) return null;
  return fairUseRefusalText({ refusal, limits: fairUseLimitsOf(env) });
}

function limitOfRefusal(refusal: WriteRefusal): FairUseLimit | null {
  if (refusal === WriteRefusal.Suspended) return null;
  if (refusal === WriteRefusal.DailyWrites) return FairUseLimit.DailyWrites;
  return FairUseLimit.StoredBytes;
}

export function fairUseRefusalResponse({ refusal, limits, now }: { refusal: WriteRefusal; limits: FairUseLimits; now: number }): Response {
  const limit = limitOfRefusal(refusal);
  if (limit === null) return suspendedResponse();
  return limitResponse({ limit, limits, now });
}

export function fairUseRefusalText({ refusal, limits }: { refusal: WriteRefusal; limits: FairUseLimits }): string {
  const limit = limitOfRefusal(refusal);
  if (limit === null) return FAIR_USE_COPY.suspended;
  return FAIR_USE_COPY.limitMessageOf({ limit, max: limits[limit] });
}
