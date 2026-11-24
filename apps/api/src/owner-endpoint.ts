import type { Env } from './env';

export async function serveOwner(_parameters: { request: Request; env: Env; now: number }): Promise<Response> {
  throw new Error('serveOwner is not implemented');
}
