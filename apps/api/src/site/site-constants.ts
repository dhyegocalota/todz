import { Theme } from '../page-preferences';
import { FORMATTER_LOCALE, MILLISECONDS_PER_HOUR, MILLISECONDS_PER_MINUTE, MILLISECONDS_PER_SECOND, REPOSITORY } from '@todz/types';

export const DARK_THEME_COLOR = '#070812';
export const LIGHT_THEME_COLOR = '#F2F4FA';
const LIGHT_SCHEME_MEDIA = '(prefers-color-scheme: light)';
const DARK_SCHEME_MEDIA = '(prefers-color-scheme: dark)';
const NEVER_MATCHING_MEDIA = 'not all';
const ALWAYS_MATCHING_MEDIA = '';

export type ThemeColorMeta = { content: string; media: string };

export const THEME_COLOR_METAS: Record<Theme, ThemeColorMeta[]> = {
  [Theme.System]: [
    { content: LIGHT_THEME_COLOR, media: LIGHT_SCHEME_MEDIA },
    { content: DARK_THEME_COLOR, media: DARK_SCHEME_MEDIA },
  ],
  [Theme.Light]: [{ content: LIGHT_THEME_COLOR, media: ALWAYS_MATCHING_MEDIA }],
  [Theme.Dark]: [{ content: DARK_THEME_COLOR, media: ALWAYS_MATCHING_MEDIA }],
};

export const WINDOW_SOURCE_MEDIA: Record<Theme, string> = {
  [Theme.System]: DARK_SCHEME_MEDIA,
  [Theme.Light]: NEVER_MATCHING_MEDIA,
  [Theme.Dark]: ALWAYS_MATCHING_MEDIA,
};
export const REPOSITORY_API_ORIGIN = 'https://api.github.com';
export const REPOSITORY_API_URL = `${REPOSITORY_API_ORIGIN}/repos/${REPOSITORY.path}`;
export const REPOSITORY_API_ACCEPT = 'application/vnd.github+json';
export const REPOSITORY_USER_AGENT = 'todz-site';
export const REPOSITORY_STARS_TIMEOUT_MS = 2 * MILLISECONDS_PER_SECOND;
export const REPOSITORY_STARS_CACHE_NAME = 'repository-stars';
export const REPOSITORY_STARS_CACHE_MS = MILLISECONDS_PER_HOUR;
export const REPOSITORY_STARS_RETRY_MS = 5 * MILLISECONDS_PER_MINUTE;
export const STARS_FORMAT_LOCALE = FORMATTER_LOCALE;
export const STARS_FORMAT_OPTIONS = { notation: 'compact', maximumFractionDigits: 1 } as const;
export const STARS_COUNT_UP_MS = 600;
const SCRIPT_OPENER = '<';
const ESCAPED_SCRIPT_OPENER = '\\u003c';

export function scriptJson(value: unknown): string {
  return JSON.stringify(value).replaceAll(SCRIPT_OPENER, ESCAPED_SCRIPT_OPENER);
}
