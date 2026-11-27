import { describe, expect, test } from 'vitest';
import { readRepositoryFile, repositoryFiles } from './repository-files';
import { catalogKeyShape, localizedKeys } from './swift-localized-keys';

const CATALOG_FILE = 'apps/macos/Copy/Localizable.xcstrings';
const SWIFT_PATHSPECS = ['apps/macos/Copy/*.swift', 'apps/macos/Todz/*.swift', 'apps/macos/TodzWidgets/*.swift'];
const SOURCE_LANGUAGE = 'en';
const TRANSLATED_STATE = 'translated';
const LANGUAGES = ['en', 'pt-BR', 'es', 'de', 'fr', 'ja', 'ko', 'zh'];
const SINGLE_FORM_LANGUAGES = ['ja', 'ko', 'zh'];
const SINGLE_FORM = ['other'];
const TWO_FORMS = ['one', 'other'];

type StringUnit = { state: string; value: string };
type Localization = { stringUnit?: StringUnit; variations?: { plural?: Record<string, { stringUnit?: StringUnit }> } };
type Catalog = { sourceLanguage: string; strings: Record<string, { localizations?: Record<string, Localization> }> };

const catalog = JSON.parse(readRepositoryFile(CATALOG_FILE)) as Catalog;
const entries = Object.entries(catalog.strings);

function localizationOf({ key, language }: { key: string; language: string }): Localization | undefined {
  return catalog.strings[key]?.localizations?.[language];
}

function isTranslated(unit: StringUnit | undefined): boolean {
  return unit !== undefined && unit.state === TRANSLATED_STATE && unit.value.trim() !== '';
}

function pluralOf(localization: Localization | undefined): Record<string, { stringUnit?: StringUnit }> | undefined {
  return localization?.variations?.plural;
}

function formsFor(language: string): string[] {
  return SINGLE_FORM_LANGUAGES.includes(language) ? SINGLE_FORM : TWO_FORMS;
}

function isLanguageTranslated({ key, language }: { key: string; language: string }): boolean {
  const localization = localizationOf({ key, language });
  const plural = pluralOf(localization);
  if (!plural) return isTranslated(localization?.stringUnit);
  const forms = Object.keys(plural).sort();
  return forms.join() === [...formsFor(language)].sort().join() && forms.every((form) => isTranslated(plural[form]?.stringUnit));
}

function isPluralInEnglishOnlyWhenPluralEverywhere(key: string): boolean {
  const isEnglishPlural = pluralOf(localizationOf({ key, language: SOURCE_LANGUAGE })) !== undefined;
  return LANGUAGES.every((language) => (pluralOf(localizationOf({ key, language })) !== undefined) === isEnglishPlural);
}

function keysUsedInSwift(): string[] {
  return SWIFT_PATHSPECS.flatMap(repositoryFiles).flatMap((path) => localizedKeys(readRepositoryFile(path)));
}

describe('the Mac String Catalog', () => {
  test('has English as its source language and at least one key', () => {
    expect(catalog.sourceLanguage).toBe(SOURCE_LANGUAGE);
    expect(entries.length).toBeGreaterThan(0);
  });

  test('has every key in all eight languages with state translated', () => {
    const missing = entries.flatMap(([key]) => LANGUAGES.filter((language) => !isLanguageTranslated({ key, language })).map((language) => `${language}: ${key}`));
    expect(missing).toEqual([]);
  });

  test('is plural in every language or in none', () => {
    expect(entries.map(([key]) => key).filter((key) => !isPluralInEnglishOnlyWhenPluralEverywhere(key))).toEqual([]);
  });

  test('holds every key the Swift sources resolve', () => {
    const catalogShapes = new Set(entries.map(([key]) => catalogKeyShape(key)));
    const absent = keysUsedInSwift().filter((key) => !catalogShapes.has(catalogKeyShape(key)));
    expect(absent).toEqual([]);
  });

  test('holds no key that no Swift source resolves', () => {
    const usedShapes = new Set(keysUsedInSwift().map(catalogKeyShape));
    expect(entries.map(([key]) => key).filter((key) => !usedShapes.has(catalogKeyShape(key)))).toEqual([]);
  });
});
