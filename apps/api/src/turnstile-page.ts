import type { Env } from './env';
import { HttpStatus } from './http-status';
import { noRouteResponse } from './owner-errors';

const PAGE_METHOD = 'GET';
const HASH_ALGORITHM = 'SHA-256';
const SITE_KEY_PATTERN = /^[A-Za-z0-9_-]+$/;
export const TURNSTILE_RESPONSE_FIELD = 'cf-turnstile-response';
export const TURNSTILE_ORIGIN = 'https://challenges.cloudflare.com';
const TURNSTILE_SCRIPT_URL = `${TURNSTILE_ORIGIN}/turnstile/v0/api.js`;
export const TURNSTILE_SCRIPT_TAG = `<script src="${TURNSTILE_SCRIPT_URL}" async defer></script>`;
export const TURNSTILE_EXPLICIT_SCRIPT_URL = `${TURNSTILE_SCRIPT_URL}?render=explicit`;

export type TurnstilePage = { available: (siteKey: string) => string; unavailable: string; contentSecurityPolicy: string };

export function usableSiteKeyOf(configured: string | null | undefined): string | null {
  if (configured === undefined || configured === null) return null;
  if (!SITE_KEY_PATTERN.test(configured)) return null;
  return configured;
}

export function siteKeyOf(env: Env): string | null {
  if (env.TURNSTILE_SECRET_KEY === undefined) return null;
  return usableSiteKeyOf(env.TURNSTILE_SITE_KEY);
}

export async function sourceHash(source: string): Promise<string> {
  const digest = await crypto.subtle.digest(HASH_ALGORITHM, new TextEncoder().encode(source));
  return `'sha256-${btoa(String.fromCharCode(...new Uint8Array(digest)))}'`;
}

export async function turnstilePagePolicy({ script, style }: { script: string; style: string }): Promise<string> {
  return [
    "default-src 'none'",
    `script-src ${await sourceHash(script)} ${TURNSTILE_ORIGIN}`,
    `style-src ${await sourceHash(style)}`,
    'img-src data:',
    `frame-src ${TURNSTILE_ORIGIN}`,
    "base-uri 'none'",
    "form-action 'none'",
    "frame-ancestors 'none'",
  ].join('; ');
}

function pageResponse({
  html,
  status,
  contentSecurityPolicy,
}: {
  html: string;
  status: HttpStatus;
  contentSecurityPolicy: string;
}): Response {
  return new Response(html, {
    status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'Referrer-Policy': 'no-referrer',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': contentSecurityPolicy,
    },
  });
}

// NB ADR 0046: the site key sits in a data attribute, so each page's script stays one fixed source with one hash.
export function serveTurnstilePage({ request, env, page }: { request: Request; env: Env; page: TurnstilePage }): Response {
  if (request.method !== PAGE_METHOD) return noRouteResponse();
  const siteKey = usableSiteKeyOf(env.TURNSTILE_SITE_KEY);
  const { contentSecurityPolicy } = page;
  if (siteKey === null) return pageResponse({ html: page.unavailable, status: HttpStatus.Unavailable, contentSecurityPolicy });
  return pageResponse({ html: page.available(siteKey), status: HttpStatus.Ok, contentSecurityPolicy });
}
