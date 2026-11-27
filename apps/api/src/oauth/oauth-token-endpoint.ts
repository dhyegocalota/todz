import { digestCredential } from '../credential-digest';
import { enumValueOf } from '../enum-value';
import { HttpStatus } from '../http-status';
import { MediaType, hasMediaType, isBoundedRequest } from '../request-body';
import type { OAuthContext } from './oauth-context';
import { OAUTH_NO_STORE_HEADERS, OAuthError, oauthErrorResponse } from './oauth-errors';
import { recordGrantDeletions } from './oauth-grant-deletion';
import { GrantDeletionReason } from './oauth-grant-deletion-reason';
import { isSelectionScope } from './oauth-grant-scope';
import { ownedSelectionOf } from './oauth-grant-selection';
import { OAuthGrantType, mcpResourceOf } from './oauth-metadata';
import { OAUTH_GRANTS_PER_OWNER_MAX, OAuthParameter } from './oauth-paths';
import { isVerifierOfChallenge } from './oauth-pkce';
import { grantedScopeOf } from './oauth-scope';
import {
  type OAuthClientRecord,
  type OAuthCodeRecord,
  findActiveClient,
  insertGrant,
  revokeGrantOfSupersededRefreshToken,
  revokeGrantOfToken,
  revokeReplayedCode,
  rotateTokens,
  spendCode,
  spendRefreshToken,
} from './oauth-store';
import { issuedTokenPair, tokenAnswerOf } from './oauth-tokens';

type TokenRequest = { context: OAuthContext; form: URLSearchParams; client: OAuthClientRecord };

async function formOf(request: Request): Promise<URLSearchParams | null> {
  const isReadableForm = isBoundedRequest({ request }) && hasMediaType({ request, mediaType: MediaType.Form });
  if (!isReadableForm) return null;
  return new URLSearchParams(await request.text());
}

function isForeignResource({ form, issuer }: { form: URLSearchParams; issuer: string }): boolean {
  const resource = form.get(OAuthParameter.Resource);
  return resource !== null && resource !== mcpResourceOf(issuer);
}

async function codeRefusalOf({ spent, form, client, context }: TokenRequest & { spent: OAuthCodeRecord }): Promise<OAuthError | null> {
  const verifier = form.get(OAuthParameter.CodeVerifier);
  if (spent.clientId !== client.id) return OAuthError.InvalidGrant;
  if (spent.expiresAt <= context.now) return OAuthError.InvalidGrant;
  if (form.get(OAuthParameter.RedirectUri) !== spent.redirectUri) return OAuthError.InvalidGrant;
  if (verifier === null) return OAuthError.InvalidRequest;
  if (isForeignResource({ form, issuer: context.issuer })) return OAuthError.InvalidTarget;
  const isVerified = await isVerifierOfChallenge({ verifier, challenge: spent.codeChallenge });
  if (!isVerified) return OAuthError.InvalidGrant;
  const selection = spent.scopes.filter(isSelectionScope);
  const isAccount = selection.length < spent.scopes.length;
  if (isAccount) return null;
  const owned = await ownedSelectionOf({ directory: context.env.DIRECTORY, ownerId: spent.ownerId, scopes: selection });
  if (owned === null) return OAuthError.InvalidGrant;
  return null;
}

// NB ADR 0109: the code is spent before anything is checked, so a wrong verifier burns it too, and a spent code presented again revokes its grant.
async function exchangeCode(tokenRequest: TokenRequest): Promise<Response> {
  const { context, form } = tokenRequest;
  const { env, now } = context;
  const code = form.get(OAuthParameter.Code);
  if (code === null) return oauthErrorResponse(OAuthError.InvalidRequest);
  const digest = await digestCredential(code);
  const spent = await spendCode({ directory: env.DIRECTORY, digest, now });
  if (spent === null) {
    const clientIds = await revokeReplayedCode({ directory: env.DIRECTORY, digest, now });
    await recordGrantDeletions({ env, reason: GrantDeletionReason.ReplayedCode, clientIds, now });
    return oauthErrorResponse(OAuthError.InvalidGrant);
  }
  const refusal = await codeRefusalOf({ ...tokenRequest, spent });
  if (refusal !== null) return oauthErrorResponse(refusal);
  const tokens = await issuedTokenPair(now);
  const { isGranted, evictedClientIds } = await insertGrant({
    directory: env.DIRECTORY,
    grantId: crypto.randomUUID(),
    codeDigest: digest,
    code: spent,
    tokens: tokens.stored,
    now,
    grantsPerOwnerMax: OAUTH_GRANTS_PER_OWNER_MAX,
  });
  await recordGrantDeletions({ env, reason: GrantDeletionReason.Eviction, clientIds: evictedClientIds, now });
  if (!isGranted) return oauthErrorResponse(OAuthError.InvalidGrant);
  return tokenAnswerOf({ tokens, scope: grantedScopeOf(spent.scopes) });
}

