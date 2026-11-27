import { Language } from '@todz/types';
import { enumValueOf } from './enum-value';

const LANGUAGE_RANGE_SEPARATOR = ',';
const PARAMETER_SEPARATOR = ';';
const SUBTAG_SEPARATOR = '-';
const QUALITY_PREFIX = 'q=';
const DEFAULT_QUALITY = 1;
const CHINESE_PRIMARY_TAG = 'zh';
const TRADITIONAL_CHINESE_SUBTAGS = ['hant', 'tw', 'hk', 'mo'];

const LANGUAGE_OF_PRIMARY_TAG = new Map<string, Language>([
  ['en', Language.English],
  ['pt', Language.PortugueseBrazil],
  ['es', Language.Spanish],
  ['de', Language.German],
  ['fr', Language.French],
  ['ja', Language.Japanese],
  ['ko', Language.Korean],
  [CHINESE_PRIMARY_TAG, Language.Chinese],
  ['ar', Language.Arabic],
  ['hi', Language.Hindi],
]);

type LanguagePreference = { tag: string; quality: number };

function qualityOf(parameters: string[]): number {
  const parameter = parameters.map((candidate) => candidate.trim()).find((candidate) => candidate.startsWith(QUALITY_PREFIX));
  if (parameter === undefined) return DEFAULT_QUALITY;
  return Number(parameter.slice(QUALITY_PREFIX.length));
}

function preferenceOf(range: string): LanguagePreference {
  const [tag, ...parameters] = range.trim().toLowerCase().split(PARAMETER_SEPARATOR);
  if (tag === undefined) throw new Error('splitting a string always yields a first part');
  return { tag: tag.trim(), quality: qualityOf(parameters) };
}

function languageOfTag(tag: string): Language | null {
  const [primaryTag, ...subtags] = tag.split(SUBTAG_SEPARATOR);
  if (primaryTag === undefined) throw new Error('splitting a string always yields a first part');
  const language = LANGUAGE_OF_PRIMARY_TAG.get(primaryTag);
  if (language === undefined) return null;
  const isTraditionalChinese = primaryTag === CHINESE_PRIMARY_TAG && subtags.some((subtag) => TRADITIONAL_CHINESE_SUBTAGS.includes(subtag));
  if (isTraditionalChinese) return null;
  return language;
}

export function supportedLanguageOfAcceptLanguage({ acceptLanguage }: { acceptLanguage: string | null }): Language | null {
  if (acceptLanguage === null) return null;
  const [firstSupported] = acceptLanguage
    .split(LANGUAGE_RANGE_SEPARATOR)
    .map(preferenceOf)
    .filter(({ quality }) => quality > 0)
    .sort((first, second) => second.quality - first.quality)
    .map(({ tag }) => languageOfTag(tag))
    .filter((language): language is Language => language !== null);
  if (firstSupported === undefined) return null;
  return firstSupported;
}

export function languageOfAcceptLanguage({ acceptLanguage }: { acceptLanguage: string | null }): Language {
  const supportedLanguage = supportedLanguageOfAcceptLanguage({ acceptLanguage });
  if (supportedLanguage === null) return Language.English;
  return supportedLanguage;
}

export function languageOfValue({ value }: { value: string | null }): Language | null {
  if (value === null) return null;
  return enumValueOf({ enumeration: Language, candidate: value });
}
