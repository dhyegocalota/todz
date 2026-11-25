import { HttpHeader } from './http-header';
import { STRICT_TRANSPORT_SECURITY } from './site/site-headers';

const CONTENT_SECURITY_POLICY = "default-src 'none'; frame-ancestors 'none'";
const CONTENT_TYPE_OPTIONS = 'nosniff';
const REFERRER_POLICY = 'no-referrer';

const SECURITY_HEADERS: [HttpHeader, string][] = [
  [HttpHeader.ContentSecurityPolicy, CONTENT_SECURITY_POLICY],
  [HttpHeader.StrictTransportSecurity, STRICT_TRANSPORT_SECURITY],
  [HttpHeader.ContentTypeOptions, CONTENT_TYPE_OPTIONS],
  [HttpHeader.ReferrerPolicy, REFERRER_POLICY],
];

export function withSecurityHeaders(response: Response): Response {
  if (response.webSocket !== null) return response;
  const secured = new Response(response.body, response);
  SECURITY_HEADERS.filter(([name]) => !secured.headers.has(name)).forEach(([name, value]) => secured.headers.set(name, value));
  return secured;
}
