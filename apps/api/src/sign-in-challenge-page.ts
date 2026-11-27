import type { Env } from './env';
import { SIGN_IN_PAGE_COPY_BY_LANGUAGE } from './sign-in-page-copy';
import { PAGE_THEME_STYLE, type PageAppearance, colorSchemeMetaOf, htmlTagOf } from './standalone-page';
import { TurnstileAction } from './turnstile';
import { TURNSTILE_SCRIPT_TAG, type TurnstilePage, serveTurnstilePage, turnstilePagePolicy } from './turnstile-page';

export const SIGN_IN_CHALLENGE_PAGE_PATH = '/sign-in/challenge';
const MESSAGE_HANDLER = 'turnstile';
const SOLVED_CALLBACK = 'challengeSolved';
const LOST_CALLBACK = 'challengeLost';

const PAGE_SCRIPT = `const post = (message) => window.webkit.messageHandlers.${MESSAGE_HANDLER}.postMessage(message);
window.${SOLVED_CALLBACK} = (token) => post(token);
window.${LOST_CALLBACK} = () => post('');`;

const PAGE_STYLE = `:root{color-scheme:light dark}
${PAGE_THEME_STYLE}
html,body{margin:0;overflow:hidden;background:transparent}
body{display:flex;justify-content:center;font:1rem system-ui;color:CanvasText}
p{margin:0;color:GrayText}`;

function pageHtml({ body, appearance }: { body: string; appearance: PageAppearance }): string {
  return `<!doctype html>
${htmlTagOf(appearance)}
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${colorSchemeMetaOf(appearance.theme)}
<title>${SIGN_IN_PAGE_COPY_BY_LANGUAGE[appearance.language].challengeTitle}</title>
<style>${PAGE_STYLE}</style>
</head>
<body>
${body}
</body>
</html>
`;
}

function availableHtml({ siteKey, ...appearance }: PageAppearance & { siteKey: string }): string {
  const body = `<div class="cf-turnstile" data-sitekey="${siteKey}" data-action="${TurnstileAction.RequestLink}" data-callback="${SOLVED_CALLBACK}" data-expired-callback="${LOST_CALLBACK}" data-error-callback="${LOST_CALLBACK}" data-timeout-callback="${LOST_CALLBACK}"></div>
<script>${PAGE_SCRIPT}</script>
${TURNSTILE_SCRIPT_TAG}`;
  return pageHtml({ body, appearance });
}

const SIGN_IN_CHALLENGE_PAGE: TurnstilePage = {
  available: availableHtml,
  unavailable: (appearance) => pageHtml({ body: `<p>${SIGN_IN_PAGE_COPY_BY_LANGUAGE[appearance.language].unavailable}</p>`, appearance }),
  contentSecurityPolicy: await turnstilePagePolicy({ script: PAGE_SCRIPT, style: PAGE_STYLE }),
};

export async function serveSignInChallengePage({ request, env }: { request: Request; env: Env }): Promise<Response> {
  return serveTurnstilePage({ request, env, page: SIGN_IN_CHALLENGE_PAGE });
}
