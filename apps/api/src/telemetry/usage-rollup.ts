import type { Env } from '../env';

export const USAGE_PATH = '/telemetry/usage';

export async function serveUsageRollup({ request, env }: { request: Request; env: Env }): Promise<Response> {
  throw new Error('serveUsageRollup is not implemented');
}
