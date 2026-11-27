import { createHash, randomBytes } from 'node:crypto';
import { fieldOf, textOf } from './json-reader';

export type LoopbackReceiver = { redirectUri: string; callback: () => Promise<URLSearchParams>; close: () => void };

export type AuthorizeDependencies = {
  fetch: typeof globalThis.fetch;
  openUrl: (url: string) => Promise<void>;
  receiver: (parameters: { state: string }) => Promise<LoopbackReceiver>;
};

enum OAuthPath {
  Register = '/oauth/register',
  Authorize = '/oauth/authorize',
  Token = '/oauth/token',
}

enum OAuthErrorCode {
  InvalidRequest = 'invalid_request',
  UnauthorizedClient = 'unauthorized_client',
  AccessDenied = 'access_denied',
  UnsupportedResponseType = 'unsupported_response_type',
  InvalidScope = 'invalid_scope',
  ServerError = 'server_error',
  TemporarilyUnavailable = 'temporarily_unavailable',
}

const REFUSAL_LINE = 'the authorization was refused';
const CLIENT_NAME = 'todz-perf';
const PROJECT_SCOPE = 'project';
const RESPONSE_TYPE = 'code';
const CODE_CHALLENGE_METHOD = 'S256';
const AUTHORIZATION_CODE_GRANT = 'authorization_code';
const PUBLIC_CLIENT_AUTHENTICATION = 'none';
const JSON_MEDIA_TYPE = 'application/json';
const FORM_MEDIA_TYPE = 'application/x-www-form-urlencoded';
const VERIFIER_BYTE_LENGTH = 32;
const STATE_BYTE_LENGTH = 16;
const DIGEST_ENCODING = 'base64url';

function randomText(byteLength: number): string {
  return randomBytes(byteLength).toString(DIGEST_ENCODING);
}

async function answerOf({ response, step }: { response: Response; step: string }): Promise<unknown> {
  if (!response.ok) throw new Error(`${step} answered ${response.status}`);
  return response.json();
}

async function registeredClientId({
  origin,
  redirectUri,
  fetch,
}: {
  origin: string;
  redirectUri: string;
  fetch: typeof globalThis.fetch;
}): Promise<string> {
  const response = await fetch(`${origin}${OAuthPath.Register}`, {
    method: 'POST',
    headers: { 'Content-Type': JSON_MEDIA_TYPE },
    body: JSON.stringify({
      client_name: CLIENT_NAME,
      redirect_uris: [redirectUri],
      token_endpoint_auth_method: PUBLIC_CLIENT_AUTHENTICATION,
      grant_types: [AUTHORIZATION_CODE_GRANT],
      response_types: [RESPONSE_TYPE],
    }),
  });
  return textOf(fieldOf({ value: await answerOf({ response, step: `POST ${OAuthPath.Register}` }), name: 'client_id' }));
}

function authorizationUrl({
  origin,
  clientId,
  redirectUri,
  state,
  verifier,
}: {
  origin: string;
  clientId: string;
  redirectUri: string;
  state: string;
  verifier: string;
}): string {
  const url = new URL(`${origin}${OAuthPath.Authorize}`);
  url.search = new URLSearchParams({
    response_type: RESPONSE_TYPE,
    client_id: clientId,
    redirect_uri: redirectUri,
    code_challenge: createHash('sha256').update(verifier).digest(DIGEST_ENCODING),
    code_challenge_method: CODE_CHALLENGE_METHOD,
    state,
    scope: PROJECT_SCOPE,
    resource: `${origin}/mcp`,
  }).toString();
  return url.toString();
}

function refusalOf(errorCode: string | null): string {
  if (errorCode === null) return REFUSAL_LINE;
  const isDefinedErrorCode = Object.values<string>(OAuthErrorCode).includes(errorCode);
  if (!isDefinedErrorCode) return REFUSAL_LINE;
  return `${REFUSAL_LINE}: ${errorCode}`;
}

function codeOf({ callback, state }: { callback: URLSearchParams; state: string }): string {
  if (callback.get('state') !== state) throw new Error('the authorization answered a state this run never sent');
  const code = callback.get('code');
  if (code === null) throw new Error(refusalOf(callback.get('error')));
  return code;
}

export async function authorizedAccessToken({
  origin,
  dependencies,
}: {
  origin: string;
  dependencies: AuthorizeDependencies;
}): Promise<string> {
  const { fetch } = dependencies;
  const state = randomText(STATE_BYTE_LENGTH);
  const receiver = await dependencies.receiver({ state });
  try {
    const clientId = await registeredClientId({ origin, redirectUri: receiver.redirectUri, fetch });
    const verifier = randomText(VERIFIER_BYTE_LENGTH);
    await dependencies.openUrl(authorizationUrl({ origin, clientId, redirectUri: receiver.redirectUri, state, verifier }));
    const code = codeOf({ callback: await receiver.callback(), state });
    const response = await fetch(`${origin}${OAuthPath.Token}`, {
      method: 'POST',
      headers: { 'Content-Type': FORM_MEDIA_TYPE },
      body: new URLSearchParams({
        grant_type: AUTHORIZATION_CODE_GRANT,
        code,
        redirect_uri: receiver.redirectUri,
        client_id: clientId,
        code_verifier: verifier,
        resource: `${origin}/mcp`,
      }).toString(),
    });
    return textOf(fieldOf({ value: await answerOf({ response, step: `POST ${OAuthPath.Token}` }), name: 'access_token' }));
  } finally {
    receiver.close();
  }
}
