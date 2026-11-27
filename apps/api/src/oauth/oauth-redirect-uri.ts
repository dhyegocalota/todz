const SECURE_PROTOCOL = 'https:';
const PLAIN_PROTOCOL = 'http:';
const FRAGMENT_MARK = '#';
const LOOPBACK_HOSTNAMES = ['127.0.0.1', 'localhost', '[::1]'];
const REDIRECT_URI_LENGTH_MAX = 512;
const PLAIN_HOSTNAME_PATTERN = /^(?:[a-z0-9-]+\.)*[a-z0-9-]+$|^\[[0-9a-f:.]+\]$/;

function parsedUri(candidate: string): URL | null {
  if (!URL.canParse(candidate)) return null;
  return new URL(candidate);
}

function isLoopbackUri(uri: URL): boolean {
  return uri.protocol === PLAIN_PROTOCOL && LOOPBACK_HOSTNAMES.includes(uri.hostname);
}

function hasUnsafeParts({ candidate, uri }: { candidate: string; uri: URL }): boolean {
  return candidate.includes(FRAGMENT_MARK) || uri.username !== '' || uri.password !== '' || !PLAIN_HOSTNAME_PATTERN.test(uri.hostname);
}

// NB ADR 0109: a redirect URI is https on any plain host name or plain http on a loopback host, with no fragment and no user information.
export function isRegistrableRedirectUri(candidate: unknown): candidate is string {
  if (typeof candidate !== 'string') return false;
  if (candidate.length > REDIRECT_URI_LENGTH_MAX) return false;
  const uri = parsedUri(candidate);
  if (uri === null) return false;
  if (hasUnsafeParts({ candidate, uri })) return false;
  return uri.protocol === SECURE_PROTOCOL || isLoopbackUri(uri);
}

function isSameLoopbackRoute({ registered, requested }: { registered: string; requested: URL }): boolean {
  const registeredUri = parsedUri(registered);
  if (registeredUri === null) return false;
  if (!isLoopbackUri(registeredUri)) return false;
  return (
    registeredUri.hostname === requested.hostname &&
    registeredUri.pathname === requested.pathname &&
    registeredUri.search === requested.search
  );
}

// NB ADR 0109: the match is byte for byte, except that a loopback URI may change its port (RFC 8252 §7.3).
export function isRegisteredRedirectUri({ registered, requested }: { registered: string[]; requested: string }): boolean {
  if (registered.includes(requested)) return true;
  if (!isRegistrableRedirectUri(requested)) return false;
  const requestedUri = new URL(requested);
  const isCanonicalLoopback = isLoopbackUri(requestedUri) && requestedUri.href === requested;
  if (!isCanonicalLoopback) return false;
  return registered.some((uri) => isSameLoopbackRoute({ registered: uri, requested: requestedUri }));
}

export function redirectHostOf(redirectUri: string): string {
  return new URL(redirectUri).hostname;
}

export function isLoopbackRedirectUri(redirectUri: string): boolean {
  const uri = parsedUri(redirectUri);
  if (uri === null) return false;
  return isLoopbackUri(uri);
}

export function redirectOriginOf(redirectUri: string): string {
  return new URL(redirectUri).origin;
}
