import { MINUTES_PER_HOUR, SECONDS_PER_MINUTE } from '@todz/types';
import { HttpHeader } from '../http-header';
import { HttpStatus } from '../http-status';

export const PUBLIC_CACHE_CONTROL = `public, max-age=${SECONDS_PER_MINUTE * MINUTES_PER_HOUR}`;

export type DiscoveryFile = { path: string; contentType: string; body: string; headers: Record<string, string> };

export function discoveryResponse({ contentType, body, headers }: Omit<DiscoveryFile, 'path'>): Response {
  return new Response(body, {
    status: HttpStatus.Ok,
    headers: { [HttpHeader.ContentType]: contentType, [HttpHeader.CacheControl]: PUBLIC_CACHE_CONTROL, ...headers },
  });
}
