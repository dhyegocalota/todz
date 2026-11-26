import type { Env } from '../env';

export async function runMetricsNightly({ scheduledTime, env }: { scheduledTime: number; env: Env }): Promise<void> {
  throw new Error('runMetricsNightly is not implemented');
}
