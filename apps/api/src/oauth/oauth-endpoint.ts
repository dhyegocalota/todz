import type { Env } from '../env';

export async function serveOAuth(_context: {
  request: Request;
  env: Env;
  now: number;
  executionContext: ExecutionContext;
}): Promise<Response> {
  throw new Error('serveOAuth is not implemented');
}
