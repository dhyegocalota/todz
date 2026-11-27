import { readRepositoryFile, repositoryFiles } from './repository-files';

export enum DocsLanguage {
  English = 'en',
  PortugueseBrazil = 'pt-BR',
  Spanish = 'es',
  German = 'de',
  French = 'fr',
  Japanese = 'ja',
  Korean = 'ko',
  Chinese = 'zh',
}

export const DOCS_FOLDER_OF: Record<DocsLanguage, string> = {
  [DocsLanguage.English]: '',
  [DocsLanguage.PortugueseBrazil]: 'pt-br',
  [DocsLanguage.Spanish]: 'es',
  [DocsLanguage.German]: 'de',
  [DocsLanguage.French]: 'fr',
  [DocsLanguage.Japanese]: 'ja',
  [DocsLanguage.Korean]: 'ko',
  [DocsLanguage.Chinese]: 'zh',
};

export const DOCS_DIRECTORY = 'apps/docs';
export const DOCS_CONFIGURATION = 'apps/docs/docs.json';
export const PAGE_EXTENSION = '.mdx';

const FOLDER_SEPARATOR = '/';

export type NavigationGroup = { group: string; pages: string[] };
export type LanguageEntry = { language: string; groups: NavigationGroup[] };
type DocsConfiguration = { navigation: { languages?: LanguageEntry[]; groups?: NavigationGroup[] } };

export type TranslatedLanguage = Exclude<DocsLanguage, DocsLanguage.English>;

function isTranslated(language: DocsLanguage): language is TranslatedLanguage {
  return language !== DocsLanguage.English;
}

export const TRANSLATED_LANGUAGES: TranslatedLanguage[] = Object.values(DocsLanguage).filter(isTranslated);

export function docsConfiguration(): DocsConfiguration {
  return JSON.parse(readRepositoryFile(DOCS_CONFIGURATION)) as DocsConfiguration;
}

export function languageEntries(): LanguageEntry[] {
  const entries = docsConfiguration().navigation.languages;
  if (!entries) throw new Error('docs.json has no navigation.languages');
  return entries;
}

export function languageEntryOf({ language }: { language: DocsLanguage }): LanguageEntry {
  const entry = languageEntries().find((candidate) => candidate.language === language);
  if (!entry) throw new Error(`docs.json has no ${language} entry`);
  return entry;
}

export function englishGroups(): NavigationGroup[] {
  return languageEntryOf({ language: DocsLanguage.English }).groups;
}

export function englishPageNames(): string[] {
  return englishGroups().flatMap((group) => group.pages);
}

export function pagePathOf({ name, language }: { name: string; language: DocsLanguage }): string {
  const folder = DOCS_FOLDER_OF[language];
  const pagePath = `${name}${PAGE_EXTENSION}`;
  if (!folder) return `${DOCS_DIRECTORY}/${pagePath}`;
  return `${DOCS_DIRECTORY}/${folder}/${pagePath}`;
}

export function pageTextOf({ name, language }: { name: string; language: DocsLanguage }): string {
  return readRepositoryFile(pagePathOf({ name, language }));
}

export function folderPageNamesOf({ language }: { language: DocsLanguage }): string[] {
  const prefix = `${DOCS_DIRECTORY}/${DOCS_FOLDER_OF[language]}${FOLDER_SEPARATOR}`;
  return repositoryFiles(`${DOCS_DIRECTORY}/${DOCS_FOLDER_OF[language]}`)
    .filter((path) => path.startsWith(prefix) && path.endsWith(PAGE_EXTENSION))
    .map((path) => path.slice(prefix.length, -PAGE_EXTENSION.length));
}

export function rootPageNames(): string[] {
  const prefix = `${DOCS_DIRECTORY}${FOLDER_SEPARATOR}`;
  return repositoryFiles(DOCS_DIRECTORY)
    .filter((path) => path.endsWith(PAGE_EXTENSION))
    .map((path) => path.slice(prefix.length, -PAGE_EXTENSION.length))
    .filter((name) => !name.includes(FOLDER_SEPARATOR));
}
