export const SOURCE_LANGUAGE = 'en';
export const TRANSLATED_LANGUAGES = ['pt-BR', 'es', 'de', 'fr', 'ja', 'ko', 'zh', 'ar', 'hi'];
const PLURAL_FORMS: Record<string, string[]> = {
  ja: ['other'],
  ko: ['other'],
  zh: ['other'],
  ar: ['zero', 'one', 'two', 'few', 'many', 'other'],
};
const TWO_FORMS = ['one', 'other'];
const TRANSLATED_STATE = 'translated';

type StringUnit = { stringUnit: { state: string; value: string } };
export type Localization = StringUnit | { variations: { plural: Record<string, StringUnit> } };
export type Catalog = {
  sourceLanguage: string;
  strings: Record<string, { extractionState?: string; localizations: Record<string, Localization> }>;
  version: string;
};
export type Fragment = Record<string, string | Record<string, string>>;

function unit(value: string): StringUnit {
  if (value.trim() === '') throw new Error('A translation is empty');
  return { stringUnit: { state: TRANSLATED_STATE, value } };
}

function isPluralKey({ catalog, key }: { catalog: Catalog; key: string }): boolean {
  return 'variations' in catalog.strings[key]!.localizations[SOURCE_LANGUAGE]!;
}

function localization({
  key,
  value,
  language,
  isPlural,
}: {
  key: string;
  value: string | Record<string, string> | undefined;
  language: string;
  isPlural: boolean;
}): Localization {
  if (value === undefined) throw new Error(`${language} has no value for ${key}`);
  if (!isPlural && typeof value !== 'string') throw new Error(`${language} gives ${key} plural forms but the key has none`);
  if (typeof value === 'string' && isPlural) throw new Error(`${language} gives ${key} one value but the key is plural`);
  if (typeof value === 'string') return unit(value);
  const required = PLURAL_FORMS[language] || TWO_FORMS;
  const given = Object.keys(value).sort();
  if (given.join() !== [...required].sort().join())
    throw new Error(`${language} gives ${key} the forms ${given.join()} instead of ${required.join()}`);
  return { variations: { plural: Object.fromEntries(given.map((form) => [form, unit(value[form]!)])) } };
}

export function mergedCatalog({ catalog, language, fragment }: { catalog: Catalog; language: string; fragment: Fragment }): Catalog {
  const strings = Object.fromEntries(
    Object.entries(catalog.strings).map(([key, entry]) => [
      key,
      {
        ...entry,
        localizations: {
          ...entry.localizations,
          [language]: localization({ key, value: fragment[key], language, isPlural: isPluralKey({ catalog, key }) }),
        },
      },
    ]),
  );
  return { ...catalog, strings };
}
