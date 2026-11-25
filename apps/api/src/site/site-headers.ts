import { HttpStatus } from '../http-status';
import { sourceHash } from '../turnstile-page';
import { ADMIN_RESPONSE_HEADERS } from './admin-paths';

const HTML_CONTENT_TYPE = 'text/html; charset=utf-8';
const CACHE_CONTROL = 'no-cache';
const REFERRER_POLICY = 'no-referrer';
const CONTENT_TYPE_OPTIONS = 'nosniff';
export const STRICT_TRANSPORT_SECURITY = 'max-age=31536000';
const CONNECT_SELF = "connect-src 'self'";

export async function siteContentSecurityPolicy({
  style,
  script,
  widgetOrigin,
  connectsToSelf,
}: {
  style: string;
  script: string | null;
  widgetOrigin: string | null;
  connectsToSelf: boolean;
}): Promise<string> {
  const widgetOrigins = widgetOrigin === null ? [] : [widgetOrigin];
  const connectDirectives = connectsToSelf ? [CONNECT_SELF] : [];
  const scriptDirectives = script === null ? [] : [['script-src', await sourceHash(script), ...widgetOrigins].join(' ')];
  return [
    "default-src 'none'",
    ...scriptDirectives,
    `style-src ${await sourceHash(style)}`,
    "img-src 'self'",
    ...connectDirectives,
    ...widgetOrigins.map((origin) => `frame-src ${origin}`),
    "form-action 'self'",
    "frame-ancestors 'none'",
    "base-uri 'none'",
  ].join('; ');
}

export function sitePageResponse({ html, contentSecurityPolicy }: { html: string; contentSecurityPolicy: string }): Response {
  return new Response(html, {
    status: HttpStatus.Ok,
    headers: {
      'Content-Type': HTML_CONTENT_TYPE,
      'Cache-Control': CACHE_CONTROL,
      'Referrer-Policy': REFERRER_POLICY,
      'X-Content-Type-Options': CONTENT_TYPE_OPTIONS,
      'Strict-Transport-Security': STRICT_TRANSPORT_SECURITY,
      'Content-Security-Policy': contentSecurityPolicy,
    },
  });
}

export function adminPageResponse({ html, contentSecurityPolicy }: { html: string; contentSecurityPolicy: string }): Response {
  const response = sitePageResponse({ html, contentSecurityPolicy });
  Object.entries(ADMIN_RESPONSE_HEADERS).forEach(([name, value]) => response.headers.set(name, value));
  return response;
}
