const UNAUTHORIZED_STATUS = 401;
const BEARER_PATTERN = /^Bearer (.+)$/i;
const BEARER_SECRET_GROUP = 1;
const BEARER_CHALLENGE = 'Bearer';

export function bearerSecret(request: Request): string | null {
  const authorization = request.headers.get('Authorization');
  if (authorization === null) return null;
  const secret = BEARER_PATTERN.exec(authorization)?.[BEARER_SECRET_GROUP];
  if (secret === undefined) return null;
  return secret;
}

export function unauthorized(): Response {
  return new Response(null, { status: UNAUTHORIZED_STATUS, headers: { 'WWW-Authenticate': BEARER_CHALLENGE } });
}
