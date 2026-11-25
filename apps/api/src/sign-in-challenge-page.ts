import type { Env } from './env';

export const SIGN_IN_CHALLENGE_PAGE_PATH = '/sign-in/challenge';

export async function serveSignInChallengePage(_page: { request: Request; env: Env }): Promise<Response> {
  throw new Error('serveSignInChallengePage is not implemented');
}
