import { FairUseLimit } from '@todz/types';
import { cloudAccountsMaxOf } from './cloud-accounts-max';
import { isHeavyWriterRefused } from './cloud-budget-store';
import { CLOUD_COPY } from './cloud-copy';
import { isRefusingMonth } from './cloud-level';
import { cloudMonthOf } from './cloud-month';
import type { Env } from './env';
import { FAIR_USE_COPY } from './fair-use-copy';
import { type FairUseLimits, fairUseLimitsOf } from './fair-use-limits';
import { cloudAtCapacityResponse, limitResponse, suspendedResponse } from './owner-errors';
import type { SessionContext } from './owner-request';
import { WriteRefusal, reserveOwnerWrites } from './owner-usage-store';
import { adminEmailOf } from './site/admin-session';
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

export async function isHeavyWriterRefusedOnCloud({ env, ownerId, now }: { env: Env; ownerId: string; now: number }): Promise<boolean> {
  if (cloudAccountsMaxOf(env) === null) return false;
  if (!(await isRefusingMonth({ env, now }))) return false;
  return isHeavyWriterRefused({ directory: env.DIRECTORY, ownerId, exemptAddress: adminEmailOf(env), ...cloudMonthOf(now) });
}

export async function reserveWrites({
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
  const isRefusedAtCapacity = await isHeavyWriterRefusedOnCloud({ env, ownerId, now });
  if (isRefusedAtCapacity) return WriteRefusal.CloudAtCapacity;
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
  if (refusal === WriteRefusal.CloudAtCapacity) return null;
  if (refusal === WriteRefusal.DailyWrites) return FairUseLimit.DailyWrites;
  return FairUseLimit.StoredBytes;
}

export function fairUseRefusalResponse({ refusal, limits, now }: { refusal: WriteRefusal; limits: FairUseLimits; now: number }): Response {
  if (refusal === WriteRefusal.CloudAtCapacity) return cloudAtCapacityResponse(now);
  const limit = limitOfRefusal(refusal);
  if (limit === null) return suspendedResponse();
  return limitResponse({ limit, limits, now });
}

export function fairUseRefusalText({ refusal, limits }: { refusal: WriteRefusal; limits: FairUseLimits }): string {
  if (refusal === WriteRefusal.CloudAtCapacity) return CLOUD_COPY.atCapacity;
  const limit = limitOfRefusal(refusal);
  if (limit === null) return FAIR_USE_COPY.suspended;
  return FAIR_USE_COPY.limitMessageOf({ limit, max: limits[limit] });
}
