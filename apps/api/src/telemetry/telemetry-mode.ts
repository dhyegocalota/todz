import { enumValueOf } from '../enum-value';
import type { Env } from '../env';

export enum TelemetryMode {
  On = 'on',
  Off = 'off',
}

export function isTelemetryOn({ TELEMETRY: setting }: Pick<Env, 'TELEMETRY'>): boolean {
  if (setting === undefined) return false;
  return enumValueOf({ enumeration: TelemetryMode, candidate: setting }) === TelemetryMode.On;
}
