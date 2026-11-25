import { escapedHtml } from '../escaped-html';
import { HttpHeader, NO_REFERRER, NO_SNIFF, NO_STORE } from '../http-header';
import type { HttpStatus } from '../http-status';
import { SIGN_IN_PAGE_ICON } from '../sign-in-page-icon';
import { sourceHash } from '../turnstile-page';
import { DAY_EMAIL_STOP_COPY } from './day-email-stop-copy';

export type StopPage = { heading: string; sentence: string; button?: string };

const NO_INDEX = 'noindex';

const PAGE_STYLE = `:root{color-scheme:light dark}
body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;font:1rem system-ui;background:Canvas;color:CanvasText}
main{box-sizing:border-box;max-width:332px;padding:16px;display:flex;flex-direction:column;align-items:center;gap:16px;text-align:center}
h1{margin:0;font-size:22px;font-weight:700}
p{margin:0;color:GrayText}
form{margin:0}
button{font:inherit;padding:8px 16px;border:0;border-radius:8px;background:AccentColor;color:AccentColorText}
button:focus-visible{outline:2px solid AccentColor;outline-offset:2px}`;

const PAGE_POLICY = [
  "default-src 'none'",
  `style-src ${await sourceHash(PAGE_STYLE)}`,
  'img-src data:',
  "form-action 'self'",
  "base-uri 'none'",
  "frame-ancestors 'none'",
].join('; ');

function buttonHtml(button: string | undefined): string {
  if (button === undefined) return '';
  return `<form method="post"><button type="submit">${escapedHtml(button)}</button></form>
`;
}

function pageHtml({ heading, sentence, button }: StopPage): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="${NO_INDEX}">
<title>${escapedHtml(heading)}</title>
<style>${PAGE_STYLE}</style>
</head>
<body>
<main>
${SIGN_IN_PAGE_ICON}
<h1>${escapedHtml(heading)}</h1>
<p>${escapedHtml(sentence)}</p>
${buttonHtml(button)}</main>
</body>
</html>
`;
}

export const CONFIRM_PAGE: StopPage = DAY_EMAIL_STOP_COPY.confirm;
export const DONE_PAGE: StopPage = DAY_EMAIL_STOP_COPY.done;
export const GONE_PAGE: StopPage = DAY_EMAIL_STOP_COPY.gone;
export const LIMITED_PAGE: StopPage = DAY_EMAIL_STOP_COPY.limited;

export function stopPageResponse({
  page,
  status,
  headers,
}: {
  page: StopPage;
  status: HttpStatus;
  headers?: Record<string, string>;
}): Response {
  return new Response(pageHtml(page), {
    status,
    headers: {
      [HttpHeader.ContentType]: 'text/html; charset=utf-8',
      [HttpHeader.CacheControl]: NO_STORE,
      [HttpHeader.ReferrerPolicy]: NO_REFERRER,
      [HttpHeader.ContentTypeOptions]: NO_SNIFF,
      [HttpHeader.ContentSecurityPolicy]: PAGE_POLICY,
      [HttpHeader.XRobotsTag]: NO_INDEX,
      ...headers,
    },
  });
}
