import { DAYS_PER_YEAR, HOURS_PER_DAY, Language, MINUTES_PER_HOUR, SECONDS_PER_MINUTE } from '@todz/types';
import { HttpHeader } from './http-header';
import { HttpMethod } from './http-method';
import { enumValueOf } from './enum-value';
import { languageOfAcceptLanguage, languageOfValue } from './language-negotiation';
import { cookieHeaderOf, cookieValueOf } from './request-cookie';

export enum Theme {
  System = 'system',
  Light = 'light',
  Dark = 'dark',
}

export enum PreferenceCookie {
  Language = 'todz_language',
  Theme = 'todz_theme',
}

export type PagePreferences = { language: Language; theme: Theme; returnPath: string };

export const PREFERENCE_MAX_AGE_SECONDS = SECONDS_PER_MINUTE * MINUTES_PER_HOUR * HOURS_PER_DAY * DAYS_PER_YEAR;
const EXPIRED_MAX_AGE_SECONDS = 0;
const SECURE_PROTOCOL = 'https:';
const COOKIE_ATTRIBUTES = 'Path=/; SameSite=Lax';
const SECURE_ATTRIBUTE = '; Secure';
const QUERY_METHODS = [HttpMethod.Get, HttpMethod.Head];

export function languageOfCookie({ request }: { request: Request }): Language | null {
  return languageOfValue({ value: cookieValueOf({ request, name: PreferenceCookie.Language }) });
}

export function languageOfRequest({ request }: { request: Request }): Language {
  const cookieLanguage = languageOfCookie({ request });
  if (cookieLanguage !== null) return cookieLanguage;
  return languageOfAcceptLanguage({ acceptLanguage: request.headers.get(HttpHeader.AcceptLanguage) });
}

export function themeOfValue({ value }: { value: string | null }): Theme | null {
  if (value === null) return null;
  return enumValueOf({ enumeration: Theme, candidate: value });
}

export function themeOfRequest({ request }: { request: Request }): Theme {
  const cookieTheme = themeOfValue({ value: cookieValueOf({ request, name: PreferenceCookie.Theme }) });
  if (cookieTheme === null) return Theme.System;
  return cookieTheme;
}

export function returnPathOf({ request }: { request: Request }): string {
  const { pathname, search } = new URL(request.url);
  if (QUERY_METHODS.includes(request.method as HttpMethod)) return `${pathname}${search}`;
  return pathname;
}

export function pagePreferencesOf({ request, language }: { request: Request; language: Language }): PagePreferences {
  return { language, theme: themeOfRequest({ request }), returnPath: returnPathOf({ request }) };
}

export function privatePagePreferencesOf({ request }: { request: Request }): PagePreferences {
  return pagePreferencesOf({ request, language: languageOfRequest({ request }) });
}

function cookieAttributesOf({ request }: { request: Request }): string {
  const isSecure = new URL(request.url).protocol === SECURE_PROTOCOL;
  if (isSecure) return `${COOKIE_ATTRIBUTES}${SECURE_ATTRIBUTE}`;
  return COOKIE_ATTRIBUTES;
}

export function preferenceCookieOf({ request, cookie, value }: { request: Request; cookie: PreferenceCookie; value: string }): string {
  return cookieHeaderOf({ name: cookie, value, attributes: cookieAttributesOf({ request }), maxAgeSeconds: PREFERENCE_MAX_AGE_SECONDS });
}

export function clearedPreferenceCookieOf({ request, cookie }: { request: Request; cookie: PreferenceCookie }): string {
  return cookieHeaderOf({ name: cookie, value: '', attributes: cookieAttributesOf({ request }), maxAgeSeconds: EXPIRED_MAX_AGE_SECONDS });
}
