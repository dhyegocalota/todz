import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Page } from '@playwright/test';
import { DocsViewport, expect, test } from './support/docs-walk';

enum DocsLanguage {
  English = 'en',
  PortugueseBrazil = 'pt-BR',
  Spanish = 'es',
  German = 'de',
  French = 'fr',
  Japanese = 'ja',
  Korean = 'ko',
  Chinese = 'zh',
}

const DOCS_DIRECTORY = resolve(import.meta.dirname, '..');
const HOME_PATH = '/';
const INDEX_PAGE = 'index';
const QUICKSTART_PAGE = 'quickstart';
const SWITCHER_LOCATOR = '#localization-select-trigger';
const SWITCHER_OPTION_LOCATOR = '[role="menuitem"]';
const PAGE_TITLE_LOCATOR = 'h1';
const REACT_PROPS_KEY_PREFIX = '__reactProps$';
const TITLE_PATTERN = /^title: "?(.+?)"?$/m;
const FIRST_CAPTURE = 1;
const FOLDER_OF: Record<DocsLanguage, string> = {
  [DocsLanguage.English]: '',
  [DocsLanguage.PortugueseBrazil]: 'pt-br',
  [DocsLanguage.Spanish]: 'es',
  [DocsLanguage.German]: 'de',
  [DocsLanguage.French]: 'fr',
  [DocsLanguage.Japanese]: 'ja',
  [DocsLanguage.Korean]: 'ko',
  [DocsLanguage.Chinese]: 'zh',
};
const NATIVE_NAMES: Record<DocsLanguage, string> = {
  [DocsLanguage.English]: 'English',
  [DocsLanguage.PortugueseBrazil]: 'Português (BR)',
  [DocsLanguage.Spanish]: 'Español',
  [DocsLanguage.German]: 'Deutsch',
  [DocsLanguage.French]: 'Français',
  [DocsLanguage.Japanese]: '日本語',
  [DocsLanguage.Korean]: '한국어',
  [DocsLanguage.Chinese]: '简体中文',
};
const TITLE_LANGUAGES = [DocsLanguage.PortugueseBrazil, DocsLanguage.Japanese];
const BROWSER_LOCALES = ['pt-BR', 'ja-JP', 'de-DE'];

function titleOf({ language, page }: { language: DocsLanguage; page: string }): string {
  const folder = FOLDER_OF[language];
  const source = readFileSync(resolve(DOCS_DIRECTORY, folder, `${page}.mdx`), 'utf8');
  const title = TITLE_PATTERN.exec(source)?.[FIRST_CAPTURE];
  if (title === undefined) throw new Error(`${language} ${page} has no front matter title`);
  return title;
}

function pathOf({ language }: { language: DocsLanguage }): string {
  const folder = FOLDER_OF[language];
  if (!folder) return `/${QUICKSTART_PAGE}`;
  return `/${folder}/${QUICKSTART_PAGE}`;
}

async function waitForSwitcherHydration({ page }: { page: Page }): Promise<void> {
  await page.waitForFunction(
    ({ selector, keyPrefix }) => {
      const switcher = document.querySelector(selector);
      return switcher !== null && Object.keys(switcher).some((key) => key.startsWith(keyPrefix));
    },
    { selector: SWITCHER_LOCATOR, keyPrefix: REACT_PROPS_KEY_PREFIX },
  );
}

test.describe('the language switcher', () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== DocsViewport.Desktop);
  });

  test('lists the eight languages by their native names', async ({ page }) => {
    await page.goto(HOME_PATH);
    await waitForSwitcherHydration({ page });
    await page.locator(SWITCHER_LOCATOR).click();
    await expect(page.locator(SWITCHER_OPTION_LOCATOR)).toHaveText(Object.values(NATIVE_NAMES));
  });

  for (const language of TITLE_LANGUAGES) {
    test(`switching to ${language} keeps the page and shows its translated title`, async ({ page }) => {
      await page.goto(pathOf({ language: DocsLanguage.English }));
      await expect(page.locator(PAGE_TITLE_LOCATOR).first()).toHaveText(titleOf({ language: DocsLanguage.English, page: QUICKSTART_PAGE }));
      await waitForSwitcherHydration({ page });
      await page.locator(SWITCHER_LOCATOR).click();
      await page.locator(SWITCHER_OPTION_LOCATOR).filter({ hasText: NATIVE_NAMES[language] }).click();
      await expect(page).toHaveURL(new RegExp(`${pathOf({ language })}$`));
      await expect(page.locator(PAGE_TITLE_LOCATOR).first()).toHaveText(titleOf({ language, page: QUICKSTART_PAGE }));
    });
  }
});

test.describe('the translated pages', () => {
  for (const language of TITLE_LANGUAGES) {
    test(`${language} opens with its translated title`, async ({ page }) => {
      await page.goto(pathOf({ language }));
      await expect(page.locator(PAGE_TITLE_LOCATOR).first()).toHaveText(titleOf({ language, page: QUICKSTART_PAGE }));
    });
  }
});

test.describe('a browser locale', () => {
  for (const locale of BROWSER_LOCALES) {
    test.describe(locale, () => {
      test.use({ locale });

      test('opens the English root and stays there', async ({ page }) => {
        await page.goto(HOME_PATH);
        await expect(page.locator(PAGE_TITLE_LOCATOR).first()).toHaveText(titleOf({ language: DocsLanguage.English, page: INDEX_PAGE }));
        expect(new URL(page.url()).pathname).toBe(HOME_PATH);
      });
    });
  }
});
