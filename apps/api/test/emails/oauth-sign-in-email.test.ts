import { Language } from '@todz/types';
import { describe, expect, test } from 'vitest';
import { EmailTemplateName, generatedEmailsOf } from '../../scripts/emails/generated-emails';
import { EmailSlot } from '../../src/emails/email-slot';
import type { GeneratedEmail } from '../../src/emails/generated-email';

const SUBJECT = 'Approve an app for todz';
const HEADING = 'Approve an app for todz';
const INTRO = 'An app asked to connect to your todz account. Use the button in the browser where you started to choose what it may reach.';
const ACTION = 'Continue in the browser';
const FOOTER =
  "This link works once, expires soon and opens only in the browser where you asked for it. If you didn't ask, ignore this email: nothing is connected.";
const PREVIEW = 'Your link to approve an app for todz. It works once.';
const APOSTROPHE = "'";
const ESCAPED_APOSTROPHE = '&#x27;';

async function oauthEmail(): Promise<GeneratedEmail> {
  const emails = await generatedEmailsOf();
  return emails[EmailTemplateName.OAuthSignIn][Language.English];
}

function htmlOf(text: string): string {
  return text.replaceAll(APOSTROPHE, ESCAPED_APOSTROPHE);
}

describe('the OAuth sign-in email template', () => {
  test('has its subject', async () => {
    expect((await oauthEmail()).subject).toBe(SUBJECT);
  });

  test.each([HEADING, INTRO, ACTION, FOOTER])('says "%s" in both parts', async (line) => {
    const email = await oauthEmail();
    expect(email.html).toContain(htmlOf(line));
    expect(email.text).toContain(line);
  });

  test('previews in the html only', async () => {
    const email = await oauthEmail();
    expect(email.html).toContain(PREVIEW);
    expect(email.text).not.toContain(PREVIEW);
  });

  test('holds the link slot in its button and its fallback, never the address slot', async () => {
    const email = await oauthEmail();
    expect(email.html).toMatch(new RegExp(`<a [^>]*href="${EmailSlot.Link}"[^>]*class="email-button"`));
    expect(email.text).toContain(EmailSlot.Link);
    expect([email.html, email.text].filter((part) => part.includes(EmailSlot.Email))).toEqual([]);
  });
});
