import { HttpStatus } from './http-status';

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

export function unauthorized(challenge = BEARER_CHALLENGE): Response {
  return new Response(null, { status: HttpStatus.Unauthorized, headers: { 'WWW-Authenticate': challenge } });
}
