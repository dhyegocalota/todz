import type { Env } from './env';

export async function serveMcp({ request, env, now }: { request: Request; env: Env; now: number }): Promise<Response> {
  throw new Error('serveMcp is not implemented');
}
