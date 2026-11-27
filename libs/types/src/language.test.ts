import { describe, expect, test } from 'vitest';
import { LANGUAGE_PROFILES, Language } from './language';

const EXPECTED_CODES = ['en', 'pt-BR', 'es', 'de', 'fr', 'ja', 'ko', 'zh'];

describe('Language', () => {
  test('names the eight codes of the v1.2 decision', () => {
    expect(Object.values(Language)).toEqual(EXPECTED_CODES);
  });

  test('has one profile per language', () => {
    expect(Object.keys(LANGUAGE_PROFILES).sort()).toEqual([...EXPECTED_CODES].sort());
  });

  test.each([
    [Language.English, { nativeName: 'English', pathPrefix: '', htmlLang: 'en', docsFolder: '', openGraphLocale: 'en_US' }],
    [
      Language.PortugueseBrazil,
      { nativeName: 'Português (Brasil)', pathPrefix: '/pt-br', htmlLang: 'pt-BR', docsFolder: 'pt-br', openGraphLocale: 'pt_BR' },
    ],
    [Language.Chinese, { nativeName: '简体中文', pathPrefix: '/zh', htmlLang: 'zh-CN', docsFolder: 'zh', openGraphLocale: 'zh_CN' }],
  ])('%s keeps its profile', (language, profile) => {
    expect(LANGUAGE_PROFILES[language]).toEqual(profile);
  });

  test('gives every language a distinct native name, prefix and Open Graph locale', () => {
    const profiles = Object.values(LANGUAGE_PROFILES);
    expect(new Set(profiles.map(({ nativeName }) => nativeName)).size).toBe(profiles.length);
    expect(new Set(profiles.map(({ pathPrefix }) => pathPrefix)).size).toBe(profiles.length);
    expect(new Set(profiles.map(({ openGraphLocale }) => openGraphLocale)).size).toBe(profiles.length);
  });

  test('prefixes every language but English with a lowercase slash path', () => {
    const prefixes = Object.entries(LANGUAGE_PROFILES)
      .filter(([language]) => language !== Language.English)
      .map(([, { pathPrefix }]) => pathPrefix);
    prefixes.forEach((prefix) => expect(prefix).toMatch(/^\/[a-z-]+$/));
  });
});
