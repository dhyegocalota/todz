import { LANGUAGE_PROFILES, Language } from '@todz/types';
import { describe, expect, test } from 'vitest';
import { adminSignInMail } from '../src/emails/admin-sign-in-mail';
import { dayMail } from '../src/emails/day-mail';
import { DAY_MAIL_COPY_BY_LANGUAGE } from '../src/emails/day-mail-copy';
import { oauthSignInMail } from '../src/emails/oauth-sign-in-mail';
import { signInMail } from '../src/emails/sign-in-mail';
import { welcomeMail } from '../src/emails/welcome-mail';
type EmailMessage = ReturnType<typeof signInMail>;

const ADDRESS = 'maria@example.com';
const ORIGIN = 'https://todz.app';
const LINK = `${ORIGIN}/sign-in#token=preview`;
const OPEN_SLOT = '{{';
const STOP_TOKEN = 'ab'.repeat(32);
const LANGUAGES = Object.values(Language);

function htmlTagOf(language: Language): string {
  const { direction, htmlLang } = LANGUAGE_PROFILES[language];
  return `<html dir="${direction}" lang="${htmlLang}">`;
}

const LINK_MAILS: [string, (language: Language) => EmailMessage][] = [
  ['sign-in', (language) => signInMail({ to: ADDRESS, link: LINK, origin: ORIGIN, language })],
  ['admin sign-in', (language) => adminSignInMail({ to: ADDRESS, link: LINK, origin: ORIGIN, language })],
  ['OAuth sign-in', (language) => oauthSignInMail({ to: ADDRESS, link: LINK, origin: ORIGIN, language })],
];

function dayMailOf({ language, count }: { language: Language; count: number }): EmailMessage {
  return dayMail({
    to: ADDRESS,
    replyTo: 'reply+0123456789abcdef0123456789abcdef@todz.app',
    origin: ORIGIN,
    stopToken: STOP_TOKEN,
    tasks: [{ number: 12, title: 'Review the release notes', workspaceName: 'Personal', projectName: 'Inbox', isOverdue: false }],
    count,
    workspaceName: 'Personal',
    hasSeveralWorkspaces: false,
    minutes: 420,
    language,
  });
}

const ALL_MAILS: [string, (language: Language) => EmailMessage][] = [
  ...LINK_MAILS,
  ['welcome', (language) => welcomeMail({ to: ADDRESS, origin: ORIGIN, language })],
  ['day with tasks', (language) => dayMailOf({ language, count: 1 })],
  ['day without tasks', (language) => dayMailOf({ language, count: 0 })],
];

describe.each(ALL_MAILS)('the %s mail', (_name, build) => {
  test.each(LANGUAGES)('declares its language and leaves no slot open in %s', (language) => {
    const message = build(language);
    expect(message.html).toContain(htmlTagOf(language));
    expect(message.html).not.toContain(OPEN_SLOT);
    expect(message.text).not.toContain(OPEN_SLOT);
    expect(message.subject).not.toContain(OPEN_SLOT);
    expect(message.subject.length).toBeGreaterThan(0);
  });
});

describe.each(LINK_MAILS)('the %s mail links', (_name, build) => {
  test.each(LANGUAGES)('its button and its text to the sign-in link in %s', (language) => {
    const message = build(language);
    expect(message.html).toContain(`href="${LINK}"`);
    expect(message.text).toContain(LINK);
    expect(message.html).toContain(`src="${ORIGIN}/brand/todz-lockup.png"`);
  });
});

describe('the welcome mail', () => {
  test.each(LANGUAGES)('is addressed to the owner in %s', (language) => {
    expect(welcomeMail({ to: ADDRESS, origin: ORIGIN, language }).text).toContain(ADDRESS);
  });
});

describe('the day mail', () => {
  test.each(LANGUAGES)('carries the stop link, the task and its own copy in %s', (language) => {
    const message = dayMailOf({ language, count: 1 });
    expect(message.html).toContain(`${ORIGIN}/day-email/stop?token=${STOP_TOKEN}`);
    expect(message.text).toContain('T-12 Review the release notes');
    expect(message.text).toContain(DAY_MAIL_COPY_BY_LANGUAGE[language].lineSeparator);
  });
});
