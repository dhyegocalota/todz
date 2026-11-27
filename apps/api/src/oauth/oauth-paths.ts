import { MILLISECONDS_PER_DAY, MILLISECONDS_PER_HOUR, MILLISECONDS_PER_MINUTE, MILLISECONDS_PER_SECOND } from '@todz/types';

export const OAUTH_PATH_PREFIX = '/oauth';
export const MCP_PATH = '/mcp';

export enum OAuthPath {
  Authorize = '/oauth/authorize',
  Token = '/oauth/token',
  Register = '/oauth/register',
  Revoke = '/oauth/revoke',
  SignInLinks = '/oauth/sign-in-links',
  LinkPage = '/oauth/sign-in',
  Sessions = '/oauth/sessions',
}

export enum OAuthMetadataPath {
  McpProtectedResource = '/.well-known/oauth-protected-resource/mcp',
  AuthorizationServer = '/.well-known/oauth-authorization-server',
}

export enum OAuthParameter {
  ResponseType = 'response_type',
  ClientId = 'client_id',
  RedirectUri = 'redirect_uri',
  CodeChallenge = 'code_challenge',
  CodeChallengeMethod = 'code_challenge_method',
  State = 'state',
  Scope = 'scope',
  Resource = 'resource',
  Code = 'code',
  Error = 'error',
  Issuer = 'iss',
  GrantType = 'grant_type',
  CodeVerifier = 'code_verifier',
  RefreshToken = 'refresh_token',
  Token = 'token',
}

export enum OAuthField {
  Email = 'email',
  Request = 'request',
  FormToken = 'form_token',
  Decision = 'decision',
  Choice = 'choice',
  Token = 'token',
  TimeZone = 'time_zone',
}

export const OAUTH_DECISION_FIELDS: string[] = [OAuthField.FormToken, OAuthField.Decision, OAuthField.Choice];

export enum OAuthDecision {
  Approve = 'approve',
  Deny = 'deny',
}

export const OAUTH_CODE_LIFETIME_MS = 60 * MILLISECONDS_PER_SECOND;
export const OAUTH_ACCESS_TOKEN_LIFETIME_MS = MILLISECONDS_PER_HOUR;
export const OAUTH_REFRESH_TOKEN_LIFETIME_MS = 30 * MILLISECONDS_PER_DAY;
export const OAUTH_SESSION_LIFETIME_MINUTES = 30;
export const OAUTH_SESSION_LIFETIME_MS = OAUTH_SESSION_LIFETIME_MINUTES * MILLISECONDS_PER_MINUTE;
export const OAUTH_IDLE_CLIENT_LIFETIME_MS = 30 * MILLISECONDS_PER_DAY;
export const OAUTH_UNUSED_CLIENT_LIFETIME_MS = MILLISECONDS_PER_DAY;
export const OAUTH_GRANTS_PER_OWNER_MAX = 20;
export const OAUTH_SPENT_REFRESH_TOKENS_PER_GRANT_MAX = 1_000;
export const OAUTH_LIVE_ACCESS_TOKENS_PER_GRANT_MAX = 10;
export const OAUTH_REFRESH_REUSE_LEEWAY_MS = 30 * MILLISECONDS_PER_SECOND;
