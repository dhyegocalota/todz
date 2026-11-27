import { LANGUAGE_PROFILES, Language } from '@todz/types';
import { escapedHtml } from '../escaped-html';
import { HttpHeader, NO_REFERRER, NO_SNIFF, NO_STORE } from '../http-header';
import type { HttpStatus } from '../http-status';
import { SIGN_IN_PAGE_ICON } from '../sign-in-page-icon';
import { type PagePreferences, privatePagePreferencesOf } from '../page-preferences';
import { SitePath } from '../site/site-paths';
import { PAGE_THEME_STYLE, colorSchemeMetaOf, htmlTagOf } from '../standalone-page';
import { sourceHash } from '../turnstile-page';
import { DAY_EMAIL_STOP_COPY_BY_LANGUAGE } from './day-email-stop-copy';

export enum StopPageKind {
  Confirm = 'confirm',
  Done = 'done',
  Gone = 'gone',
  Limited = 'limited',
}

type StopPage = { heading: string; sentence: string; button?: string };

const NO_INDEX = 'noindex';

const PAGE_STYLE = `:root{color-scheme:light dark}
${PAGE_THEME_STYLE}
body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;font:1rem system-ui;background:Canvas;color:CanvasText}
main{box-sizing:border-box;max-width:332px;padding:16px;display:flex;flex-direction:column;align-items:center;gap:16px;text-align:center}
h1{margin:0;font-size:22px;font-weight:700}
p{margin:0;color:GrayText}
form{margin:0}
button{font:inherit;padding:8px 16px;border:0;border-radius:8px;background:AccentColor;color:AccentColorText}
button:focus-visible{outline:2px solid AccentColor;outline-offset:2px}
.language-form{display:flex;flex-wrap:wrap;justify-content:center;gap:4px 8px}
.language-option{padding:4px 8px;background:none;color:GrayText;font-size:0.8125rem}
.language-option[aria-current=true]{color:CanvasText;font-weight:700}`;

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

function languageButtonHtml({ language, current }: { language: Language; current: Language }): string {
  const { nativeName, htmlLang } = LANGUAGE_PROFILES[language];
  const currentAttribute = language === current ? ' aria-current="true"' : '';
  return `<button class="language-option" type="submit" name="${SitePath.LanguageField}" value="${language}" lang="${htmlLang}"${currentAttribute}>${escapedHtml(nativeName)}</button>`;
}

function languageFormHtml({ language, returnPath }: PagePreferences): string {
  const buttons = Object.values(Language).map((candidate) => languageButtonHtml({ language: candidate, current: language }));
  return `<form class="language-form" method="post" action="${SitePath.Language}">
<input type="hidden" name="${SitePath.ReturnField}" value="${escapedHtml(returnPath)}">
${buttons.join('\n')}
</form>`;
}

function pageHtml({ page, preferences }: { page: StopPage; preferences: PagePreferences }): string {
  const { heading, sentence, button } = page;
  return `<!doctype html>
${htmlTagOf(preferences)}
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${colorSchemeMetaOf(preferences.theme)}
<meta name="robots" content="${NO_INDEX}">
<title>${escapedHtml(heading)}</title>
<style>${PAGE_STYLE}</style>
</head>
<body>
<main>
${SIGN_IN_PAGE_ICON}
<h1>${escapedHtml(heading)}</h1>
<p>${escapedHtml(sentence)}</p>
${buttonHtml(button)}${languageFormHtml(preferences)}
</main>
</body>
</html>
`;
}

function stopPreferencesOf({ request }: { request: Request }): PagePreferences {
  const { pathname, search } = new URL(request.url);
  return { ...privatePagePreferencesOf({ request }), returnPath: `${pathname}${search}` };
}

export function stopPageResponse({
  request,
  kind,
  status,
  headers,
}: {
  request: Request;
  kind: StopPageKind;
  status: HttpStatus;
  headers?: Record<string, string>;
}): Response {
  const preferences = stopPreferencesOf({ request });
  const page = DAY_EMAIL_STOP_COPY_BY_LANGUAGE[preferences.language][kind];
  return new Response(pageHtml({ page, preferences }), {
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
