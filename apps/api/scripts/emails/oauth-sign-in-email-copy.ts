import { Language } from '@todz/types';
import { OAUTH_SIGN_IN_EMAIL_COPY_PORTUGUESE_BRAZIL } from './oauth-sign-in-email-copy-portuguese-brazil';
import { OAUTH_SIGN_IN_EMAIL_COPY_SPANISH } from './oauth-sign-in-email-copy-spanish';
import { OAUTH_SIGN_IN_EMAIL_COPY_GERMAN } from './oauth-sign-in-email-copy-german';
import { OAUTH_SIGN_IN_EMAIL_COPY_FRENCH } from './oauth-sign-in-email-copy-french';
import { OAUTH_SIGN_IN_EMAIL_COPY_JAPANESE } from './oauth-sign-in-email-copy-japanese';
import { OAUTH_SIGN_IN_EMAIL_COPY_KOREAN } from './oauth-sign-in-email-copy-korean';
import { OAUTH_SIGN_IN_EMAIL_COPY_CHINESE } from './oauth-sign-in-email-copy-chinese';
import { OAUTH_SIGN_IN_EMAIL_COPY_ARABIC } from './oauth-sign-in-email-copy-arabic';
import { OAUTH_SIGN_IN_EMAIL_COPY_HINDI } from './oauth-sign-in-email-copy-hindi';
export const OAUTH_SIGN_IN_EMAIL_COPY = {
  subject: 'Approve an app for todz',
  preview: 'Your link to approve an app for todz. It works once.',
  heading: 'Approve an app for todz',
  intro: 'An app asked to connect to your todz account. Use the button in the browser where you started to choose what it may reach.',
  action: 'Continue in the browser',
  fallback: 'Opens in the wrong browser? Paste this link into the one where you asked:',
  footer:
    "This link works once, expires soon and opens only in the browser where you asked for it. If you didn't ask, ignore this email: nothing is connected.",
  codeLabel: 'Or enter this code where you asked for the link. It works once and expires with the link.',
};

export type OAuthSignInEmailCopy = typeof OAUTH_SIGN_IN_EMAIL_COPY;

export const OAUTH_SIGN_IN_EMAIL_COPY_BY_LANGUAGE: Record<Language, OAuthSignInEmailCopy> = {
  [Language.English]: OAUTH_SIGN_IN_EMAIL_COPY,
  [Language.PortugueseBrazil]: OAUTH_SIGN_IN_EMAIL_COPY_PORTUGUESE_BRAZIL,
  [Language.Spanish]: OAUTH_SIGN_IN_EMAIL_COPY_SPANISH,
  [Language.German]: OAUTH_SIGN_IN_EMAIL_COPY_GERMAN,
  [Language.French]: OAUTH_SIGN_IN_EMAIL_COPY_FRENCH,
  [Language.Japanese]: OAUTH_SIGN_IN_EMAIL_COPY_JAPANESE,
  [Language.Korean]: OAUTH_SIGN_IN_EMAIL_COPY_KOREAN,
  [Language.Chinese]: OAUTH_SIGN_IN_EMAIL_COPY_CHINESE,
  [Language.Arabic]: OAUTH_SIGN_IN_EMAIL_COPY_ARABIC,
  [Language.Hindi]: OAUTH_SIGN_IN_EMAIL_COPY_HINDI,
};
