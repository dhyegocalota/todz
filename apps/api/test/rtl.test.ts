import { LANGUAGE_PROFILES, Language, TextDirection } from '@todz/types';
import { createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { describe, expect, test } from 'vitest';
import type { Env } from '../src/env';
import worker from '../src/index';
import { SITE_STYLE } from '../src/site/site-style';
import { welcomeMail } from '../src/emails/welcome-mail';
import { workerEnvWith } from './owner-client';

const SITE_ORIGIN = 'https://todz.app';
const SETTINGS: Partial<Env> = { PUBLIC_ORIGIN: 'https://api.todz.app', SITE_ORIGIN, SIGN_IN_PROVIDER: 'fake' };
const PHYSICAL_PROPERTIES = ['margin-left', 'margin-right', 'padding-right', 'text-align:right'];
const TERMINAL_RULE_PATTERN = /\.terminal,\.terminal-body\{[^}]*\}/;

type EdgeRequest = Request<unknown, IncomingRequestCfProperties>;

async function pageAt(path: string): Promise<string> {
  const request = new Request(`${SITE_ORIGIN}${path}`, { headers: { 'User-Agent': 'Mozilla/5.0 Safari/605.1.15' } });
  const executionContext = createExecutionContext();
  const response = await worker.fetch(request as EdgeRequest, workerEnvWith(SETTINGS), executionContext);
  await waitOnExecutionContext(executionContext);
  return response.text();
}

describe('right to left', () => {
  test.each(Object.values(Language))('%s declares the direction of its profile on <html>', async (language) => {
    const { pathPrefix, htmlLang, direction } = LANGUAGE_PROFILES[language];
    const html = await pageAt(`${pathPrefix}/`);
    expect(html).toContain(`<html lang="${htmlLang}" dir="${direction}"`);
  });

  test('only Arabic is right to left', () => {
    const rightToLeft = Object.values(Language).filter((language) => LANGUAGE_PROFILES[language].direction === TextDirection.Rtl);
    expect(rightToLeft).toEqual([Language.Arabic]);
  });

  test('the stylesheet uses logical properties for margins, padding, alignment and insets of text', () => {
    PHYSICAL_PROPERTIES.forEach((property) => expect(SITE_STYLE, property).not.toContain(property));
  });

  test('the terminal blocks stay left to right and isolated', () => {
    const [rule] = SITE_STYLE.match(TERMINAL_RULE_PATTERN) ?? [];
    expect(rule).toContain('direction:ltr');
    expect(rule).toContain('unicode-bidi:isolate');
  });

  test('the link arrow and the day rail mirror under dir=rtl', () => {
    expect(SITE_STYLE).toContain('[dir=rtl] .way-link-arrow{display:inline-block;transform:scaleX(-1)}');
    expect(SITE_STYLE).toContain('[dir=rtl] .day-stop:not(:last-child)::before');
  });

  test('the mail of an Arabic reader is right to left on html and body, and left to right in Hindi', () => {
    const arabic = welcomeMail({ to: 'maria@example.com', origin: SITE_ORIGIN, language: Language.Arabic }).html;
    const hindi = welcomeMail({ to: 'maria@example.com', origin: SITE_ORIGIN, language: Language.Hindi }).html;
    expect(arabic).toContain('<html dir="rtl" lang="ar">');
    expect(arabic).toMatch(/<body[^>]*dir="rtl"/);
    expect(hindi).toContain('<html dir="ltr" lang="hi">');
  });
});
