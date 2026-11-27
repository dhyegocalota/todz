import { LANGUAGE_PROFILES, Language } from '@todz/types';
import { Theme } from './page-preferences';

export type PageAppearance = { language: Language; theme: Theme };

export const SYSTEM_COLOR_SCHEME = 'light dark';

export const PAGE_THEME_STYLE = `:root[data-theme=light]{color-scheme:light}
:root[data-theme=dark]{color-scheme:dark}`;

export function htmlTagOf({ language, theme }: PageAppearance): string {
  const themeAttribute = theme === Theme.System ? '' : ` data-theme="${theme}"`;
  const { htmlLang, direction } = LANGUAGE_PROFILES[language];
  return `<html lang="${htmlLang}" dir="${direction}"${themeAttribute}>`;
}

export function colorSchemeMetaOf(theme: Theme): string {
  const colorScheme = theme === Theme.System ? SYSTEM_COLOR_SCHEME : theme;
  return `<meta name="color-scheme" content="${colorScheme}">`;
}
