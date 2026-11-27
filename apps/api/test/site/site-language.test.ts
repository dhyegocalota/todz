import { Language } from '@todz/types';
import { describe, expect, test } from 'vitest';
import { languageOfAcceptLanguage, languageOfValue } from '../../src/language-negotiation';
import { isCrawlerRequest } from '../../src/site/crawler';
import { PUBLIC_PAGE_PATHS, pageOfPathname, publicPathOf } from '../../src/site/language-paths';

const CRAWLER_USER_AGENTS = [
  'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
  'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; bingbot/2.0)',
  'Mozilla/5.0 AppleWebKit/537.36 (compatible; GPTBot/1.1; +https://openai.com/gptbot)',
  'Mozilla/5.0 AppleWebKit/537.36 (compatible; ClaudeBot/1.0; +claudebot@anthropic.com)',
  'Mozilla/5.0 (compatible; PerplexityBot/1.0)',
  'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
  'Mozilla/5.0 (compatible; Yahoo! Slurp; http://help.yahoo.com/help/us/ysearch/slurp)',
  'Mozilla/5.0 (compatible; SomeSpider/2.0)',
  'Mozilla/5.0 (compatible; SiteCrawl/3.1)',
];
const BROWSER_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15';

describe('languageOfAcceptLanguage', () => {
  test.each([
    ['pt-BR,pt;q=0.9,en;q=0.8', Language.PortugueseBrazil],
    ['pt', Language.PortugueseBrazil],
    ['es-MX,es;q=0.9', Language.Spanish],
    ['de-AT', Language.German],
    ['fr-CA, fr;q=0.8', Language.French],
    ['ja,en;q=0.5', Language.Japanese],
    ['ko-KR', Language.Korean],
    ['zh-CN', Language.Chinese],
    ['zh', Language.Chinese],
    ['zh-Hans-CN', Language.Chinese],
    ['en-US,en;q=0.9', Language.English],
  ])('%s negotiates %s', (acceptLanguage, language) => {
    expect(languageOfAcceptLanguage({ acceptLanguage })).toBe(language);
  });

  test('honours the q-values, highest first', () => {
    expect(languageOfAcceptLanguage({ acceptLanguage: 'en;q=0.5, ja;q=0.9' })).toBe(Language.Japanese);
    expect(languageOfAcceptLanguage({ acceptLanguage: 'de;q=0.2, fr;q=0.7, es;q=0.4' })).toBe(Language.French);
  });

  test('takes the first of equal q-values', () => {
    expect(languageOfAcceptLanguage({ acceptLanguage: 'ko, ja' })).toBe(Language.Korean);
  });

  test('refuses a language with q=0', () => {
    expect(languageOfAcceptLanguage({ acceptLanguage: 'de;q=0, fr;q=0.5' })).toBe(Language.French);
    expect(languageOfAcceptLanguage({ acceptLanguage: 'ja;q=0' })).toBe(Language.English);
    expect(languageOfAcceptLanguage({ acceptLanguage: 'ja;q=0.0, en' })).toBe(Language.English);
  });

  test.each(['zh-TW', 'zh-Hant', 'zh-Hant-TW', 'zh-HK', 'zh-MO', 'ZH-tw'])('never takes %s for Simplified Chinese', (acceptLanguage) => {
    expect(languageOfAcceptLanguage({ acceptLanguage })).toBe(Language.English);
  });

  test('skips Traditional Chinese for the next acceptable language', () => {
    expect(languageOfAcceptLanguage({ acceptLanguage: 'zh-TW, ko;q=0.5' })).toBe(Language.Korean);
  });

  test.each([null, '', 'it', 'it-IT,ru;q=0.5', '*', 'q=0.5', ';;;', 'ja;q=abc'])('negotiates English for %j', (acceptLanguage) => {
    expect(languageOfAcceptLanguage({ acceptLanguage })).toBe(Language.English);
  });
});

describe('languageOfValue', () => {
  test.each(Object.values(Language))('knows %s', (value) => {
    expect(languageOfValue({ value })).toBe(value);
  });

  test.each([null, '', 'pt-br', 'PT-BR', 'xx', 'en-US', '__proto__', 'constructor'])('does not know %j', (value) => {
    expect(languageOfValue({ value })).toBeNull();
  });
});

describe('language paths', () => {
  test('lists the landing and the cloud queue page as public pages', () => {
    expect(PUBLIC_PAGE_PATHS).toEqual(['/', '/cloud-queue']);
  });

  test.each([
    [Language.English, '/', '/'],
    [Language.English, '/cloud-queue', '/cloud-queue'],
    [Language.PortugueseBrazil, '/', '/pt-br/'],
    [Language.PortugueseBrazil, '/cloud-queue', '/pt-br/cloud-queue'],
    [Language.Japanese, '/', '/ja/'],
    [Language.Chinese, '/cloud-queue', '/zh/cloud-queue'],
  ])('%s puts %s at %s', (language, path, expected) => {
    expect(publicPathOf({ language, path })).toBe(expected);
  });

  test.each([
    ['/', Language.English, '/'],
    ['/cloud-queue', Language.English, '/cloud-queue'],
    ['/pt-br/', Language.PortugueseBrazil, '/'],
    ['/pt-br/cloud-queue', Language.PortugueseBrazil, '/cloud-queue'],
    ['/es/', Language.Spanish, '/'],
    ['/de/cloud-queue', Language.German, '/cloud-queue'],
    ['/fr/', Language.French, '/'],
    ['/ja/', Language.Japanese, '/'],
    ['/ko/cloud-queue', Language.Korean, '/cloud-queue'],
    ['/zh/', Language.Chinese, '/'],
  ])('reads %s as %s page %s', (pathname, language, path) => {
    expect(pageOfPathname({ pathname: pathname })).toEqual({ language, path });
  });

  test.each(['/pt-br', '/PT-BR/', '/xx/', '/pt-br/other', '/pt-br/cloud-queue/', '/ja//', '/admin', '/en/', '/download'])(
    'reads %s as no public page',
    (pathname) => {
      expect(pageOfPathname({ pathname })).toBeNull();
    },
  );
});

describe('isCrawlerRequest', () => {
  test.each(CRAWLER_USER_AGENTS)('knows %s', (userAgent) => {
    expect(isCrawlerRequest({ request: new Request('https://todz.app/', { headers: { 'User-Agent': userAgent } }) })).toBe(true);
  });

  test('does not take a browser for a crawler', () => {
    expect(isCrawlerRequest({ request: new Request('https://todz.app/', { headers: { 'User-Agent': BROWSER_USER_AGENT } }) })).toBe(false);
  });

  test('does not take a request with no user agent for a crawler', () => {
    expect(isCrawlerRequest({ request: new Request('https://todz.app/') })).toBe(false);
  });
});
