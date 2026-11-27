import type { OAuthContext } from './oauth-context';

export async function serveOAuthCode(context: OAuthContext): Promise<Response> {
  throw new Error(`serveOAuthCode is not implemented for ${context.issuer}`);
}
