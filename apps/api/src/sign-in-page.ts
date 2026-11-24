import { noRouteResponse } from './owner-errors';
import { SIGN_IN_PAGE_COPY } from './sign-in-page-copy';

export const SIGN_IN_PAGE_PATH = '/sign-in';
const PAGE_METHOD = 'GET';
const HASH_ALGORITHM = 'SHA-256';
const TOKEN_PARAMETER = 'token';
const TOKEN_PATTERN_SOURCE = '^[A-Za-z0-9_-]{43}$';
const APP_LINK_PREFIX = 'todz://sign-in?token=';
const OPEN_BUTTON_ID = 'open';

const PAGE_SCRIPT = `const token = new URLSearchParams(location.hash.slice(1)).get('${TOKEN_PARAMETER}');
if (token !== null && /${TOKEN_PATTERN_SOURCE}/.test(token)) {
  history.replaceState(null, '', location.pathname);
  const appLink = '${APP_LINK_PREFIX}' + token;
  document.getElementById('${OPEN_BUTTON_ID}').href = appLink;
  location.href = appLink;
}`;

const PAGE_STYLE = `body{margin:0;min-height:100vh;display:grid;place-items:center;font:16px system-ui,sans-serif;background:#fff;color:#1c1c1e}
main{text-align:center;padding:24px}
h1{font-size:20px;margin:16px 0 8px}
p{margin:0 0 20px;color:#6e6e73}
a{display:inline-block;padding:10px 18px;border-radius:10px;background:#0a84ff;color:#fff;text-decoration:none}
@media(prefers-color-scheme:dark){body{background:#1c1c1e;color:#f5f5f7}p{color:#a1a1a6}}`;

const PAGE_ICON = `<svg width="48" height="48" viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="24" fill="#0a84ff"/><path d="M14 25l7 7 13-17" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

const PAGE_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${SIGN_IN_PAGE_COPY.title}</title>
<style>${PAGE_STYLE}</style>
</head>
<body>
<main>
${PAGE_ICON}
<h1>${SIGN_IN_PAGE_COPY.heading}</h1>
<p>${SIGN_IN_PAGE_COPY.hint}</p>
<a id="${OPEN_BUTTON_ID}" href="todz://sign-in">${SIGN_IN_PAGE_COPY.button}</a>
</main>
<script>${PAGE_SCRIPT}</script>
</body>
</html>
`;

async function sourceHash(source: string): Promise<string> {
  const digest = await crypto.subtle.digest(HASH_ALGORITHM, new TextEncoder().encode(source));
  return `'sha256-${btoa(String.fromCharCode(...new Uint8Array(digest)))}'`;
}

async function contentSecurityPolicy(): Promise<string> {
  return [
    "default-src 'none'",
    `script-src ${await sourceHash(PAGE_SCRIPT)}`,
    `style-src ${await sourceHash(PAGE_STYLE)}`,
    'img-src data:',
    "base-uri 'none'",
    "form-action 'none'",
    "frame-ancestors 'none'",
  ].join('; ');
}

// NB ADR 0040: the page never receives the token; its script reads the fragment, which no request carries.
export async function serveSignInPage(request: Request): Promise<Response> {
  if (request.method !== PAGE_METHOD) return noRouteResponse();
  return new Response(PAGE_HTML, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'Referrer-Policy': 'no-referrer',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': await contentSecurityPolicy(),
    },
  });
}
