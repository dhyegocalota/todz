export enum HttpHeader {
  ClientAddress = 'CF-Connecting-IP',
  RetryAfter = 'Retry-After',
  Cookie = 'Cookie',
  SetCookie = 'Set-Cookie',
  SecFetchSite = 'Sec-Fetch-Site',
  Origin = 'Origin',
  XRobotsTag = 'X-Robots-Tag',
  ContentDisposition = 'Content-Disposition',
  CacheControl = 'Cache-Control',
  ContentType = 'Content-Type',
  ContentLength = 'Content-Length',
  Location = 'Location',
  ContentSecurityPolicy = 'Content-Security-Policy',
  StrictTransportSecurity = 'Strict-Transport-Security',
  ContentTypeOptions = 'X-Content-Type-Options',
  ReferrerPolicy = 'Referrer-Policy',
}

export const NO_STORE = 'no-store';
