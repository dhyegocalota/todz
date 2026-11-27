import { describe, expect, test } from 'vitest';
import { catalogKeys, inconsistentlyPlural, readCatalog, SOURCE_LANGUAGE, untranslated } from './mac-catalog';
import { readRepositoryFile, repositoryFiles } from './repository-files';
import { catalogKeyShape, localizedKeys, shortcutPhrases } from './swift-localized-keys';

const CATALOG_FILES = ['apps/macos/Copy/Localizable.xcstrings', 'apps/macos/Todz/Shortcuts/AppShortcuts.xcstrings'];
const COPY_CATALOG_FILE = CATALOG_FILES[0]!;
const PHRASES_CATALOG_FILE = CATALOG_FILES[1]!;
const SHORTCUTS_FILE = 'apps/macos/Todz/Shortcuts/TodzShortcuts.swift';
const SWIFT_PATHSPECS = ['apps/macos/Copy/*.swift', 'apps/macos/Todz/*.swift', 'apps/macos/TodzWidgets/*.swift'];

function keysUsedInSwift(): string[] {
  return SWIFT_PATHSPECS.flatMap(repositoryFiles).flatMap((path) => localizedKeys(readRepositoryFile(path)));
}

describe.each(CATALOG_FILES)('the Mac String Catalog %s', (file) => {
  const catalog = readCatalog(file);

  test('has English as its source language and at least one key', () => {
    expect(catalog.sourceLanguage).toBe(SOURCE_LANGUAGE);
    expect(catalogKeys(catalog).length).toBeGreaterThan(0);
  });

  test('has every key in all eight languages with state translated', () => {
    expect(untranslated(catalog)).toEqual([]);
  });

  test('is plural in every language or in none', () => {
    expect(inconsistentlyPlural(catalog)).toEqual([]);
  });
});

describe('the copy catalog', () => {
  const keys = catalogKeys(readCatalog(COPY_CATALOG_FILE));

  test('holds every key the Swift sources resolve', () => {
    const catalogShapes = new Set(keys.map(catalogKeyShape));
    expect(keysUsedInSwift().filter((key) => !catalogShapes.has(catalogKeyShape(key)))).toEqual([]);
  });

  test('holds no key that no Swift source resolves', () => {
    const usedShapes = new Set(keysUsedInSwift().map(catalogKeyShape));
    expect(keys.filter((key) => !usedShapes.has(catalogKeyShape(key)))).toEqual([]);
  });
});

describe('the shortcut phrases catalog', () => {
  test('holds exactly the phrases the shortcuts provider declares', () => {
    const declared = shortcutPhrases(readRepositoryFile(SHORTCUTS_FILE)).sort();
    expect(catalogKeys(readCatalog(PHRASES_CATALOG_FILE)).sort()).toEqual(declared);
    expect(declared.length).toBeGreaterThan(0);
  });

  test('keeps the application name in every phrase of every language', () => {
    const catalog = readCatalog(PHRASES_CATALOG_FILE);
    const phrases = Object.values(catalog.strings).flatMap((entry) => Object.values(entry.localizations!));
    expect(phrases.filter((phrase) => !phrase.stringUnit?.value.includes('${applicationName}'))).toEqual([]);
  });
});
