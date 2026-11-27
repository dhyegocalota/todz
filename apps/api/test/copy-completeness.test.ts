import { Language } from '@todz/types';
import { describe, expect, test } from 'vitest';
import { CLOUD_PAGE_COPY_BY_LANGUAGE } from '../src/cloud-page-copy';
import { DAY_EMAIL_STOP_COPY_BY_LANGUAGE } from '../src/day-email/day-email-stop-copy';
import { DAY_MAIL_COPY_BY_LANGUAGE } from '../src/emails/day-mail-copy';
import { OAUTH_COPY_BY_LANGUAGE } from '../src/oauth/oauth-copy';
import { SIGN_IN_PAGE_COPY_BY_LANGUAGE } from '../src/sign-in-page-copy';
import { ADMIN_COPY_BY_LANGUAGE } from '../src/site/admin-copy';
import { LANDING_COPY_BY_LANGUAGE } from '../src/site/landing-copy';
import { ADMIN_SIGN_IN_EMAIL_COPY_BY_LANGUAGE } from '../scripts/emails/admin-sign-in-email-copy';
import { DAY_EMAIL_COPY_BY_LANGUAGE, DAY_EMAIL_EMPTY_COPY_BY_LANGUAGE } from '../scripts/emails/day-email-copy';
import { OAUTH_SIGN_IN_EMAIL_COPY_BY_LANGUAGE } from '../scripts/emails/oauth-sign-in-email-copy';
import { SIGN_IN_EMAIL_COPY_BY_LANGUAGE } from '../scripts/emails/sign-in-email-copy';
import { WELCOME_EMAIL_COPY_BY_LANGUAGE } from '../scripts/emails/welcome-email-copy';

type CopyModule = { name: string; byLanguage: Record<Language, unknown>; untranslatable: string[] };

const OWNER_FIRST_NAME = ['Dhy', 'ego'].join('');
const OWNER_FULL_NAME = `${OWNER_FIRST_NAME} Calota`;
const SAMPLE_TEXT = 'Claude Code';
const SAMPLE_URL = 'https://docs.todz.app/self-host';
const SAMPLE_ARGUMENTS: unknown[] = [
  SAMPLE_TEXT,
  { label: 'Owners', days: 30 },
  { queueUrl: 'https://todz.app/cloud-queue?token=x', selfHostUrl: SAMPLE_URL },
  { selfHostUrl: SAMPLE_URL },
  3,
];
const OTHER_LANGUAGES = Object.values(Language).filter((language) => language !== Language.English);

const COPY_MODULES: CopyModule[] = [
  {
    name: 'landing',
    byLanguage: LANDING_COPY_BY_LANGUAGE,
    untranslatable: [
      'meta.siteName',
      'shell.wordmark',
      'shell.creditPrefix',
      'shell.creditName',
      'shell.footerGithub',
      'ways.cloud.title',
      'ways.selfHost.terminal.command',
      'ways.selfHost.terminal.ready',
      'stage.menuCount',
      'signature.name',
      'terminal.shellPrompt',
      'terminal.command',
      'terminal.askPrompt',
      'terminal.toolCall',
      'terminal.toolResult',
      'benefits.day.email.time',
      'benefits.day.glance.time',
      'benefits.day.agent.time',
      'benefits.day.agent.toolCall',
      'benefits.day.agent.toolResult',
      'benefits.day.close.time',
      'benefits.day.extras.siri.label',
    ],
  },
  {
    name: 'admin',
    byLanguage: ADMIN_COPY_BY_LANGUAGE,
    untranslatable: ['shell.navLabel', 'signIn.emailPlaceholder', 'usage.mebibyteUnit'],
  },
  { name: 'oauth', byLanguage: OAUTH_COPY_BY_LANGUAGE, untranslatable: ['signIn.emailPlaceholder'] },
  { name: 'sign-in page', byLanguage: SIGN_IN_PAGE_COPY_BY_LANGUAGE, untranslatable: [] },
  { name: 'cloud page', byLanguage: CLOUD_PAGE_COPY_BY_LANGUAGE, untranslatable: [] },
  { name: 'day-email stop page', byLanguage: DAY_EMAIL_STOP_COPY_BY_LANGUAGE, untranslatable: [] },
  { name: 'day mail', byLanguage: DAY_MAIL_COPY_BY_LANGUAGE, untranslatable: ['lineSeparator', 'workspaceSeparator'] },
  { name: 'sign-in email', byLanguage: SIGN_IN_EMAIL_COPY_BY_LANGUAGE, untranslatable: [] },
  { name: 'welcome email', byLanguage: WELCOME_EMAIL_COPY_BY_LANGUAGE, untranslatable: [] },
  { name: 'admin sign-in email', byLanguage: ADMIN_SIGN_IN_EMAIL_COPY_BY_LANGUAGE, untranslatable: [] },
  { name: 'OAuth sign-in email', byLanguage: OAUTH_SIGN_IN_EMAIL_COPY_BY_LANGUAGE, untranslatable: [] },
  { name: 'day email', byLanguage: DAY_EMAIL_COPY_BY_LANGUAGE, untranslatable: [] },
  { name: 'empty day email', byLanguage: DAY_EMAIL_EMPTY_COPY_BY_LANGUAGE, untranslatable: [] },
];

