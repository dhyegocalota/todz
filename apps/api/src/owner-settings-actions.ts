import { findOwner, storeOwnerChanges } from './directory-owners';
import type { Env } from './env';
import { ActionFailureKind, type ActionResult, failed } from './owner-action-result';
import type { OwnerRecord } from './owner-records';
import type { SessionOwner } from './project-routing';
import { canonicalTimeZone } from './time-zone';

export type SettingsInput = { timeZone?: string; agentNudge?: boolean; dayEmail?: boolean; dayEmailMinutes?: number };

function absentAsNull<Value>(value: Value | undefined): Value | null {
  if (value === undefined) return null;
  return value;
}

export async function readSettings({ env, owner }: { env: Env; owner: SessionOwner }): Promise<OwnerRecord> {
  const ownerRecord = await findOwner({ directory: env.DIRECTORY, ownerId: owner.ownerId });
  if (ownerRecord === null) throw new Error('a live credential names an owner with no row');
  return ownerRecord;
}

export async function updateSettings({
  env,
  owner,
  now,
  input,
}: {
  env: Env;
  owner: SessionOwner;
  now: number;
  input: SettingsInput;
}): Promise<ActionResult<OwnerRecord>> {
  const timeZone = input.timeZone === undefined ? null : canonicalTimeZone(input.timeZone);
  const isInvalidTimeZone = input.timeZone !== undefined && timeZone === null;
  if (isInvalidTimeZone) return failed(ActionFailureKind.TimeZoneInvalid);
  const ownerRecord = await storeOwnerChanges({
    directory: env.DIRECTORY,
    ownerId: owner.ownerId,
    timeZone,
    agentNudge: absentAsNull(input.agentNudge),
    dayEmail: absentAsNull(input.dayEmail),
    dayEmailMinutes: absentAsNull(input.dayEmailMinutes),
    now,
  });
  if (ownerRecord === null) throw new Error('a live credential names an owner with no row');
  return { ok: true, value: ownerRecord };
}
