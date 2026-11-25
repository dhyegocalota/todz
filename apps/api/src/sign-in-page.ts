import { AppLinkScheme } from './app-link-scheme';
import type { Env } from './env';
import { SIGN_IN_PAGE_COPY } from './sign-in-page-copy';
import { SIGN_IN_PAGE_ICON } from './sign-in-page-icon';
import { TURNSTILE_TOKEN_PATTERN_SOURCE, TurnstileAction } from './turnstile';
import { TURNSTILE_EXPLICIT_SCRIPT_URL, type TurnstilePage, serveTurnstilePage, turnstilePagePolicy } from './turnstile-page';

export const SIGN_IN_PAGE_PATH = '/sign-in';
const TOKEN_PARAMETER = 'token';
const APP_PARAMETER = 'app';
const TOKEN_PATTERN_SOURCE = '^[A-Za-z0-9_-]{43}$';
const APP_LINK_TOKEN_PREFIX = '://sign-in?token=';
const APP_LINK_TURNSTILE_SEPARATOR = '&turnstile=';
const APP_LINK_ORIGIN_SEPARATOR = '&origin=';
const OPEN_BUTTON_ID = 'open';
const CHECK_ID = 'check';
const CHECKING_STATE = 'checking';
const FAILED_STATE = 'failed';
const READY_STATE = 'ready';

const APP_LINK_SCHEMES = JSON.stringify(Object.values(AppLinkScheme));

const PAGE_SCRIPT = `{
  const fragment = new URLSearchParams(location.hash.slice(1));
  const token = fragment.get('${TOKEN_PARAMETER}');
  const app = fragment.get('${APP_PARAMETER}');
  history.replaceState(null, '', location.pathname);
  if (token !== null && /${TOKEN_PATTERN_SOURCE}/.test(token) && ${APP_LINK_SCHEMES}.includes(app)) {
    const button = document.getElementById('${OPEN_BUTTON_ID}');
    const check = document.getElementById('${CHECK_ID}');
    let appLink = null;
    let widget = null;
    const fail = () => { document.body.dataset.state = '${FAILED_STATE}'; };
    const checked = (turnstileToken) => {
      if (!/${TURNSTILE_TOKEN_PATTERN_SOURCE}/.test(turnstileToken)) return fail();
      const isFirstCheck = appLink === null;
      appLink = app + '${APP_LINK_TOKEN_PREFIX}' + token + '${APP_LINK_TURNSTILE_SEPARATOR}' + turnstileToken + '${APP_LINK_ORIGIN_SEPARATOR}' + encodeURIComponent(location.origin);
      document.body.dataset.state = '${READY_STATE}';
      if (!isFirstCheck) return;
      button.focus();
      location.href = appLink;
    };
    const expired = () => {
      document.body.dataset.state = '${CHECKING_STATE}';
      turnstile.reset(widget);
    };
    button.addEventListener('click', () => { location.href = appLink; });
    document.body.dataset.state = '${CHECKING_STATE}';
    const loader = document.createElement('script');
    loader.src = '${TURNSTILE_EXPLICIT_SCRIPT_URL}';
    loader.addEventListener('load', () => {
      widget = turnstile.render(check, {
        sitekey: check.dataset.sitekey,
        action: '${TurnstileAction.SignIn}',
        'refresh-expired': 'manual',
        callback: checked,
        'expired-callback': expired,
        'error-callback': fail,
        'timeout-callback': fail,
      });
    });
    document.head.appendChild(loader);
  }
}`;

const PAGE_STYLE = `:root{color-scheme:light dark}
body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;font:1rem system-ui;background:Canvas;color:CanvasText}
main{box-sizing:border-box;max-width:332px;padding:16px;display:flex;flex-direction:column;align-items:center;gap:16px;text-align:center}
h1{margin:0;font-size:22px;font-weight:700}
p{margin:0;color:GrayText}
.footnote{font-size:0.8125rem}
button{font:inherit;padding:8px 16px;border:0;border-radius:8px;background:AccentColor;color:AccentColorText}
.${CHECKING_STATE},.${FAILED_STATE},.${READY_STATE}{display:none}
body[data-state=${CHECKING_STATE}] .${CHECKING_STATE},body[data-state=${FAILED_STATE}] .${FAILED_STATE},body[data-state=${READY_STATE}] .${READY_STATE}{display:block}
body[data-state] .missing{display:none}`;

function pageHtml(main: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${SIGN_IN_PAGE_COPY.title}</title>
<style>${PAGE_STYLE}</style>
</head>
<body>
${main}
</body>
</html>
`;
}

function availableHtml(siteKey: string): string {
  return pageHtml(`<main>
${SIGN_IN_PAGE_ICON}
<h1>${SIGN_IN_PAGE_COPY.title}</h1>
<p class="missing">${SIGN_IN_PAGE_COPY.missingToken}</p>
<p class="${CHECKING_STATE}">${SIGN_IN_PAGE_COPY.checking}</p>
<div id="${CHECK_ID}" class="${CHECKING_STATE}" data-sitekey="${siteKey}"></div>
<p class="${FAILED_STATE}">${SIGN_IN_PAGE_COPY.checkFailed}</p>
<p class="${READY_STATE}">${SIGN_IN_PAGE_COPY.opening}</p>
<button id="${OPEN_BUTTON_ID}" class="${READY_STATE}" type="button">${SIGN_IN_PAGE_COPY.openButton}</button>
<p class="${READY_STATE} footnote">${SIGN_IN_PAGE_COPY.notOpened}</p>
</main>
<script>${PAGE_SCRIPT}</script>`);
}

const SIGN_IN_PAGE: TurnstilePage = {
  available: availableHtml,
  unavailable: pageHtml(`<main>
${SIGN_IN_PAGE_ICON}
<h1>${SIGN_IN_PAGE_COPY.title}</h1>
<p>${SIGN_IN_PAGE_COPY.unavailable}</p>
</main>`),
  contentSecurityPolicy: await turnstilePagePolicy({ script: PAGE_SCRIPT, style: PAGE_STYLE }),
};

// NB ADR 0040: the page never receives the token; its script reads the fragment, which no request carries.
export async function serveSignInPage({ request, env }: { request: Request; env: Env }): Promise<Response> {
  return serveTurnstilePage({ request, env, page: SIGN_IN_PAGE });
}
