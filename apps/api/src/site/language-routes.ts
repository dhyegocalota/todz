import { Language } from '@todz/types';
import { HttpHeader } from '../http-header';
import { HttpStatus } from '../http-status';
import { languageOfAcceptLanguage, languageOfValue } from '../language-negotiation';
import {
  PreferenceCookie,
  Theme,
  clearedPreferenceCookieOf,
  languageOfCookie,
  preferenceCookieOf,
  themeOfValue,
} from '../page-preferences';
import { MediaType, hasMediaType, isBoundedRequest } from '../request-body';
import { isSameOriginRequest } from '../same-origin';
import { OAuthPath } from '../oauth/oauth-paths';
import { AdminPath } from './admin-paths';
import { isCrawlerRequest } from './crawler';
import { isAnchorOfPath, pageOfPathname, publicPathOf } from './language-paths';
import { SitePath } from './site-paths';
import { LANDING_PATH } from './site-urls';

const ANCHOR_PREFIX = '#';
const ANCHOR_PATTERN = /^#[a-z0-9-]{1,64}$/;
const PLACEHOLDER_ORIGIN = 'https://placeholder.invalid';
const PATH_START = '/';
const UNSAFE_RETURN_START = ['//', '/\\'];
export const NEGOTIATION_VARY = 'Cookie, Accept-Language';

const PRIVATE_RETURN_PATHS = new Set<string>([
  AdminPath.Panel,
  AdminPath.LinkPage,
  AdminPath.Metrics,
  AdminPath.Usage,
  AdminPath.CloudQueue,
  OAuthPath.Authorize,
  OAuthPath.LinkPage,
]);

function anchorSuffixOf({ hash, path }: { hash: string; path: string }): string {
  const isValidAnchor = ANCHOR_PATTERN.test(hash) && isAnchorOfPath({ path, anchor: hash.slice(ANCHOR_PREFIX.length) });
  if (!isValidAnchor) return '';
  return hash;
}

function returnTargetOf({ returned, language }: { returned: string | null; language: Language | null }): string | null {
  if (returned === null || !returned.startsWith(PATH_START)) return null;
  if (UNSAFE_RETURN_START.some((start) => returned.startsWith(start))) return null;
  const url = new URL(returned, PLACEHOLDER_ORIGIN);
  if (url.origin !== PLACEHOLDER_ORIGIN) return null;
  const page = pageOfPathname({ pathname: url.pathname });
  if (page !== null) {
    const pagePath = publicPathOf({ language: language === null ? page.language : language, path: page.path });
    return `${pagePath}${url.search}${anchorSuffixOf({ hash: url.hash, path: page.path })}`;
  }
  if (PRIVATE_RETURN_PATHS.has(url.pathname)) return `${url.pathname}${url.search}`;
  return null;
}

async function preferenceFormOf(request: Request): Promise<URLSearchParams | null> {
  const isReadableForm = isBoundedRequest({ request }) && hasMediaType({ request, mediaType: MediaType.Form });
  if (!isReadableForm) return null;
  return new URLSearchParams(await request.text());
}

function seeOtherResponse({ location, cookie }: { location: string; cookie: string }): Response {
  return new Response(null, { status: HttpStatus.SeeOther, headers: { [HttpHeader.Location]: location, [HttpHeader.SetCookie]: cookie } });
}

function refusalResponse(status: HttpStatus): Response {
  return new Response(null, { status });
}

async function checkedFormOf(request: Request): Promise<URLSearchParams | Response> {
  if (!isSameOriginRequest({ request, origin: new URL(request.url).origin })) return refusalResponse(HttpStatus.Forbidden);
  const form = await preferenceFormOf(request);
  if (form === null) return refusalResponse(HttpStatus.BadRequest);
  return form;
}

export async function serveLanguage({ request }: { request: Request }): Promise<Response> {
  const form = await checkedFormOf(request);
  if (form instanceof Response) return form;
  const language = languageOfValue({ value: form.get(SitePath.LanguageField) });
  if (language === null) return refusalResponse(HttpStatus.BadRequest);
  const target = returnTargetOf({ returned: form.get(SitePath.ReturnField), language });
  const location = target === null ? publicPathOf({ language, path: LANDING_PATH }) : target;
  return seeOtherResponse({ location, cookie: preferenceCookieOf({ request, cookie: PreferenceCookie.Language, value: language }) });
}

export async function serveTheme({ request }: { request: Request }): Promise<Response> {
  const form = await checkedFormOf(request);
  if (form instanceof Response) return form;
  const theme = themeOfValue({ value: form.get(SitePath.ThemeField) });
  if (theme === null) return refusalResponse(HttpStatus.BadRequest);
  const target = returnTargetOf({ returned: form.get(SitePath.ReturnField), language: null });
  const location = target === null ? LANDING_PATH : target;
  const cookie =
    theme === Theme.System
      ? clearedPreferenceCookieOf({ request, cookie: PreferenceCookie.Theme })
      : preferenceCookieOf({ request, cookie: PreferenceCookie.Theme, value: theme });
  return seeOtherResponse({ location, cookie });
}

function redirectResponse({ request, language, cookie }: { request: Request; language: Language; cookie: string | null }): Response {
  const { pathname, search } = new URL(request.url);
  const page = pageOfPathname({ pathname });
  if (page === null) throw new Error('only a public page negotiates');
  const headers = new Headers({
    [HttpHeader.Location]: `${publicPathOf({ language, path: page.path })}${search}`,
    [HttpHeader.Vary]: NEGOTIATION_VARY,
  });
  if (cookie !== null) headers.append(HttpHeader.SetCookie, cookie);
  return new Response(null, { status: HttpStatus.Found, headers });
}

export function negotiatedRedirectOf({ request }: { request: Request }): Response | null {
  if (isCrawlerRequest({ request })) return null;
  const cookieLanguage = languageOfCookie({ request });
  const isChosen = cookieLanguage !== null;
  const language = isChosen ? cookieLanguage : languageOfAcceptLanguage({ acceptLanguage: request.headers.get(HttpHeader.AcceptLanguage) });
  if (language === Language.English) return null;
  const cookie = isChosen ? null : preferenceCookieOf({ request, cookie: PreferenceCookie.Language, value: language });
  return redirectResponse({ request, language, cookie });
}
