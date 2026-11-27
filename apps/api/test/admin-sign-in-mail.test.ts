import { Language } from '@todz/types';
import { describe, expect, test } from 'vitest';
import { adminSignInMail } from '../src/emails/admin-sign-in-mail';

const SUBJECT = 'Sign in to the todz admin';
const ADMIN_ADDRESS = 'admin@todz.test';
const ORIGIN = 'https://todz.app';
const LINK = 'https://todz.app/admin/sign-in#token=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
const AMPERSAND_LINK = 'https://todz.app/admin/sign-in?a=1&b="2"#token=x';
const AMPERSAND_LINK_ESCAPED = 'https://todz.app/admin/sign-in?a=1&amp;b=&quot;2&quot;#token=x';
const OPEN_SLOT = '{{';

describe('the admin sign-in mail', () => {
  test('goes to the address with the template subject', () => {
    const message = adminSignInMail({ to: ADMIN_ADDRESS, link: LINK, origin: ORIGIN, language: Language.English });
    expect(message.to).toBe(ADMIN_ADDRESS);
    expect(message.subject).toBe(SUBJECT);
  });

  test('carries the link in the button, in the fallback and in the text, and the lockup from the origin', () => {
    const message = adminSignInMail({ to: ADMIN_ADDRESS, link: LINK, origin: ORIGIN, language: Language.English });
    expect(message.html).toContain(`href="${LINK}"`);
    expect(message.html.split(LINK).length).toBeGreaterThanOrEqual(4);
    expect(message.text).toContain(LINK);
    expect(message.html).toContain(`src="${ORIGIN}/brand/todz-lockup.png"`);
  });

  test('leaves no slot unfilled in either part', () => {
    const message = adminSignInMail({ to: ADMIN_ADDRESS, link: LINK, origin: ORIGIN, language: Language.English });
    expect([message.html, message.text].filter((part) => part.includes(OPEN_SLOT))).toEqual([]);
  });

  test('escapes a link written into the html and keeps it as it is in the text', () => {
    const message = adminSignInMail({ to: ADMIN_ADDRESS, link: AMPERSAND_LINK, origin: ORIGIN, language: Language.English });
    expect(message.html).toContain(`href="${AMPERSAND_LINK_ESCAPED}"`);
    expect(message.html).not.toContain(AMPERSAND_LINK);
    expect(message.text).toContain(AMPERSAND_LINK);
  });
});
