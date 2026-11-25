import type { Env } from './env';

export type RequestTimings = { directoryMs: number; projectMs: number };

export function timedEnv(_env: Env): { env: Env; timings: RequestTimings } {
  throw new Error('timedEnv is not implemented');
}
