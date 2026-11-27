import { Language } from '@todz/types';
import { describe, expect, test } from 'vitest';
import { EmailSlot } from '../../src/emails/email-slot';
import { SIGN_IN_EMAIL as SIGN_IN_EMAILS, WELCOME_EMAIL as WELCOME_EMAILS } from '../../src/emails/generated/email-templates';

const SIGN_IN_EMAIL = SIGN_IN_EMAILS[Language.English];
const WELCOME_EMAIL = WELCOME_EMAILS[Language.English];

const COLOR_SCHEME_META = '<meta name="color-scheme" content="light dark"';
const LOCKUP_URL = `${EmailSlot.Origin}/brand/todz-lockup.png`;
const IGNORE_NOTICE = "If you didn't ask for this, ignore this email.";
const SIGN_IN_SUBJECT = 'Your todz sign-in link';
const WELCOME_SUBJECT = 'Welcome to todz';
const WELCOME_HEADING = "You're in. Welcome to todz.";
const WELCOME_HEADING_ESCAPED = 'You&#x27;re in. Welcome to todz.';
const IMAGE_TAG_PATTERN = /<img[^>]*>/;
const APOSTROPHE = "'";
const ESCAPED_APOSTROPHE = '&#x27;';

function htmlOf(text: string): string {
  return text.replaceAll(APOSTROPHE, ESCAPED_APOSTROPHE);
}

function imageTagOf(html: string): string {
  const imageTag = html.match(IMAGE_TAG_PATTERN)?.[0];
  if (!imageTag) throw new Error('the mail has no image');
  return imageTag;
}

describe('the sign-in email', () => {
  test('has its subject', () => {
    expect(SIGN_IN_EMAIL.subject).toBe(SIGN_IN_SUBJECT);
  });

  test('holds the link slot in the href of its button', () => {
    expect(SIGN_IN_EMAIL.html).toContain(`href="${EmailSlot.Link}"`);
  });

  test('shows the lockup from the origin slot with its alt and size', () => {
    const imageTag = imageTagOf(SIGN_IN_EMAIL.html);
    expect(imageTag).toContain(`src="${LOCKUP_URL}"`);
    expect(imageTag).toContain('alt="todz"');
    expect(imageTag).toMatch(/width="\d+"/);
    expect(imageTag).toMatch(/height="\d+"/);
  });

  test('gives its button the class that the dark mode block styles', () => {
    expect(SIGN_IN_EMAIL.html).toMatch(/@media \(prefers-color-scheme: dark\)[\s\S]*\.email-button \{[^}]*color: #FFFFFF !important/);
    expect(SIGN_IN_EMAIL.html).toMatch(/<a [^>]*class="email-button"/);
  });

  test('holds the link and the ignore notice in its text', () => {
    expect(SIGN_IN_EMAIL.text).toContain(EmailSlot.Link);
    expect(SIGN_IN_EMAIL.text).toContain(IGNORE_NOTICE);
  });

  test('declares light and dark', () => {
    expect(SIGN_IN_EMAIL.html).toContain(COLOR_SCHEME_META);
  });
});

describe('the welcome email', () => {
  test('has its subject and its heading', () => {
    expect(WELCOME_EMAIL.subject).toBe(WELCOME_SUBJECT);
    expect(WELCOME_EMAIL.html).toContain(WELCOME_HEADING_ESCAPED);
    expect(WELCOME_EMAIL.text).toContain(WELCOME_HEADING);
  });

  test('carries the email slot in both parts', () => {
    expect(WELCOME_EMAIL.html).toContain(EmailSlot.Email);
    expect(WELCOME_EMAIL.text).toContain(EmailSlot.Email);
  });

  test('shows the lockup from the origin slot', () => {
    expect(imageTagOf(WELCOME_EMAIL.html)).toContain(`src="${LOCKUP_URL}"`);
  });

  test('declares light and dark', () => {
    expect(WELCOME_EMAIL.html).toContain(COLOR_SCHEME_META);
  });
});

describe('the lockup', () => {
  test.each([
    ['sign-in', SIGN_IN_EMAIL],
    ['welcome', WELCOME_EMAIL],
  ])('is named only by the image of the %s email, never by a link or a preload', (_name, email) => {
    expect(email.html.replace(imageTagOf(email.html), '')).not.toContain(LOCKUP_URL);
  });
});
