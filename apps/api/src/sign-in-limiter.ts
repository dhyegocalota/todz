import type { Env } from './env';
import type { OwnerRoute } from './owner-routes';

export async function signInLimitRefusal(context: { request: Request; env: Env; route: OwnerRoute }): Promise<Response | null> {
  throw new Error(`signInLimitRefusal is not implemented for ${context.route}`);
}
