import { Language } from '@todz/types';
import { SIGN_IN_EMAIL_COPY_PORTUGUESE_BRAZIL } from './sign-in-email-copy-portuguese-brazil';
import { SIGN_IN_EMAIL_COPY_SPANISH } from './sign-in-email-copy-spanish';
import { SIGN_IN_EMAIL_COPY_GERMAN } from './sign-in-email-copy-german';
import { SIGN_IN_EMAIL_COPY_FRENCH } from './sign-in-email-copy-french';
import { SIGN_IN_EMAIL_COPY_JAPANESE } from './sign-in-email-copy-japanese';
import { SIGN_IN_EMAIL_COPY_KOREAN } from './sign-in-email-copy-korean';
import { SIGN_IN_EMAIL_COPY_CHINESE } from './sign-in-email-copy-chinese';
import { SIGN_IN_EMAIL_COPY_ARABIC } from './sign-in-email-copy-arabic';
import { SIGN_IN_EMAIL_COPY_HINDI } from './sign-in-email-copy-hindi';
export const SIGN_IN_EMAIL_COPY = {
  subject: 'Your todz sign-in link',
  preview: 'Your link to sign in to todz',
  heading: 'Sign in to todz',
  intro: 'Tap the button to open todz on the Mac that asked for it. The link works once and expires soon.',
  action: 'Sign in to todz',
  fallback: 'Button not working? Paste this link into your browser:',
  footer: "If you didn't ask for this, ignore this email.",
  codeLabel: 'Or enter this code where you asked for the link. It works once and expires with the link.',
};

export type SignInEmailCopy = typeof SIGN_IN_EMAIL_COPY;

export const SIGN_IN_EMAIL_COPY_BY_LANGUAGE: Record<Language, SignInEmailCopy> = {
  [Language.English]: SIGN_IN_EMAIL_COPY,
  [Language.PortugueseBrazil]: SIGN_IN_EMAIL_COPY_PORTUGUESE_BRAZIL,
  [Language.Spanish]: SIGN_IN_EMAIL_COPY_SPANISH,
  [Language.German]: SIGN_IN_EMAIL_COPY_GERMAN,
  [Language.French]: SIGN_IN_EMAIL_COPY_FRENCH,
  [Language.Japanese]: SIGN_IN_EMAIL_COPY_JAPANESE,
  [Language.Korean]: SIGN_IN_EMAIL_COPY_KOREAN,
  [Language.Chinese]: SIGN_IN_EMAIL_COPY_CHINESE,
  [Language.Arabic]: SIGN_IN_EMAIL_COPY_ARABIC,
  [Language.Hindi]: SIGN_IN_EMAIL_COPY_HINDI,
};
