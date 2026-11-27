import { describe, expect, test } from 'vitest';
import {
  DOCS_FOLDER_OF,
  DocsLanguage,
  TRANSLATED_LANGUAGES,
  type TranslatedLanguage,
  docsConfiguration,
  englishGroups,
  englishPageNames,
  folderPageNamesOf,
  languageEntries,
  languageEntryOf,
  pageTextOf,
} from './docs-languages';
import { bodyOf, frontMatterOf } from './front-matter';

const EXPECTED_LANGUAGES = ['en', 'pt-BR', 'es', 'de', 'fr', 'ja', 'ko', 'zh', 'ar', 'hi'];
const GROUP_COUNT = 5;
const SHARED_GROUP_NAMES: Record<TranslatedLanguage, string[]> = {
  [DocsLanguage.PortugueseBrazil]: [],
  [DocsLanguage.Spanish]: [],
  [DocsLanguage.German]: [],
  [DocsLanguage.French]: ['Guides'],
  [DocsLanguage.Japanese]: [],
  [DocsLanguage.Korean]: [],
  [DocsLanguage.Chinese]: [],
  [DocsLanguage.Arabic]: [],
  [DocsLanguage.Hindi]: [],
};
const FENCED_BLOCK_PATTERN = /```[\s\S]*?```/g;
const INLINE_CODE_PATTERN = /`[^`\n]+`/g;
const HEADING_PATTERN = /^#{1,6} /gm;
const MARKDOWN_LINK_PATTERN = /\]\((\/[^)\s]*)\)/g;
const ATTRIBUTE_LINK_PATTERN = /(?:href|src)="(\/[^"]*)"/g;
const DOCS_ORIGIN_LINK_PATTERN = /https:\/\/docs\.todz\.app(\/[^)\s"]*|)/g;
const ASSET_PATTERN = /^\/(?:images|logo|favicon)|\.\w{2,4}(?:[?#].*)?$/;
const SHARED_ENDPOINT = '/mcp';
const FIRST_CAPTURE = 1;
const OWNER_FIRST_NAME = ['Dhy', 'ego'].join('');
const OWNER_FULL_NAME = `${OWNER_FIRST_NAME} Calota`;
const OWNER_WEBSITE = 'https://dhyegocalota.com.br';
const BARE_FIRST_NAME_PATTERN = new RegExp(`${OWNER_FIRST_NAME}(?! Calota)`);
const OWNER_FULL_NAME_PATTERN = new RegExp(OWNER_FULL_NAME, 'g');
const OWNER_WEBSITE_PATTERN = new RegExp(OWNER_WEBSITE.replace(/\./g, '\\.'), 'g');

function occurrences({ text, pattern }: { text: string; pattern: RegExp }): string[] {
  return [...text.matchAll(pattern)].map((match) => match[0]);
}

function codeOf(text: string): string[] {
  const body = bodyOf(text);
  return [
    ...occurrences({ text: body, pattern: FENCED_BLOCK_PATTERN }),
    ...occurrences({ text: body.replace(FENCED_BLOCK_PATTERN, ''), pattern: INLINE_CODE_PATTERN }).sort(),
  ];
}

function headingCountOf(text: string): number {
  return occurrences({ text: bodyOf(text).replace(FENCED_BLOCK_PATTERN, ''), pattern: HEADING_PATTERN }).length;
}

function internalPathsOf(text: string): string[] {
  const body = bodyOf(text);
  return [MARKDOWN_LINK_PATTERN, ATTRIBUTE_LINK_PATTERN].flatMap((pattern) =>
    [...body.matchAll(pattern)].map((match) => match[FIRST_CAPTURE]!),
  );
}

function docsOriginPathsOf(text: string): string[] {
  return [...bodyOf(text).matchAll(DOCS_ORIGIN_LINK_PATTERN)].map((match) => match[FIRST_CAPTURE]!);
}

function isInsideFolder({ path, folder }: { path: string; folder: string }): boolean {
  return path === `/${folder}` || path.startsWith(`/${folder}/`) || path.startsWith(`/${folder}#`);
}

function isAsset(path: string): boolean {
  return ASSET_PATTERN.test(path) || path === SHARED_ENDPOINT;
}