type Leaf = { path: string; value: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function shapeOf(value: unknown): string[] {
  if (typeof value === 'string') return ['string'];
  if (typeof value === 'function') return ['function'];
  if (!isRecord(value)) return [typeof value];
  return Object.entries(value).flatMap(([key, child]) => shapeOf(child).map((shape) => `${key}.${shape}`));
}

function textOfFunction(copy: unknown): string {
  const attempts = SAMPLE_ARGUMENTS.map((argument) => {
    try {
      return (copy as (input: unknown) => unknown)(argument);
    } catch {
      return null;
    }
  });
  const text = attempts.find((attempt) => typeof attempt === 'string' && attempt.length > 0);
  if (typeof text !== 'string') throw new Error('a copy function returned no text for any sample');
  return text;
}

function leavesOf({ value, path }: { value: unknown; path: string }): Leaf[] {
  if (typeof value === 'string') return [{ path, value }];
  if (typeof value === 'function') return [{ path, value: textOfFunction(value) }];
  if (!isRecord(value)) throw new Error(`${path} is neither text, a function nor a group`);
  return Object.entries(value).flatMap(([key, child]) => leavesOf({ value: child, path: path === '' ? key : `${path}.${key}` }));
}

describe.each(COPY_MODULES)('the $name copy', ({ byLanguage, untranslatable }) => {
  const english = leavesOf({ value: byLanguage[Language.English], path: '' });

  test.each(OTHER_LANGUAGES)('%s has the shape of the English copy', (language) => {
    expect(shapeOf(byLanguage[language])).toEqual(shapeOf(byLanguage[Language.English]));
  });

  test.each(Object.values(Language))('%s has no empty text and runs every function', (language) => {
    leavesOf({ value: byLanguage[language], path: '' }).forEach(({ path, value }) => {
      expect(value.trim().length, path).toBeGreaterThan(0);
    });
  });

  test.each(OTHER_LANGUAGES)('%s keeps the owner name whole, never the first name alone', (language) => {
    leavesOf({ value: byLanguage[language], path: '' }).forEach(({ path, value }) => {
      const mentionsOwner = value.includes(OWNER_FIRST_NAME);
      if (!mentionsOwner) return;
      expect(value, path).toContain(OWNER_FULL_NAME);
    });
  });

  test.each(OTHER_LANGUAGES)('%s translates every text that is not untranslatable', (language) => {
    const translated = leavesOf({ value: byLanguage[language], path: '' });
    const unchanged = translated
      .filter(({ path, value }) => english.some((leaf) => leaf.path === path && leaf.value === value))
      .map(({ path }) => path)
      .filter((path) => !untranslatable.includes(path));
    expect(unchanged).toEqual([]);
  });

  test.each(OTHER_LANGUAGES)('%s keeps every slot of the English text', (language) => {
    const slotsOf = (text: string): string[] => text.match(/\{\{[a-zA-Z]+\}\}/g) ?? [];
    const translated = leavesOf({ value: byLanguage[language], path: '' });
    english.forEach(({ path, value }) => {
      const leaf = translated.find((candidate) => candidate.path === path);
      expect(slotsOf(leaf?.value ?? '').sort(), path).toEqual(slotsOf(value).sort());
    });
  });
});
