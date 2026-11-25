import { describe, expect, test } from 'vitest';
import { EmailTemplateName, generatedEmailsOf } from '../../scripts/emails/generated-emails';
import { EmailSlot } from '../../src/emails/email-slot';
import type { GeneratedEmail } from '../../src/emails/generated-email';

const COLOR_SCHEME_META = '<meta name="color-scheme" content="light dark"';
const LOCKUP_URL = `${EmailSlot.Origin}/brand/todz-lockup.png`;
const IMAGE_TAG_PATTERN = /<img[^>]*>/;
const SUBJECT = 'Sign in to the todz admin';
const HEADING = 'Sign in to the admin';
const INTRO = 'Use the button to sign in to the todz admin.';
const ACTION = 'Sign in';
const FALLBACK = 'Opens in the wrong browser? Paste this link into the one where you asked:';
const FOOTER = 'This link works once, for 15 minutes, in the browser where you asked for it.';
const PREVIEW = 'Your link to the todz admin. It works once.';
const APOSTROPHE = "'";
const ESCAPED_APOSTROPHE = '&#x27;';

async function adminEmail(): Promise<GeneratedEmail> {
  const emails = await generatedEmailsOf();
  return emails[EmailTemplateName.AdminSignIn];
}

function htmlOf(text: string): string {
  return text.replaceAll(APOSTROPHE, ESCAPED_APOSTROPHE);
}

function imageTagOf(html: string): string {
  const imageTag = html.match(IMAGE_TAG_PATTERN)?.[0];
  if (!imageTag) throw new Error('the mail has no image');
  return imageTag;
}

describe('the admin sign-in email template', () => {
  test('has its subject', async () => {
    expect((await adminEmail()).subject).toBe(SUBJECT);
  });

  test.each([HEADING, INTRO, ACTION, FALLBACK, FOOTER])('says "%s" in both parts', async (line) => {
    const email = await adminEmail();
    expect(email.html).toContain(htmlOf(line));
    expect(email.text).toContain(line);
  });

  test('previews its link in the html only', async () => {
    const email = await adminEmail();
    expect(email.html).toContain(PREVIEW);
    expect(email.text).not.toContain(PREVIEW);
  });

  test('holds the link slot in the href of its button and in its visible fallback, never the address slot', async () => {
    const email = await adminEmail();
    expect(email.html).toMatch(
      new RegExp(`<a [^>]*href="${EmailSlot.Link}"[^>]*class="email-button"|<a [^>]*class="email-button"[^>]*href="${EmailSlot.Link}"`),
    );
    expect(email.html.split(EmailSlot.Link).length).toBeGreaterThanOrEqual(4);
    expect(email.text).toContain(EmailSlot.Link);
    expect([email.html, email.text].filter((part) => part.includes(EmailSlot.Email))).toEqual([]);
  });

  test('shows the lockup from the origin slot, only in its image', async () => {
    const email = await adminEmail();
    const imageTag = imageTagOf(email.html);
    expect(imageTag).toContain(`src="${LOCKUP_URL}"`);
    expect(imageTag).toContain('alt="todz"');
    expect(email.html.replace(imageTag, '')).not.toContain(LOCKUP_URL);
  });

  test('gives its button the class that the dark mode block styles, and declares light and dark', async () => {
    const email = await adminEmail();
    expect(email.html).toMatch(/@media \(prefers-color-scheme: dark\)[\s\S]*\.email-button \{[^}]*color: #FFFFFF !important/);
    expect(email.html).toMatch(/<a [^>]*class="email-button"/);
    expect(email.html).toContain(COLOR_SCHEME_META);
  });
});
