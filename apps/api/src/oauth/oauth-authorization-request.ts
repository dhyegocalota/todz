import type { Env } from '../env';
import { HttpHeader } from '../http-header';
import { HttpStatus } from '../http-status';
import { OAuthError } from './oauth-errors';
import { RESPONSE_TYPES_SUPPORTED, mcpResourceOf } from './oauth-metadata';
import { OAuthParameter } from './oauth-paths';
import { CODE_CHALLENGE_METHOD, CODE_CHALLENGE_PATTERN } from './oauth-pkce';
import { isRegisteredRedirectUri } from './oauth-redirect-uri';
import { type OfferedScopes, offeredScopesOf } from './oauth-scope';
import { type OAuthClientRecord, findActiveClient } from './oauth-store';

const STATE_LENGTH_MAX = 1_024;

export type AuthorizationRequest = {
  client: OAuthClientRecord;
  redirectUri: string;
  codeChallenge: string;
  state: string | null;
  scope: string | null;
  resource: string | null;
  offeredScopes: OfferedScopes;
  params: URLSearchParams;
};

export enum AuthorizationOutcomeKind {
  Valid = 'valid',
  Unredirectable = 'unredirectable',
  Refused = 'refused',
}

export type AuthorizationOutcome =
  | { kind: AuthorizationOutcomeKind.Valid; request: AuthorizationRequest }
  | { kind: AuthorizationOutcomeKind.Unredirectable }
  | { kind: AuthorizationOutcomeKind.Refused; redirectUri: string; state: string | null; error: OAuthError };

type RedirectableRequest = { client: OAuthClientRecord; redirectUri: string; state: string | null };

type ValidatedParts = { codeChallenge: string; offeredScopes: OfferedScopes };

const UNREDIRECTABLE: AuthorizationOutcome = { kind: AuthorizationOutcomeKind.Unredirectable };

const AUTHORIZATION_PARAMETERS = [
  OAuthParameter.ResponseType,
  OAuthParameter.ClientId,
  OAuthParameter.RedirectUri,
  OAuthParameter.CodeChallenge,
  OAuthParameter.CodeChallengeMethod,
  OAuthParameter.State,
  OAuthParameter.Scope,
  OAuthParameter.Resource,
];

function hasRepeatedParameter(params: URLSearchParams): boolean {
  return AUTHORIZATION_PARAMETERS.some((name) => params.getAll(name).length > 1);
}

async function redirectableRequestOf({
  params,
  env,
  now,
}: {
  params: URLSearchParams;
  env: Env;
  now: number;
}): Promise<RedirectableRequest | null> {
  if (hasRepeatedParameter(params)) return null;
  const clientId = params.get(OAuthParameter.ClientId);
  const redirectUri = params.get(OAuthParameter.RedirectUri);
  const state = params.get(OAuthParameter.State);
  const isNamed = clientId !== null && redirectUri !== null;
  if (!isNamed) return null;
  const isStateTooLong = state !== null && state.length > STATE_LENGTH_MAX;
  if (isStateTooLong) return null;
  const client = await findActiveClient({ directory: env.DIRECTORY, clientId, now });
  if (client === null) return null;
  if (!isRegisteredRedirectUri({ registered: client.redirectUris, requested: redirectUri })) return null;
  return { client, redirectUri, state };
}

function validatedPartsOf({ params, issuer }: { params: URLSearchParams; issuer: string }): ValidatedParts | OAuthError {
  const responseType = params.get(OAuthParameter.ResponseType);
  const codeChallenge = params.get(OAuthParameter.CodeChallenge);
  const resource = params.get(OAuthParameter.Resource);
  if (responseType === null) return OAuthError.InvalidRequest;
  if (!RESPONSE_TYPES_SUPPORTED.includes(responseType)) return OAuthError.UnsupportedResponseType;
  if (codeChallenge === null) return OAuthError.InvalidRequest;
  if (!CODE_CHALLENGE_PATTERN.test(codeChallenge)) return OAuthError.InvalidRequest;
  if (params.get(OAuthParameter.CodeChallengeMethod) !== CODE_CHALLENGE_METHOD) return OAuthError.InvalidRequest;
  const isForeignResource = resource !== null && resource !== mcpResourceOf(issuer);
  if (isForeignResource) return OAuthError.InvalidTarget;
  const offeredScopes = offeredScopesOf(params.get(OAuthParameter.Scope));
  if (offeredScopes === null) return OAuthError.InvalidScope;
  return { codeChallenge, offeredScopes };
}

// NB ADR 0109: nothing can redirect until the client is known and the redirect URI is one it registered, so the endpoint is never an open redirect.
export async function authorizationOutcomeOf({
  params,
  env,
  issuer,
  now,
}: {
  params: URLSearchParams;
  env: Env;
  issuer: string;
  now: number;
}): Promise<AuthorizationOutcome> {
  const redirectable = await redirectableRequestOf({ params, env, now });
  if (redirectable === null) return UNREDIRECTABLE;
  const { client, redirectUri, state } = redirectable;
  const parts = validatedPartsOf({ params, issuer });
  if (typeof parts === 'string') return { kind: AuthorizationOutcomeKind.Refused, redirectUri, state, error: parts };
  return {
    kind: AuthorizationOutcomeKind.Valid,
    request: {
      client,
      redirectUri,
      state,
      scope: params.get(OAuthParameter.Scope),
      resource: params.get(OAuthParameter.Resource),
      params,
      ...parts,
    },
  };
}

export function requestTextOf(request: AuthorizationRequest): string {
  const { client, redirectUri, codeChallenge, state, scope, resource } = request;
  return JSON.stringify([client.id, redirectUri, codeChallenge, state, scope, resource]);
}

export function redirectAnswerOf({
  redirectUri,
  issuer,
  values,
}: {
  redirectUri: string;
  issuer: string;
  values: [OAuthParameter, string | null][];
}): Response {
  const location = new URL(redirectUri);
  values
    .filter((entry): entry is [OAuthParameter, string] => entry[1] !== null)
    .forEach(([name, value]) => location.searchParams.set(name, value));
  location.searchParams.set(OAuthParameter.Issuer, issuer);
  return new Response(null, { status: HttpStatus.SeeOther, headers: { [HttpHeader.Location]: location.href } });
}

export function refusalRedirectOf({
  redirectUri,
  state,
  error,
  issuer,
}: {
  redirectUri: string;
  state: string | null;
  error: OAuthError;
  issuer: string;
}): Response {
  return redirectAnswerOf({
    redirectUri,
    issuer,
    values: [
      [OAuthParameter.Error, error],
      [OAuthParameter.State, state],
    ],
  });
}
