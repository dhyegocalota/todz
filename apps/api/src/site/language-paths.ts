import { LANGUAGE_PROFILES, Language } from '@todz/types';
import { CLOUD_QUEUE_PATH, LANDING_PATH } from './site-urls';

export type SitePage = { language: Language; path: string };

export const PUBLIC_PAGE_PATHS = [LANDING_PATH, CLOUD_QUEUE_PATH];

const TRAILING_SLASH = '/';

export function publicPathOf({ language, path }: { language: Language; path: string }): string {
  const { pathPrefix } = LANGUAGE_PROFILES[language];
  if (path === LANDING_PATH) return `${pathPrefix}${TRAILING_SLASH}`;
  return `${pathPrefix}${path}`;
}

const PAGES_BY_PUBLIC_PATH = new Map<string, SitePage>(
  Object.values(Language).flatMap((language) =>
    PUBLIC_PAGE_PATHS.map((path): [string, SitePage] => [publicPathOf({ language, path }), { language, path }]),
  ),
);

export function pageOfPathname({ pathname }: { pathname: string }): SitePage | null {
  const page = PAGES_BY_PUBLIC_PATH.get(pathname);
  if (page === undefined) return null;
  return page;
}

export function slashedPathOf({ pathname }: { pathname: string }): string | null {
  const slashedPathname = `${pathname}${TRAILING_SLASH}`;
  if (!PAGES_BY_PUBLIC_PATH.has(slashedPathname)) return null;
  return slashedPathname;
}
