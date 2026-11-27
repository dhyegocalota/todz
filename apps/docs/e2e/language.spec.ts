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
  Arabic = 'ar',
  Hindi = 'hi',
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
  [DocsLanguage.Arabic]: 'ar',
  [DocsLanguage.Hindi]: 'hi',
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
  [DocsLanguage.Arabic]: 'العربية',
  [DocsLanguage.Hindi]: 'Hindi',
};
const TITLE_LANGUAGES = [DocsLanguage.PortugueseBrazil, DocsLanguage.Japanese, DocsLanguage.Arabic, DocsLanguage.Hindi];
const BROWSER_LOCALES = ['pt-BR', 'ja-JP', 'de-DE'];
const CONTENT_LOCATOR = '#content';
const CODE_BLOCK_LOCATOR = 'pre';
const CODE_PAGE = 'connect-an-agent';
const RIGHT_TO_LEFT = 'rtl';
const LEFT_TO_RIGHT = 'ltr';

function titleOf({ language, page }: { language: DocsLanguage; page: string }): string {
  const folder = FOLDER_OF[language];
  const source = readFileSync(resolve(DOCS_DIRECTORY, folder, `${page}.mdx`), 'utf8');
  const title = TITLE_PATTERN.exec(source)?.[FIRST_CAPTURE];
  if (title === undefined) throw new Error(`${language} ${page} has no front matter title`);
  return title;
}

function pathOf({ language, page = QUICKSTART_PAGE }: { language: DocsLanguage; page?: string }): string {
  const folder = FOLDER_OF[language];
  if (!folder) return `/${page}`;
  return `/${folder}/${page}`;
}

async function directionOf({ page, selector }: { page: Page; selector: string }): Promise<string> {
  return page
    .locator(selector)
    .first()
    .evaluate((element) => getComputedStyle(element).direction);
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

  test('lists the ten languages by their native names', async ({ page }) => {
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

test.describe('right-to-left Arabic', () => {
  test('lays the page out right to left and keeps its code blocks left to right', async ({ page }) => {
    await page.goto(pathOf({ language: DocsLanguage.Arabic, page: CODE_PAGE }));
    await expect(page.locator(CODE_BLOCK_LOCATOR).first()).toBeVisible();
    expect(await directionOf({ page, selector: CONTENT_LOCATOR })).toBe(RIGHT_TO_LEFT);
    expect(await directionOf({ page, selector: CODE_BLOCK_LOCATOR })).toBe(LEFT_TO_RIGHT);
  });

  test('leaves English left to right', async ({ page }) => {
    await page.goto(pathOf({ language: DocsLanguage.English, page: CODE_PAGE }));
    await expect(page.locator(CODE_BLOCK_LOCATOR).first()).toBeVisible();
    expect(await directionOf({ page, selector: CONTENT_LOCATOR })).toBe(LEFT_TO_RIGHT);
  });
});
