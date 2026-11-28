import { Language } from '@todz/types';
import { ADMIN_SIGN_IN_EMAIL_COPY_PORTUGUESE_BRAZIL } from './admin-sign-in-email-copy-portuguese-brazil';
import { ADMIN_SIGN_IN_EMAIL_COPY_SPANISH } from './admin-sign-in-email-copy-spanish';
import { ADMIN_SIGN_IN_EMAIL_COPY_GERMAN } from './admin-sign-in-email-copy-german';
import { ADMIN_SIGN_IN_EMAIL_COPY_FRENCH } from './admin-sign-in-email-copy-french';
import { ADMIN_SIGN_IN_EMAIL_COPY_JAPANESE } from './admin-sign-in-email-copy-japanese';
import { ADMIN_SIGN_IN_EMAIL_COPY_KOREAN } from './admin-sign-in-email-copy-korean';
import { ADMIN_SIGN_IN_EMAIL_COPY_CHINESE } from './admin-sign-in-email-copy-chinese';
import { ADMIN_SIGN_IN_EMAIL_COPY_ARABIC } from './admin-sign-in-email-copy-arabic';
import { ADMIN_SIGN_IN_EMAIL_COPY_HINDI } from './admin-sign-in-email-copy-hindi';
import { ADMIN_SIGN_IN_LINK_LIFETIME_MINUTES } from '../../src/site/admin-paths';

export const ADMIN_SIGN_IN_EMAIL_COPY = {
  subject: 'Sign in to the todz admin',
  preview: 'Your link to the todz admin. It works once.',
  heading: 'Sign in to the admin',
  intro: 'Use the button to sign in to the todz admin.',
  action: 'Sign in',
  fallback: 'Opens in the wrong browser? Paste this link into the one where you asked:',
  footer: `This link works once, for ${ADMIN_SIGN_IN_LINK_LIFETIME_MINUTES} minutes, in the browser where you asked for it.`,
  codeLabel: 'Or enter this code where you asked for the link. It works once and expires with the link.',
};

export type AdminSignInEmailCopy = typeof ADMIN_SIGN_IN_EMAIL_COPY;

export const ADMIN_SIGN_IN_EMAIL_COPY_BY_LANGUAGE: Record<Language, AdminSignInEmailCopy> = {
  [Language.English]: ADMIN_SIGN_IN_EMAIL_COPY,
  [Language.PortugueseBrazil]: ADMIN_SIGN_IN_EMAIL_COPY_PORTUGUESE_BRAZIL,
  [Language.Spanish]: ADMIN_SIGN_IN_EMAIL_COPY_SPANISH,
  [Language.German]: ADMIN_SIGN_IN_EMAIL_COPY_GERMAN,
  [Language.French]: ADMIN_SIGN_IN_EMAIL_COPY_FRENCH,
  [Language.Japanese]: ADMIN_SIGN_IN_EMAIL_COPY_JAPANESE,
  [Language.Korean]: ADMIN_SIGN_IN_EMAIL_COPY_KOREAN,
  [Language.Chinese]: ADMIN_SIGN_IN_EMAIL_COPY_CHINESE,
  [Language.Arabic]: ADMIN_SIGN_IN_EMAIL_COPY_ARABIC,
  [Language.Hindi]: ADMIN_SIGN_IN_EMAIL_COPY_HINDI,
};
