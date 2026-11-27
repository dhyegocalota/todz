import { readRepositoryFile } from './repository-files';

export const SOURCE_LANGUAGE = 'en';
export const LANGUAGES = ['en', 'pt-BR', 'es', 'de', 'fr', 'ja', 'ko', 'zh', 'ar', 'hi'];
const TRANSLATED_STATE = 'translated';
const PLURAL_FORMS: Record<string, string[]> = {
  ja: ['other'],
  ko: ['other'],
  zh: ['other'],
  ar: ['zero', 'one', 'two', 'few', 'many', 'other'],
};
const TWO_FORMS = ['one', 'other'];

type StringUnit = { state: string; value: string };
type Plural = Record<string, { stringUnit?: StringUnit }>;
type Localization = { stringUnit?: StringUnit; variations?: { plural?: Plural } };
export type Catalog = { sourceLanguage: string; strings: Record<string, { localizations?: Record<string, Localization> }> };

export function readCatalog(file: string): Catalog {
  return JSON.parse(readRepositoryFile(file)) as Catalog;
}

export function catalogKeys(catalog: Catalog): string[] {
  return Object.keys(catalog.strings);
}

function localizationOf({ catalog, key, language }: { catalog: Catalog; key: string; language: string }): Localization | undefined {
  return catalog.strings[key]?.localizations?.[language];
}

function isTranslated(unit: StringUnit | undefined): boolean {
  return unit !== undefined && unit.state === TRANSLATED_STATE && unit.value.trim() !== '';
}

function formsFor(language: string): string[] {
  return PLURAL_FORMS[language] || TWO_FORMS;
}

function isLanguageTranslated({ catalog, key, language }: { catalog: Catalog; key: string; language: string }): boolean {
  const localization = localizationOf({ catalog, key, language });
  const plural = localization?.variations?.plural;
  if (!plural) return isTranslated(localization?.stringUnit);
  const forms = Object.keys(plural).sort();
  return forms.join() === [...formsFor(language)].sort().join() && forms.every((form) => isTranslated(plural[form]?.stringUnit));
}

export function untranslated(catalog: Catalog): string[] {
  return catalogKeys(catalog).flatMap((key) =>
    LANGUAGES.filter((language) => !isLanguageTranslated({ catalog, key, language })).map((language) => `${language}: ${key}`),
  );
}

export function inconsistentlyPlural(catalog: Catalog): string[] {
  return catalogKeys(catalog).filter((key) => {
    const isEnglishPlural = localizationOf({ catalog, key, language: SOURCE_LANGUAGE })?.variations?.plural !== undefined;
    const present = LANGUAGES.filter((language) => localizationOf({ catalog, key, language }));
    return !present.every((language) => (localizationOf({ catalog, key, language })?.variations?.plural !== undefined) === isEnglishPlural);
  });
}
