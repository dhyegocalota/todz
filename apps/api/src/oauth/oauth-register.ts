import { agentActor } from '@todz/core';
import { MILLISECONDS_PER_SECOND } from '@todz/types';
import { z } from 'zod';
import { generateCredentialSecret } from '../credential-secret';
import { HttpStatus } from '../http-status';
import { parsedJson } from '../parsed-json';
import { resultOf } from '../project-result';
import { MediaType, hasMediaType, isBoundedRequest } from '../request-body';
import { GRANT_TYPES_SUPPORTED, RESPONSE_TYPES_SUPPORTED, TOKEN_ENDPOINT_AUTH_METHOD } from './oauth-metadata';
import { OAuthError, oauthErrorResponse, oauthJson } from './oauth-errors';
import type { OAuthContext } from './oauth-context';
import { isRegistrableRedirectUri } from './oauth-redirect-uri';
import { insertClient } from './oauth-store';

const REDIRECT_URIS_MAX = 5;

const RegistrationSchema = z.object({
  client_name: z.unknown(),
  redirect_uris: z.unknown(),
  token_endpoint_auth_method: z.string().optional(),
  grant_types: z.array(z.string()).optional(),
  response_types: z.array(z.string()).optional(),
});

type Registration = z.output<typeof RegistrationSchema>;

function isSubsetOf({ values, supported }: { values: string[] | undefined; supported: string[] }): boolean {
  if (values === undefined) return true;
  return values.every((value) => supported.includes(value));
}

function redirectUrisOf(candidate: unknown): string[] | null {
  if (!Array.isArray(candidate)) return null;
  const isCountAllowed = candidate.length > 0 && candidate.length <= REDIRECT_URIS_MAX;
  if (!isCountAllowed) return null;
  if (!candidate.every(isRegistrableRedirectUri)) return null;
  return candidate;
}

// NB ADR 0109: the registered name is the agent's name in the history, so it follows the core's agent name rule.
function clientNameOf(candidate: unknown): string | null {
  if (typeof candidate !== 'string') return null;
  const actor = resultOf(() => agentActor(candidate));
  if (!actor.ok) return null;
  return candidate.trim();
}

function isPublicClient(registration: Registration): boolean {
  const isPublicAuthentication =
    registration.token_endpoint_auth_method === undefined || registration.token_endpoint_auth_method === TOKEN_ENDPOINT_AUTH_METHOD;
  return (
    isPublicAuthentication &&
    isSubsetOf({ values: registration.grant_types, supported: GRANT_TYPES_SUPPORTED }) &&
    isSubsetOf({ values: registration.response_types, supported: RESPONSE_TYPES_SUPPORTED })
  );
}

async function registrationOf(request: Request): Promise<Registration | null> {
  const isReadableJson = isBoundedRequest({ request }) && hasMediaType({ request, mediaType: MediaType.Json });
  if (!isReadableJson) return null;
  const parsed = RegistrationSchema.safeParse(parsedJson(await request.text()));
  if (!parsed.success) return null;
  return parsed.data;
}

// NB ADR 0109: registration takes public clients only, with https or loopback redirect URIs, and needs no Turnstile.
export async function serveRegister({ request, env, now }: OAuthContext): Promise<Response> {
  const registration = await registrationOf(request);
  if (registration === null) return oauthErrorResponse(OAuthError.InvalidClientMetadata);
  const redirectUris = redirectUrisOf(registration.redirect_uris);
  if (redirectUris === null) return oauthErrorResponse(OAuthError.InvalidRedirectUri);
  const clientName = clientNameOf(registration.client_name);
  const isAcceptedClient = clientName !== null && isPublicClient(registration);
  if (!isAcceptedClient) return oauthErrorResponse(OAuthError.InvalidClientMetadata);
  const clientId = generateCredentialSecret();
  await insertClient({ directory: env.DIRECTORY, id: clientId, name: clientName, redirectUris, now });
  return oauthJson({
    body: {
      client_id: clientId,
      client_id_issued_at: Math.floor(now / MILLISECONDS_PER_SECOND),
      client_name: clientName,
      redirect_uris: redirectUris,
      token_endpoint_auth_method: TOKEN_ENDPOINT_AUTH_METHOD,
      grant_types: GRANT_TYPES_SUPPORTED,
      response_types: RESPONSE_TYPES_SUPPORTED,
    },
    status: HttpStatus.Created,
  });
}
