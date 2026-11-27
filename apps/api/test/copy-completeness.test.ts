import { Language } from '@todz/types';
import { describe, expect, test } from 'vitest';
import { CLOUD_PAGE_COPY_BY_LANGUAGE } from '../src/cloud-page-copy';
import { EMAIL_CODE_COPY_BY_LANGUAGE } from '../src/email-code-copy';
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
import { required } from './required';

type CopyModule = {
  name: string;
  byLanguage: Record<Language, unknown>;
  untranslatable: Record<Language, string[]>;
  samples?: Record<string, unknown>;
};

const OWNER_FIRST_NAME = ['Dhy', 'ego'].join('');
const OWNER_FULL_NAME = `${OWNER_FIRST_NAME} Calota`;
const SAMPLE_NAME = 'Claude Code';
const SAMPLE_HOST = 'example.com';
const SAMPLE_URL = 'https://docs.todz.app/self-host';
const SAMPLE_QUEUE_URL = 'https://todz.app/cloud-queue?token=x';
const BROKEN_TEXT_PATTERNS = ['undefined', '[object Object]', 'NaN', 'null'];
const NO_SAMPLES: Record<string, unknown> = {};

function untranslatableOf({
  everywhere = [],
  perLanguage = {},
}: {
  everywhere?: string[];
  perLanguage?: Partial<Record<Language, string[]>>;
}): Record<Language, string[]> {
  return Object.fromEntries(
    Object.values(Language).map((language) => [
      language,
      [
        ...everywhere,
        ...Object.entries(perLanguage)
          .filter(([own]) => own === language)
          .flatMap(([, paths]) => paths),
      ],
    ]),
  ) as Record<Language, string[]>;
}

// NB ADR 0117: MCP output stays English, so the mock agent replies are the server's real text.
const MCP_OUTPUT_PATHS = ['benefits.day.agent.toolResult', 'terminal.toolResult'];

const OTHER_LANGUAGES = Object.values(Language).filter((language) => language !== Language.English);

