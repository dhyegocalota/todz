import type { Env } from '../env';

export async function dayEmailStopResponse(context: { request: Request; env: Env }): Promise<Response> {
  throw new Error(`dayEmailStopResponse is not implemented for ${context.request.method}`);
}
