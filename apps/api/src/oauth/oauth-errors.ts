import { SIGN_IN_RATE_LIMIT_PERIOD_SECONDS } from '@todz/types';
import { HttpHeader, NO_STORE } from '../http-header';
import { HttpStatus } from '../http-status';
import { LimitRefusal } from '../limit-refusal';

export enum OAuthError {
  InvalidRequest = 'invalid_request',
  InvalidClient = 'invalid_client',
  InvalidGrant = 'invalid_grant',
  UnsupportedGrantType = 'unsupported_grant_type',
  UnsupportedResponseType = 'unsupported_response_type',
  InvalidScope = 'invalid_scope',
  InvalidTarget = 'invalid_target',
  AccessDenied = 'access_denied',
  InvalidRedirectUri = 'invalid_redirect_uri',
  InvalidClientMetadata = 'invalid_client_metadata',
  TemporarilyUnavailable = 'temporarily_unavailable',
}

const PRAGMA_HEADER = 'Pragma';
const NO_CACHE = 'no-cache';

const STATUS_OF_ERROR: Record<OAuthError, HttpStatus> = {
  [OAuthError.InvalidRequest]: HttpStatus.BadRequest,
  [OAuthError.InvalidClient]: HttpStatus.Unauthorized,
  [OAuthError.InvalidGrant]: HttpStatus.BadRequest,
  [OAuthError.UnsupportedGrantType]: HttpStatus.BadRequest,
  [OAuthError.UnsupportedResponseType]: HttpStatus.BadRequest,
  [OAuthError.InvalidScope]: HttpStatus.BadRequest,
  [OAuthError.InvalidTarget]: HttpStatus.BadRequest,
  [OAuthError.AccessDenied]: HttpStatus.Forbidden,
  [OAuthError.InvalidRedirectUri]: HttpStatus.BadRequest,
  [OAuthError.InvalidClientMetadata]: HttpStatus.BadRequest,
  [OAuthError.TemporarilyUnavailable]: HttpStatus.Unavailable,
};

const STATUS_OF_LIMIT_REFUSAL: Record<LimitRefusal, HttpStatus> = {
  [LimitRefusal.TryAgain]: HttpStatus.TooManyRequests,
  [LimitRefusal.Unavailable]: HttpStatus.Unavailable,
};

export const OAUTH_NO_STORE_HEADERS = { [HttpHeader.CacheControl]: NO_STORE, [PRAGMA_HEADER]: NO_CACHE };

export function oauthJson({ body, status }: { body: unknown; status: HttpStatus }): Response {
  return Response.json(body, { status, headers: OAUTH_NO_STORE_HEADERS });
}

export function oauthErrorResponse(error: OAuthError): Response {
  return oauthJson({ body: { error }, status: STATUS_OF_ERROR[error] });
}

export function oauthLimitResponse(refusal: LimitRefusal): Response {
  const answer = oauthJson({ body: { error: OAuthError.TemporarilyUnavailable }, status: STATUS_OF_LIMIT_REFUSAL[refusal] });
  if (refusal === LimitRefusal.TryAgain) answer.headers.set(HttpHeader.RetryAfter, String(SIGN_IN_RATE_LIMIT_PERIOD_SECONDS));
  return answer;
}
