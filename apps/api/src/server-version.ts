import { API_VERSION_HEADER } from '@todz/types';

export const SERVER_VERSION: string | null = TODZ_SERVER_VERSION;

export function withServerVersion({ response, version }: { response: Response; version: string | null }): Response {
  if (version === null) return response;
  if (response.webSocket !== null) return response;
  const versioned = new Response(response.body, response);
  versioned.headers.set(API_VERSION_HEADER, version);
  return versioned;
}
