import { describe, expect, test } from 'vitest';
import { type Catalog, mergedCatalog } from './mac-strings-merge';

function english(value: string) {
  return { stringUnit: { state: 'translated', value } };
}

const CATALOG: Catalog = {
  sourceLanguage: 'en',
  version: '1.0',
  strings: {
    Today: { extractionState: 'manual', localizations: { en: english('Today') } },
    '%lld left': {
      extractionState: 'manual',
      localizations: { en: { variations: { plural: { one: english('%lld left'), other: english('%lld left') } } } },
    },
  },
};

describe('mergedCatalog', () => {
  test('adds a language to every key, plural forms included', () => {
    const merged = mergedCatalog({
      catalog: CATALOG,
      language: 'pt-BR',
      fragment: { Today: 'Hoje', '%lld left': { one: '%lld restante', other: '%lld restantes' } },
    });
    expect(merged.strings.Today!.localizations['pt-BR']).toEqual(english('Hoje'));
    expect(merged.strings['%lld left']!.localizations['pt-BR']).toEqual({
      variations: { plural: { one: english('%lld restante'), other: english('%lld restantes') } },
    });
    expect(merged.strings.Today!.localizations.en).toEqual(english('Today'));
  });

  test('a language with one plural form takes only other', () => {
    const merged = mergedCatalog({ catalog: CATALOG, language: 'ja', fragment: { Today: '今日', '%lld left': { other: '残り%lld件' } } });
    expect(merged.strings['%lld left']!.localizations.ja).toEqual({ variations: { plural: { other: english('残り%lld件') } } });
  });

  test('refuses a missing key', () => {
    expect(() => mergedCatalog({ catalog: CATALOG, language: 'es', fragment: { Today: 'Hoy' } })).toThrow('es has no value for %lld left');
  });

  test('refuses an empty value', () => {
    expect(() =>
      mergedCatalog({ catalog: CATALOG, language: 'es', fragment: { Today: ' ', '%lld left': { one: 'a', other: 'b' } } }),
    ).toThrow('A translation is empty');
  });

  test('leaves out a key the catalog no longer has, so a removed key may stay in a fragment', () => {
    const merged = mergedCatalog({
      catalog: CATALOG,
      language: 'es',
      fragment: { Today: 'Hoy', Extra: 'x', '%lld left': { one: 'a', other: 'b' } },
    });
    expect(Object.keys(merged.strings)).toEqual(['Today', '%lld left']);
  });

  test('refuses the wrong plural forms', () => {
    expect(() => mergedCatalog({ catalog: CATALOG, language: 'de', fragment: { Today: 'Heute', '%lld left': { other: 'x' } } })).toThrow(
      'instead of one,other',
    );
    expect(() =>
      mergedCatalog({ catalog: CATALOG, language: 'ko', fragment: { Today: '오늘', '%lld left': { one: 'x', other: 'y' } } }),
    ).toThrow('instead of other');
  });

  test('Arabic takes its six plural forms and Hindi takes one and other', () => {
    const arabic = { zero: 'a', one: 'b', two: 'c', few: 'd', many: 'e', other: 'f' };
    const merged = mergedCatalog({ catalog: CATALOG, language: 'ar', fragment: { Today: 'اليوم', '%lld left': arabic } });
    expect(Object.keys(merged.strings['%lld left']!.localizations.ar!.variations!.plural).sort()).toEqual(Object.keys(arabic).sort());
    expect(() =>
      mergedCatalog({ catalog: CATALOG, language: 'ar', fragment: { Today: 'اليوم', '%lld left': { one: 'x', other: 'y' } } }),
    ).toThrow('instead of');
    const hindi = mergedCatalog({ catalog: CATALOG, language: 'hi', fragment: { Today: 'आज', '%lld left': { one: 'x', other: 'y' } } });
    expect(hindi.strings.Today!.localizations.hi).toEqual(english('आज'));
  });
});