const COPY_MODULES: CopyModule[] = [
  {
    name: 'landing',
    byLanguage: LANDING_COPY_BY_LANGUAGE,
    untranslatable: untranslatableOf({
      perLanguage: {
        [Language.German]: ['shell.themeSystem'],
        [Language.French]: ['ways.selfHost.badge'],
      },
      everywhere: [
        'meta.siteName',
        'shell.wordmark',
        'shell.creditPrefix',
        'shell.creditName',
        'shell.footerGithub',
        'ways.cloud.title',
        'ways.selfHost.terminal.command',
        'ways.selfHost.terminal.ready',
        'ways.selfHost.terminal.next',
        'stage.menuCount',
        'signature.name',
        'terminal.shellPrompt',
        'terminal.command',
        ...MCP_OUTPUT_PATHS,
        'terminal.askPrompt',
        'terminal.toolCall',
        'benefits.day.email.time',
        'benefits.day.glance.time',
        'benefits.day.agent.time',
        'benefits.day.agent.toolCall',
        'benefits.day.close.time',
        'benefits.day.extras.siri.label',
      ],
    }),
  },
  {
    name: 'admin',
    byLanguage: ADMIN_COPY_BY_LANGUAGE,
    samples: { 'metrics.chartLabel': { label: 'Owners', days: 30 } },
    untranslatable: untranslatableOf({
      everywhere: ['shell.navLabel', 'signIn.emailPlaceholder', 'usage.mebibyteUnit'],
      perLanguage: {
        [Language.PortugueseBrazil]: ['metrics.labelOf.workspaces_total'],
        [Language.German]: ['metrics.labelOf.workspaces_total'],
        [Language.French]: ['cloudQueue.columns.action', 'usage.columns.action'],
      },
    }),
  },
  {
    name: 'oauth',
    byLanguage: OAUTH_COPY_BY_LANGUAGE,
    samples: {
      'signIn.titleOf': SAMPLE_NAME,
      'consent.titleOf': SAMPLE_NAME,
      'consent.redirectOf': SAMPLE_HOST,
      'consent.loopbackRedirectOf': SAMPLE_HOST,
      'return.titleOf': SAMPLE_NAME,
      'return.actionOf': SAMPLE_NAME,
      'approved.bodyOf': SAMPLE_NAME,
      'link.cloudFullBodyOf': { selfHostUrl: SAMPLE_URL },
    },
    untranslatable: untranslatableOf({ everywhere: ['signIn.emailPlaceholder'] }),
  },
  { name: 'sign-in page', byLanguage: SIGN_IN_PAGE_COPY_BY_LANGUAGE, untranslatable: untranslatableOf({}) },
  { name: 'email code', byLanguage: EMAIL_CODE_COPY_BY_LANGUAGE, untranslatable: untranslatableOf({}) },
  {
    name: 'cloud page',
    byLanguage: CLOUD_PAGE_COPY_BY_LANGUAGE,
    samples: { 'fullMail.textOf': { queueUrl: SAMPLE_QUEUE_URL, selfHostUrl: SAMPLE_URL } },
    untranslatable: untranslatableOf({}),
  },
  { name: 'day-email stop page', byLanguage: DAY_EMAIL_STOP_COPY_BY_LANGUAGE, untranslatable: untranslatableOf({}) },
  {
    name: 'day mail',
    byLanguage: DAY_MAIL_COPY_BY_LANGUAGE,
    samples: { moreTasks: 3 },
    untranslatable: untranslatableOf({ everywhere: ['lineSeparator', 'workspaceSeparator'] }),
  },
  { name: 'sign-in email', byLanguage: SIGN_IN_EMAIL_COPY_BY_LANGUAGE, untranslatable: untranslatableOf({}) },
  { name: 'welcome email', byLanguage: WELCOME_EMAIL_COPY_BY_LANGUAGE, untranslatable: untranslatableOf({}) },
  { name: 'admin sign-in email', byLanguage: ADMIN_SIGN_IN_EMAIL_COPY_BY_LANGUAGE, untranslatable: untranslatableOf({}) },
  { name: 'OAuth sign-in email', byLanguage: OAUTH_SIGN_IN_EMAIL_COPY_BY_LANGUAGE, untranslatable: untranslatableOf({}) },
  { name: 'day email', byLanguage: DAY_EMAIL_COPY_BY_LANGUAGE, untranslatable: untranslatableOf({}) },
  { name: 'empty day email', byLanguage: DAY_EMAIL_EMPTY_COPY_BY_LANGUAGE, untranslatable: untranslatableOf({}) },
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

function sampleValuesOf(sample: unknown): string[] {
  if (isRecord(sample)) return Object.values(sample).map(String);
  return [String(sample)];
}

function textOfFunction({ copy, path, samples }: { copy: unknown; path: string; samples: Record<string, unknown> }): string {
  if (!Object.hasOwn(samples, path)) throw new Error(`${path} is a function with no sample`);
  const sample = samples[path];
  const text = (copy as (input: unknown) => unknown)(sample);
  if (typeof text !== 'string') throw new Error(`${path} returned no text`);
  sampleValuesOf(sample).forEach((value) => expect(text, `${path} carries ${value}`).toContain(value));
  return text;
}

function leavesOf({ value, path, samples }: { value: unknown; path: string; samples: Record<string, unknown> }): Leaf[] {
  if (typeof value === 'string') return [{ path, value }];
  if (typeof value === 'function') return [{ path, value: textOfFunction({ copy: value, path, samples }) }];
  if (!isRecord(value)) throw new Error(`${path} is neither text, a function nor a group`);
  return Object.entries(value).flatMap(([key, child]) => leavesOf({ value: child, path: path === '' ? key : `${path}.${key}`, samples }));
}

function slotsOf(text: string): string[] {
  return Array.from(text.matchAll(/\{\{[a-zA-Z]+\}\}/g), ([slot]) => slot);
}

describe.each(COPY_MODULES)('the $name copy', ({ byLanguage, untranslatable: untranslatableByLanguage, samples = NO_SAMPLES }) => {
  const leavesIn = (language: Language): Leaf[] => leavesOf({ value: byLanguage[language], path: '', samples });
  const english = leavesIn(Language.English);

  test.each(OTHER_LANGUAGES)('%s has the shape of the English copy', (language) => {
    expect(shapeOf(byLanguage[language])).toEqual(shapeOf(byLanguage[Language.English]));
  });

  test.each(Object.values(Language))('%s has no empty text and runs every function', (language) => {
    leavesIn(language).forEach(({ path, value }) => {
      expect(value.trim().length, path).toBeGreaterThan(0);
    });
  });

  test.each(OTHER_LANGUAGES)('%s keeps the owner name whole, never the first name alone', (language) => {
    leavesIn(language).forEach(({ path, value }) => {
      const mentionsOwner = value.includes(OWNER_FIRST_NAME);
      if (!mentionsOwner) return;
      expect(value, path).toContain(OWNER_FULL_NAME);
    });
  });

  test.each(OTHER_LANGUAGES)('%s translates every text that is not untranslatable', (language) => {
    const translated = leavesIn(language);
    const unchanged = translated
      .filter(({ path, value }) => english.some((leaf) => leaf.path === path && leaf.value === value))
      .map(({ path }) => path)
      .filter((path) => !untranslatableByLanguage[language].includes(path));
    expect(unchanged).toEqual([]);
  });

  test.each(OTHER_LANGUAGES)('%s keeps every slot of the English text', (language) => {
    const translated = leavesIn(language);
    english.forEach(({ path, value }) => {
      const leaf = required({ value: translated.find((candidate) => candidate.path === path), description: path });
      expect(slotsOf(leaf.value).sort(), path).toEqual(slotsOf(value).sort());
    });
  });

  test.each(Object.values(Language))('%s has no text with a broken value in it', (language) => {
    leavesIn(language).forEach(({ path, value }) => {
      BROKEN_TEXT_PATTERNS.forEach((broken) => expect(value, path).not.toContain(broken));
    });
  });

  test('every untranslatable path exists in the English copy', () => {
    const englishPaths = english.map(({ path }) => path);
    Object.values(untranslatableByLanguage)
      .flat()
      .forEach((path) => expect(englishPaths, path).toContain(path));
  });
});
