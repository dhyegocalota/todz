import { describe, expect, test } from 'vitest';
import { waitlistDigestMail } from '../src/emails/waitlist-digest-mail';
import type { WaitlistDigestFacts } from '../src/site/admin-store';

const ADMIN_ADDRESS = 'admin@todz.test';
const ORIGIN = 'https://todz.app';
const OPEN_SLOT = '{{';
const ESCAPING_ADDRESS = "o'brien&co@example.com";
const ESCAPED_ESCAPING_ADDRESS = 'o&#39;brien&amp;co@example.com';
const FACTS: WaitlistDigestFacts = {
  joined: 3,
  total: 42,
  failedConfirmations: 1,
  addresses: ['third@example.com', 'second@example.com', 'first@example.com'],
  moreAddresses: 0,
};
const EMPTY_FACTS: WaitlistDigestFacts = { joined: 0, total: 42, failedConfirmations: 0, addresses: [], moreAddresses: 0 };

function mailOf(facts: WaitlistDigestFacts): ReturnType<typeof waitlistDigestMail> {
  return waitlistDigestMail({ to: ADMIN_ADDRESS, facts, origin: ORIGIN });
}

describe('the waitlist digest mail', () => {
  test('goes to the address with a subject that counts the joins', () => {
    const message = mailOf(FACTS);
    expect(message.to).toBe(ADMIN_ADDRESS);
    expect(message.subject).toBe('Your todz waitlist: 3 new');
  });

  test('says no one new in its subject on an empty day', () => {
    expect(mailOf(EMPTY_FACTS).subject).toBe('Your todz waitlist: no one new');
  });

  test('carries the joins, the total, the failures and each address newest first in both parts', () => {
    const message = mailOf(FACTS);
    expect(message.text).toContain('3 new on the waitlist');
    expect(message.text).toContain('42 on the list in all.');
    expect(message.text).toContain('Failed confirmations: 1.');
    expect(message.text).toContain('third@example.com\nsecond@example.com\nfirst@example.com');
    expect(message.html).toContain('third@example.com\nsecond@example.com\nfirst@example.com');
  });

  test('on an empty day it carries the total and the failures and no address', () => {
    const message = mailOf(EMPTY_FACTS);
    expect(message.text).toContain('No one new on the waitlist');
    expect(message.text).toContain('42 on the list in all.');
    expect(message.text).toContain('Failed confirmations: 0.');
  });

  test('escapes each address written into the html and keeps it as it is in the text', () => {
    const message = mailOf({ ...FACTS, joined: 1, addresses: [ESCAPING_ADDRESS] });
    expect(message.html).toContain(ESCAPED_ESCAPING_ADDRESS);
    expect(message.html).not.toContain(ESCAPING_ADDRESS);
    expect(message.text).toContain(ESCAPING_ADDRESS);
  });

  test('says and N more only when addresses are left out', () => {
    const left = mailOf({ ...FACTS, moreAddresses: 3 });
    expect(left.text).toContain('and 3 more.');
    expect(left.html).toContain('and 3 more.');
    expect(mailOf(FACTS).text).not.toContain('more.');
  });

  test('opens the admin from its button and loads the lockup from the origin', () => {
    const message = mailOf(FACTS);
    expect(message.html).toContain(`href="${ORIGIN}/admin"`);
    expect(message.html).toContain(`src="${ORIGIN}/brand/todz-lockup.png"`);
  });

  test.each([FACTS, EMPTY_FACTS])('leaves no slot unfilled in either part', (facts) => {
    const message = mailOf(facts);
    expect([message.html, message.text].filter((part) => part.includes(OPEN_SLOT))).toEqual([]);
  });
});
