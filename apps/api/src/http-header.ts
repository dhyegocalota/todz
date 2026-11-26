export enum HttpHeader {
  Allow = 'Allow',
  Authorization = 'Authorization',
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
  ServerTiming = 'Server-Timing',
  Accept = 'Accept',
  Vary = 'Vary',
  Link = 'Link',
  SessionDigest = 'Todz-Session-Digest',
  UserAgent = 'User-Agent',
}

export const NO_STORE = 'no-store';
export const NO_SNIFF = 'nosniff';
export const NO_REFERRER = 'no-referrer';
export const STRICT_TRANSPORT_SECURITY = 'max-age=31536000; includeSubDomains';
