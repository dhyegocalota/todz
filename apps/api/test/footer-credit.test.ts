import { required } from './required';
import { Language } from '@todz/types';
import { describe, expect, test } from 'vitest';
import { serveLandingPage } from '../src/site/landing-page';
import { Theme } from '../src/page-preferences';

const FOOTER_CREDIT_PATTERN = /<p class="footer-credit">([\s\S]*?)<\/p>/;
const TAG_PATTERN = /<[^>]*>/g;
const CJK = '[\\u3040-\\u30ff\\u3400-\\u9fff\\uf900-\\ufaff\\uac00-\\ud7af]';
const SPACE_BETWEEN_CJK = new RegExp(`${CJK}\\s+${CJK}`);
const CJK_LANGUAGES = [Language.Japanese, Language.Korean, Language.Chinese];
const RENDERED_CREDIT: Partial<Record<Language, string>> = {
  [Language.Japanese]: '© todz · todzは Logic Bitの製品です。ブラジルで開発しています。',
  [Language.Korean]: '© todz · todz는 Logic Bit의 제품이에요. 브라질에서 만들었어요.',
  [Language.Chinese]: '© todz · todz 是 Logic Bit 的产品，诞生于巴西',
};

async function creditTextOf(language: Language): Promise<string> {
  const html = await serveLandingPage({ stars: null, preferences: { language, theme: Theme.System, returnPath: '/' } }).text();
  const credit = required({ value: html.match(FOOTER_CREDIT_PATTERN)?.[1], description: 'the footer credit' });
  return credit.replace(TAG_PATTERN, '');
}

describe('the footer credit', () => {
  test.each(CJK_LANGUAGES)('%s renders the credit text', async (language) => {
    expect(await creditTextOf(language)).toBe(RENDERED_CREDIT[language]);
  });

  test.each([Language.Japanese, Language.Chinese])('%s never puts a space between two CJK characters', async (language) => {
    expect(await creditTextOf(language)).not.toMatch(SPACE_BETWEEN_CJK);
  });

  test.each(Object.values(Language))('%s links Logic Bit to the company website', async (language) => {
    const html = await serveLandingPage({ stars: null, preferences: { language, theme: Theme.System, returnPath: '/' } }).text();
    expect(html).toMatch(/<a class="footer-credit-link" href="https:\/\/logicbit\.com\.br"[^>]*>Logic Bit<\/a>/);
  });
});
