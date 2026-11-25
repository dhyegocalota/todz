import { HttpHeader, NO_REFERRER, NO_SNIFF, STRICT_TRANSPORT_SECURITY } from './http-header';

const CONTENT_SECURITY_POLICY = "default-src 'none'; frame-ancestors 'none'";

const SECURITY_HEADERS: [HttpHeader, string][] = [
  [HttpHeader.ContentSecurityPolicy, CONTENT_SECURITY_POLICY],
  [HttpHeader.StrictTransportSecurity, STRICT_TRANSPORT_SECURITY],
  [HttpHeader.ContentTypeOptions, NO_SNIFF],
  [HttpHeader.ReferrerPolicy, NO_REFERRER],
];

export function withSecurityHeaders(response: Response): Response {
  if (response.webSocket !== null) return response;
  const secured = new Response(response.body, response);
  SECURITY_HEADERS.filter(([name]) => !secured.headers.has(name)).forEach(([name, value]) => secured.headers.set(name, value));
  return secured;
}
