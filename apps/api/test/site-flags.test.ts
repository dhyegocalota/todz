import { Language } from '@todz/types';
import { describe, expect, test } from 'vitest';
import { flagHtml } from '../src/site/site-flags';
import { languageMenuHtml } from '../src/site/site-controls';
import { Theme } from '../src/page-preferences';

const FLAG_NAME: Record<Language, string> = {
  [Language.English]: 'us',
  [Language.PortugueseBrazil]: 'br',
  [Language.Spanish]: 'es',
  [Language.German]: 'de',
  [Language.French]: 'fr',
  [Language.Japanese]: 'jp',
  [Language.Korean]: 'kr',
  [Language.Chinese]: 'cn',
  [Language.Arabic]: 'arab',
  [Language.Hindi]: 'in',
};
const FLAG_PATTERN = /<svg class="flag" data-flag="([a-z]+)"/g;

describe('the flags of the language menu', () => {
  test.each(Object.values(Language))('%s has an inline flag with no external reference', (language) => {
    const flag = flagHtml(language);
    expect(flag).toContain(`data-flag="${FLAG_NAME[language]}"`);
    expect(flag).toContain('aria-hidden="true"');
    expect(flag).not.toMatch(/href=|src=|url\(|xlink/);
  });

  test.each(Object.values(Language))('the menu of %s draws its flag on the trigger and one per option', (language) => {
    const html = languageMenuHtml({ language, theme: Theme.System, returnPath: '/' });
    const flags = [...html.matchAll(FLAG_PATTERN)].map(([, name]) => name);
    expect(flags).toHaveLength(Object.values(Language).length + 1);
    expect(flags[0]).toBe(FLAG_NAME[language]);
    expect(flags.slice(1)).toEqual(Object.values(Language).map((option) => FLAG_NAME[option]));
  });
});