describe('docs.json languages', () => {
  test('publishes exactly the ten languages, English first, in place of a flat navigation', () => {
    expect(languageEntries().map((entry) => entry.language)).toEqual(EXPECTED_LANGUAGES);
    expect(docsConfiguration().navigation.groups).toBeUndefined();
  });

  test('the enum holds the same ten codes', () => {
    expect(Object.values(DocsLanguage)).toEqual(EXPECTED_LANGUAGES);
  });

  test.each(TRANSLATED_LANGUAGES)('%s lists the same pages as English, under its folder', (language) => {
    const folder = DOCS_FOLDER_OF[language];
    const expectedPages = englishGroups().map((group) => group.pages.map((page) => `${folder}/${page}`));
    expect(languageEntryOf({ language }).groups.map((group) => group.pages)).toEqual(expectedPages);
  });

  test.each(TRANSLATED_LANGUAGES)('%s names the five groups in its own words', (language) => {
    const names = languageEntryOf({ language }).groups.map((group) => group.group);
    const englishNames = englishGroups().map((group) => group.group);
    expect(names).toHaveLength(GROUP_COUNT);
    expect(new Set(names).size).toBe(GROUP_COUNT);
    const untranslated = names.filter(
      (name, index) => !name || (name === englishNames[index] && !SHARED_GROUP_NAMES[language].includes(name)),
    );
    expect(untranslated).toEqual([]);
  });
});

describe.each(TRANSLATED_LANGUAGES)('the %s pages', (language) => {
  const folder = DOCS_FOLDER_OF[language];

  test('are the twins of the English pages, no more and no fewer', () => {
    expect(folderPageNamesOf({ language }).sort()).toEqual([...englishPageNames()].sort());
  });

  test('keep the front matter keys of the English page and give a title', () => {
    const mismatched = englishPageNames().filter((name) => {
      const twin = frontMatterOf(pageTextOf({ name, language }));
      const english = frontMatterOf(pageTextOf({ name, language: DocsLanguage.English }));
      return !twin.title || Object.keys(twin).join() !== Object.keys(english).join();
    });
    expect(mismatched).toEqual([]);
  });

  test('keep every code block and inline code span of the English page, untranslated', () => {
    const drifted = englishPageNames().filter(
      (name) =>
        JSON.stringify(codeOf(pageTextOf({ name, language }))) !==
        JSON.stringify(codeOf(pageTextOf({ name, language: DocsLanguage.English }))),
    );
    expect(drifted).toEqual([]);
  });

  test('keep the heading count of the English page', () => {
    const drifted = englishPageNames().filter(
      (name) => headingCountOf(pageTextOf({ name, language })) !== headingCountOf(pageTextOf({ name, language: DocsLanguage.English })),
    );
    expect(drifted).toEqual([]);
  });

  test('link only inside their folder, to an asset or to an absolute address', () => {
    const strays = englishPageNames().flatMap((name) =>
      internalPathsOf(pageTextOf({ name, language }))
        .filter((path) => !isAsset(path) && !isInsideFolder({ path, folder }))
        .map((path) => `${name}: ${path}`),
    );
    expect(strays).toEqual([]);
  });

  test('send the docs.todz.app links into their folder', () => {
    const strays = englishPageNames().flatMap((name) =>
      docsOriginPathsOf(pageTextOf({ name, language }))
        .filter((path) => !isAsset(path) && !isInsideFolder({ path, folder }))
        .map((path) => `${name}: ${path}`),
    );
    expect(strays).toEqual([]);
  });

  test('name the owner in full, as often as the English page does, never by first name alone', () => {
    const drifted = englishPageNames().filter((name) => {
      const twin = pageTextOf({ name, language });
      const english = pageTextOf({ name, language: DocsLanguage.English });
      const fullNames = (text: string): number => occurrences({ text, pattern: OWNER_FULL_NAME_PATTERN }).length;
      const websites = (text: string): number => occurrences({ text, pattern: OWNER_WEBSITE_PATTERN }).length;
      return BARE_FIRST_NAME_PATTERN.test(twin) || fullNames(twin) !== fullNames(english) || websites(twin) !== websites(english);
    });
    expect(drifted).toEqual([]);
  });
});
