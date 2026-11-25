import { describe, expect, test } from 'vitest';
import { adminSignInMail } from '../../src/emails/admin-sign-in-mail';
import { signInMail } from '../../src/emails/sign-in-mail';
import { waitlistDigestMail } from '../../src/emails/waitlist-digest-mail';
import { waitlistMail } from '../../src/emails/waitlist-mail';
import { welcomeMail } from '../../src/emails/welcome-mail';

const ADDRESS = 'maria@example.com';
const ORIGIN = 'https://todz.app';
const LINK = `${ORIGIN}/sign-in#token=preview`;
const HELLO_ADDRESS = 'hello@todz.app';
const DIGEST_FACTS = { joined: 0, total: 1, failedConfirmations: 0, addresses: [], moreAddresses: 0 };

describe.each([
  ['sign-in', () => signInMail({ to: ADDRESS, link: LINK, origin: ORIGIN })],
  ['welcome', () => welcomeMail({ to: ADDRESS, origin: ORIGIN })],
  ['waitlist', () => waitlistMail({ to: ADDRESS, origin: ORIGIN })],
  ['admin sign-in', () => adminSignInMail({ to: ADDRESS, link: LINK, origin: ORIGIN })],
  ['waitlist digest', () => waitlistDigestMail({ to: ADDRESS, facts: DIGEST_FACTS, origin: ORIGIN })],
])('the %s mail', (_name, build) => {
  test('replies to hello@todz.app and carries no headers', () => {
    const message = build();
    expect(message.replyTo).toBe(HELLO_ADDRESS);
    expect(message).not.toHaveProperty('headers');
  });
});
