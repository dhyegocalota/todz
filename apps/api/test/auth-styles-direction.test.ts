import { describe, expect, test } from 'vitest';
import { EMAIL_CODE_STYLE } from '../src/site/email-code-style';
import { SITE_STYLE } from '../src/site/site-style';

const PHYSICAL_SIDE_PATTERN = /(?:^|[{;\s-])(?:left|right)\s*:|-(?:left|right)\s*:/;
const AUTH_RULE_PATTERN = /^\.(?:consent-|code-)[^{]*\{[^}]*\}$/;

function authRulesOf(style: string): string[] {
  return style
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => AUTH_RULE_PATTERN.test(line));
}

describe('the consent tree and the code input mirror in a right-to-left language', () => {
  test('there are consent and code rules to check', () => {
    expect(authRulesOf(SITE_STYLE).length).toBeGreaterThan(0);
    expect(authRulesOf(EMAIL_CODE_STYLE).length).toBeGreaterThan(0);
  });

  test.each([
    ['the site style', SITE_STYLE],
    ['the code input style', EMAIL_CODE_STYLE],
  ])('%s names no physical left or right side in a consent or code rule', (_name, style) => {
    expect(authRulesOf(style).filter((rule) => PHYSICAL_SIDE_PATTERN.test(rule))).toEqual([]);
  });
});
