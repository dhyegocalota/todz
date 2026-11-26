import type { Env } from '../env';

export enum TelemetryMode {
  On = 'on',
  Off = 'off',
}

export function isTelemetryOn(env: Pick<Env, 'TELEMETRY'>): boolean {
  throw new Error('isTelemetryOn is not implemented');
}
