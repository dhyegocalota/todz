import { noRouteResponse } from './owner-errors';
import { SIGN_IN_PAGE_COPY } from './sign-in-page-copy';
import { SIGN_IN_PAGE_ICON } from './sign-in-page-icon';

export const SIGN_IN_PAGE_PATH = '/sign-in';
const PAGE_METHOD = 'GET';
const HASH_ALGORITHM = 'SHA-256';
const TOKEN_PARAMETER = 'token';
const TOKEN_PATTERN_SOURCE = '^[A-Za-z0-9_-]{43}$';
const APP_LINK_PREFIX = 'todz://sign-in?token=';
const OPEN_BUTTON_ID = 'open';
const READY_STATE = 'ready';

const PAGE_SCRIPT = `const token = new URLSearchParams(location.hash.slice(1)).get('${TOKEN_PARAMETER}');
history.replaceState(null, '', location.pathname);
if (token !== null && /${TOKEN_PATTERN_SOURCE}/.test(token)) {
  const appLink = '${APP_LINK_PREFIX}' + token;
  const button = document.getElementById('${OPEN_BUTTON_ID}');
  button.addEventListener('click', () => { location.href = appLink; });
  document.body.dataset.state = '${READY_STATE}';
  button.focus();
  location.href = appLink;
}`;

const PAGE_STYLE = `:root{color-scheme:light dark}
body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;font:1rem system-ui;background:Canvas;color:CanvasText}
main{box-sizing:border-box;max-width:280px;padding:16px;display:flex;flex-direction:column;align-items:center;gap:16px;text-align:center}
h1{margin:0;font-size:22px;font-weight:700}
p{margin:0;color:GrayText}
.footnote{font-size:0.8125rem}
button{font:inherit;padding:8px 16px;border:0;border-radius:8px;background:AccentColor;color:AccentColorText}
.ready{display:none}
body[data-state=${READY_STATE}] .ready{display:block}
body[data-state=${READY_STATE}] .missing{display:none}`;

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
${SIGN_IN_PAGE_ICON}
<h1>${SIGN_IN_PAGE_COPY.title}</h1>
<p class="missing">${SIGN_IN_PAGE_COPY.missingToken}</p>
<p class="ready">${SIGN_IN_PAGE_COPY.opening}</p>
<button id="${OPEN_BUTTON_ID}" class="ready" type="button">${SIGN_IN_PAGE_COPY.openButton}</button>
<p class="ready footnote">${SIGN_IN_PAGE_COPY.notOpened}</p>
</main>
<script>${PAGE_SCRIPT}</script>
</body>
</html>
`;

async function sourceHash(source: string): Promise<string> {
  const digest = await crypto.subtle.digest(HASH_ALGORITHM, new TextEncoder().encode(source));
  return `'sha256-${btoa(String.fromCharCode(...new Uint8Array(digest)))}'`;
}

const CONTENT_SECURITY_POLICY = [
  "default-src 'none'",
  `script-src ${await sourceHash(PAGE_SCRIPT)}`,
  `style-src ${await sourceHash(PAGE_STYLE)}`,
  'img-src data:',
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'",
].join('; ');

// NB ADR 0040: the page never receives the token; its script reads the fragment, which no request carries.
export async function serveSignInPage(request: Request): Promise<Response> {
  if (request.method !== PAGE_METHOD) return noRouteResponse();
  return new Response(PAGE_HTML, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'Referrer-Policy': 'no-referrer',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': CONTENT_SECURITY_POLICY,
    },
  });
}