async function refresh({ context, form, client }: TokenRequest): Promise<Response> {
  const { env, now, issuer } = context;
  const refreshToken = form.get(OAuthParameter.RefreshToken);
  if (refreshToken === null) return oauthErrorResponse(OAuthError.InvalidRequest);
  if (isForeignResource({ form, issuer })) return oauthErrorResponse(OAuthError.InvalidTarget);
  const digest = await digestCredential(refreshToken);
  const grantId = await spendRefreshToken({ directory: env.DIRECTORY, digest, clientId: client.id, now });
  if (grantId === null) {
    const clientIds = await revokeGrantOfSupersededRefreshToken({ directory: env.DIRECTORY, digest, clientId: client.id });
    await recordGrantDeletions({ env, reason: GrantDeletionReason.ReuseAfterRotation, clientIds, now });
    return oauthErrorResponse(OAuthError.InvalidGrant);
  }
  const tokens = await issuedTokenPair(now);
  const { grant, cappedClientIds } = await rotateTokens({
    directory: env.DIRECTORY,
    grantId,
    tokens: tokens.stored,
    now,
    parentDigest: digest,
  });
  await recordGrantDeletions({ env, reason: GrantDeletionReason.Cap, clientIds: cappedClientIds, now });
  if (grant === null) return oauthErrorResponse(OAuthError.InvalidGrant);
  return tokenAnswerOf({ tokens, scope: grantedScopeOf(grant.scopes) });
}

const HANDLER_OF_GRANT_TYPE: Record<OAuthGrantType, (tokenRequest: TokenRequest) => Promise<Response>> = {
  [OAuthGrantType.AuthorizationCode]: exchangeCode,
  [OAuthGrantType.RefreshToken]: refresh,
};

function activeClientOf({ context, clientId }: { context: OAuthContext; clientId: string }): Promise<OAuthClientRecord | null> {
  return findActiveClient({ directory: context.env.DIRECTORY, clientId, now: context.now });
}

export async function serveToken(context: OAuthContext): Promise<Response> {
  const form = await formOf(context.request);
  if (form === null) return oauthErrorResponse(OAuthError.InvalidRequest);
  const requestedGrantType = form.get(OAuthParameter.GrantType);
  if (requestedGrantType === null) return oauthErrorResponse(OAuthError.InvalidRequest);
  const grantType = enumValueOf({ enumeration: OAuthGrantType, candidate: requestedGrantType });
  if (grantType === null) return oauthErrorResponse(OAuthError.UnsupportedGrantType);
  const clientId = form.get(OAuthParameter.ClientId);
  if (clientId === null) return oauthErrorResponse(OAuthError.InvalidClient);
  const client = await activeClientOf({ context, clientId });
  if (client === null) return oauthErrorResponse(OAuthError.InvalidClient);
  return HANDLER_OF_GRANT_TYPE[grantType]({ context, form, client });
}

// NB ADR 0109: revoking either token of a client deletes its whole grant; an unknown or foreign token answers 200 like a revoked one (RFC 7009 §2.2).
export async function serveRevoke(context: OAuthContext): Promise<Response> {
  const form = await formOf(context.request);
  if (form === null) return oauthErrorResponse(OAuthError.InvalidRequest);
  const token = form.get(OAuthParameter.Token);
  if (token === null) return oauthErrorResponse(OAuthError.InvalidRequest);
  const clientId = form.get(OAuthParameter.ClientId);
  if (clientId === null) return oauthErrorResponse(OAuthError.InvalidClient);
  const clientIds = await revokeGrantOfToken({ directory: context.env.DIRECTORY, digest: await digestCredential(token), clientId });
  await recordGrantDeletions({ env: context.env, reason: GrantDeletionReason.ClientRevoke, clientIds, now: context.now });
  return new Response(null, { status: HttpStatus.Ok, headers: OAUTH_NO_STORE_HEADERS });
}
