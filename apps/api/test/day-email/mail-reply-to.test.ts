import { Language } from '@todz/types';
import { describe, expect, test } from 'vitest';
import { adminSignInMail } from '../../src/emails/admin-sign-in-mail';
import { signInMail } from '../../src/emails/sign-in-mail';
import { welcomeMail } from '../../src/emails/welcome-mail';

const ADDRESS = 'maria@example.com';
const ORIGIN = 'https://todz.app';
const LINK = `${ORIGIN}/sign-in#token=preview`;
const HELLO_ADDRESS = 'hello@todz.app';

describe.each([
  ['sign-in', () => signInMail({ to: ADDRESS, link: LINK, origin: ORIGIN, language: Language.English })],
  ['welcome', () => welcomeMail({ to: ADDRESS, origin: ORIGIN, language: Language.English })],
  ['admin sign-in', () => adminSignInMail({ to: ADDRESS, link: LINK, origin: ORIGIN, language: Language.English })],
])('the %s mail', (_name, build) => {
  test('replies to hello@todz.app and carries no headers', () => {
    const message = build();
    expect(message.replyTo).toBe(HELLO_ADDRESS);
    expect(message).not.toHaveProperty('headers');
  });
});
