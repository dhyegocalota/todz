import { describe, expect, test } from 'vitest';
import { EmailTemplateName, generatedEmailsOf } from '../../scripts/emails/generated-emails';
import { EmailSlot } from '../../src/emails/email-slot';
import type { GeneratedEmail } from '../../src/emails/generated-email';

const COLOR_SCHEME_META = '<meta name="color-scheme" content="light dark"';
const LOCKUP_URL = `${EmailSlot.Origin}/brand/todz-lockup.png`;
const IMAGE_TAG_PATTERN = /<img[^>]*>/;
const DIGEST_SUBJECT = `Your todz waitlist: ${EmailSlot.Joined} new`;
const EMPTY_SUBJECT = 'Your todz waitlist: no one new';
const DIGEST_HEADING = `${EmailSlot.Joined} new on the waitlist`;
const EMPTY_HEADING = 'No one new on the waitlist';
const SHARED_LINES = [`${EmailSlot.Total} on the list in all.`, `Failed confirmations: ${EmailSlot.Failed}.`, 'Open the admin'];
const ADDRESSES_STYLE = 'white-space:pre-line';
const APOSTROPHE = "'";
const ESCAPED_APOSTROPHE = '&#x27;';

async function emailOf(name: EmailTemplateName): Promise<GeneratedEmail> {
  const emails = await generatedEmailsOf();
  return emails[name];
}

function htmlOf(text: string): string {
  return text.replaceAll(APOSTROPHE, ESCAPED_APOSTROPHE);
}

function imageTagOf(html: string): string {
  const imageTag = html.match(IMAGE_TAG_PATTERN)?.[0];
  if (!imageTag) throw new Error('the mail has no image');
  return imageTag;
}

describe('the waitlist digest email template', () => {
  test('has its subject and its heading in both parts', async () => {
    const email = await emailOf(EmailTemplateName.WaitlistDigest);
    expect(email.subject).toBe(DIGEST_SUBJECT);
    expect(email.html).toContain(DIGEST_HEADING);
    expect(email.text).toContain(DIGEST_HEADING);
  });

  test.each(SHARED_LINES)('says "%s" in both parts', async (line) => {
    const email = await emailOf(EmailTemplateName.WaitlistDigest);
    expect(email.html).toContain(htmlOf(line));
    expect(email.text).toContain(line);
  });

  test('holds the addresses and the more slots, the addresses kept line by line', async () => {
    const email = await emailOf(EmailTemplateName.WaitlistDigest);
    expect(email.html).toContain(EmailSlot.Addresses);
    expect(email.html).toContain(EmailSlot.More);
    expect(email.html).toContain(ADDRESSES_STYLE);
    expect(email.text).toContain(EmailSlot.Addresses);
    expect(email.text).toContain(EmailSlot.More);
  });

  test('holds the link slot in the href of its button, and the lockup from the origin slot', async () => {
    const email = await emailOf(EmailTemplateName.WaitlistDigest);
    expect(email.html).toMatch(/<a [^>]*href="\{\{link\}\}"[^>]*class="email-button"|<a [^>]*class="email-button"[^>]*href="\{\{link\}\}"/);
    const imageTag = imageTagOf(email.html);
    expect(imageTag).toContain(`src="${LOCKUP_URL}"`);
    expect(email.html.replace(imageTag, '')).not.toContain(LOCKUP_URL);
    expect(email.html).toContain(COLOR_SCHEME_META);
  });
});

describe('the empty waitlist digest email template', () => {
  test('has its subject and its heading in both parts', async () => {
    const email = await emailOf(EmailTemplateName.WaitlistDigestEmpty);
    expect(email.subject).toBe(EMPTY_SUBJECT);
    expect(email.html).toContain(EMPTY_HEADING);
    expect(email.text).toContain(EMPTY_HEADING);
  });

  test.each(SHARED_LINES)('says "%s" in both parts', async (line) => {
    const email = await emailOf(EmailTemplateName.WaitlistDigestEmpty);
    expect(email.html).toContain(htmlOf(line));
    expect(email.text).toContain(line);
  });

  test('holds no slot for joins, addresses or more', async () => {
    const email = await emailOf(EmailTemplateName.WaitlistDigestEmpty);
    const joinSlots = [EmailSlot.Joined, EmailSlot.Addresses, EmailSlot.More];
    const holders = [email.html, email.text].filter((part) => joinSlots.some((slot) => part.includes(slot)));
    expect(holders).toEqual([]);
  });
});
