import { LANGUAGE_PROFILES, Language } from '@todz/types';
import { escapedHtml } from '../escaped-html';
import { type PagePreferences, Theme } from '../page-preferences';
import { LANDING_COPY_BY_LANGUAGE } from './landing-copy';
import { SitePath } from './site-paths';

const SHORT_CODE_SEPARATOR = '-';

function shortCodeOf(language: Language): string {
  const [primaryTag] = language.split(SHORT_CODE_SEPARATOR);
  if (primaryTag === undefined) throw new Error('splitting a string always yields a first part');
  return primaryTag.toUpperCase();
}

const GLOBE_ICON = `<svg class="control-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" fill="none" stroke="currentColor" stroke-width="2"/></svg>`;

const THEME_ICONS: Record<Theme, string> = {
  [Theme.System]: `<svg class="control-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="3" y="4" width="18" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M8 20h8M12 16v4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
  [Theme.Light]: `<svg class="control-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
  [Theme.Dark]: `<svg class="control-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>`,
};

function returnInputHtml(preferences: PagePreferences): string {
  return `<input type="hidden" name="${SitePath.ReturnField}" value="${escapedHtml(preferences.returnPath)}">`;
}

function languageButtonHtml({ language, preferences }: { language: Language; preferences: PagePreferences }): string {
  const { nativeName, htmlLang } = LANGUAGE_PROFILES[language];
  const current = language === preferences.language ? ' aria-current="true"' : '';
  return `<button class="language-option" type="submit" name="${SitePath.LanguageField}" value="${language}" lang="${htmlLang}"${current}>${escapedHtml(nativeName)}</button>`;
}

export function languageMenuHtml(preferences: PagePreferences): string {
  const { languageLabel } = LANDING_COPY_BY_LANGUAGE[preferences.language].shell;
  const shortCode = shortCodeOf(preferences.language);
  const buttons = Object.values(Language)
    .map((language) => languageButtonHtml({ language, preferences }))
    .join('\n');
  return `<details class="language-menu">
<summary class="language-summary" aria-label="${escapedHtml(`${languageLabel}: ${shortCode}`)}" aria-expanded="false"><span class="language-code">${shortCode}</span></summary>
<form class="language-form" method="post" action="${SitePath.Language}">
${returnInputHtml(preferences)}
${buttons}
</form>
</details>`;
}

function themeLabelOf({ theme, preferences }: { theme: Theme; preferences: PagePreferences }): string {
  const { shell } = LANDING_COPY_BY_LANGUAGE[preferences.language];
  const labels: Record<Theme, string> = {
    [Theme.System]: shell.themeSystem,
    [Theme.Light]: shell.themeLight,
    [Theme.Dark]: shell.themeDark,
  };
  return labels[theme];
}

function themeButtonHtml({ theme, preferences }: { theme: Theme; preferences: PagePreferences }): string {
  const pressed = theme === preferences.theme;
  return `<button class="theme-option" type="submit" name="${SitePath.ThemeField}" value="${theme}" aria-pressed="${pressed}">${THEME_ICONS[theme]}<span class="visually-hidden">${escapedHtml(themeLabelOf({ theme, preferences }))}</span></button>`;
}

export function themeFormHtml(preferences: PagePreferences): string {
  const { themeLabel } = LANDING_COPY_BY_LANGUAGE[preferences.language].shell;
  const buttons = Object.values(Theme)
    .map((theme) => themeButtonHtml({ theme, preferences }))
    .join('\n');
  return `<form class="theme-form" method="post" action="${SitePath.Theme}" role="group" aria-label="${escapedHtml(themeLabel)}">
${returnInputHtml(preferences)}
${buttons}
</form>`;
}
