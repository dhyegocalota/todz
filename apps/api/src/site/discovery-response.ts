import { MINUTES_PER_HOUR, SECONDS_PER_MINUTE } from '@todz/types';
import { HttpHeader } from '../http-header';
import { HttpMethod } from '../http-method';
import { HttpStatus } from '../http-status';

enum CorsHeader {
  AllowOrigin = 'Access-Control-Allow-Origin',
  AllowMethods = 'Access-Control-Allow-Methods',
}

export const PUBLIC_CACHE_CONTROL = `public, max-age=${SECONDS_PER_MINUTE * MINUTES_PER_HOUR}`;

export const NO_HEADERS = {};

export const OPEN_READ_HEADERS = { [CorsHeader.AllowOrigin]: '*', [CorsHeader.AllowMethods]: HttpMethod.Get };

export type DiscoveryFile = { path: string; contentType: string; body: string; headers: Record<string, string> };

export function discoveryResponse({ contentType, body, headers }: Omit<DiscoveryFile, 'path'>): Response {
  return new Response(body, {
    status: HttpStatus.Ok,
    headers: { [HttpHeader.ContentType]: contentType, [HttpHeader.CacheControl]: PUBLIC_CACHE_CONTROL, ...headers },
  });
}
