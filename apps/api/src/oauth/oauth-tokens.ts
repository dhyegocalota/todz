import { MILLISECONDS_PER_SECOND, OAUTH_ACCESS_TOKEN_PREFIX, OAUTH_REFRESH_TOKEN_PREFIX } from '@todz/types';
import { digestCredential } from '../credential-digest';
import { generateCredentialSecret } from '../credential-secret';
import { HttpStatus } from '../http-status';
import { oauthJson } from './oauth-errors';
import { OAUTH_ACCESS_TOKEN_LIFETIME_MS, OAUTH_REFRESH_TOKEN_LIFETIME_MS } from './oauth-paths';
import { OAuthTokenKind, type StoredToken } from './oauth-store';

const TOKEN_TYPE = 'Bearer';

export type IssuedTokens = { accessToken: string; refreshToken: string; stored: StoredToken[] };

const PREFIX_OF_KIND: Record<OAuthTokenKind, string> = {
  [OAuthTokenKind.Access]: OAUTH_ACCESS_TOKEN_PREFIX,
  [OAuthTokenKind.Refresh]: OAUTH_REFRESH_TOKEN_PREFIX,
};

const LIFETIME_MS_OF_KIND: Record<OAuthTokenKind, number> = {
  [OAuthTokenKind.Access]: OAUTH_ACCESS_TOKEN_LIFETIME_MS,
  [OAuthTokenKind.Refresh]: OAUTH_REFRESH_TOKEN_LIFETIME_MS,
};

async function issuedToken({ kind, now }: { kind: OAuthTokenKind; now: number }): Promise<{ secret: string; stored: StoredToken }> {
  const secret = `${PREFIX_OF_KIND[kind]}${generateCredentialSecret()}`;
  return { secret, stored: { digest: await digestCredential(secret), kind, expiresAt: now + LIFETIME_MS_OF_KIND[kind] } };
}

// NB ADR 0109: a token is a prefixed 256-bit secret shown once; only its SHA-256 digest is stored.
export async function issuedTokenPair(now: number): Promise<IssuedTokens> {
  const [access, refresh] = await Promise.all([
    issuedToken({ kind: OAuthTokenKind.Access, now }),
    issuedToken({ kind: OAuthTokenKind.Refresh, now }),
  ]);
  return { accessToken: access.secret, refreshToken: refresh.secret, stored: [access.stored, refresh.stored] };
}

export function tokenAnswerOf({ tokens, scope }: { tokens: IssuedTokens; scope: string }): Response {
  return oauthJson({
    body: {
      access_token: tokens.accessToken,
      token_type: TOKEN_TYPE,
      expires_in: OAUTH_ACCESS_TOKEN_LIFETIME_MS / MILLISECONDS_PER_SECOND,
      refresh_token: tokens.refreshToken,
      scope,
    },
    status: HttpStatus.Ok,
  });
}
