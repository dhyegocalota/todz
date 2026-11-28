import { Language } from '@todz/types';
import { EMAIL_CODE_COPY_PORTUGUESE_BRAZIL } from './email-code-copy-portuguese-brazil';
import { EMAIL_CODE_COPY_SPANISH } from './email-code-copy-spanish';
import { EMAIL_CODE_COPY_GERMAN } from './email-code-copy-german';
import { EMAIL_CODE_COPY_FRENCH } from './email-code-copy-french';
import { EMAIL_CODE_COPY_JAPANESE } from './email-code-copy-japanese';
import { EMAIL_CODE_COPY_KOREAN } from './email-code-copy-korean';
import { EMAIL_CODE_COPY_CHINESE } from './email-code-copy-chinese';
import { EMAIL_CODE_COPY_HINDI } from './email-code-copy-hindi';
import { EMAIL_CODE_COPY_ARABIC } from './email-code-copy-arabic';

export const EMAIL_CODE_SECONDS_SLOT = '{seconds}';

export const EMAIL_CODE_COPY = {
  label: 'Sign-in code',
  lead: 'Or enter the 6-digit code from the same email.',
  submit: 'Sign in',
  submitting: 'Signing in…',
  wrong: "That code didn't work. Check it and try again.",
  locked: 'Too many tries. Use the link in the email or ask for a new code.',
  resend: 'Resend code',
  resendWait: `Resend code in ${EMAIL_CODE_SECONDS_SLOT}s`,
  resending: 'Sending…',
};

export type EmailCodeCopy = typeof EMAIL_CODE_COPY;

export const EMAIL_CODE_COPY_BY_LANGUAGE: Record<Language, EmailCodeCopy> = {
  [Language.English]: EMAIL_CODE_COPY,
  [Language.PortugueseBrazil]: EMAIL_CODE_COPY_PORTUGUESE_BRAZIL,
  [Language.Spanish]: EMAIL_CODE_COPY_SPANISH,
  [Language.German]: EMAIL_CODE_COPY_GERMAN,
  [Language.French]: EMAIL_CODE_COPY_FRENCH,
  [Language.Japanese]: EMAIL_CODE_COPY_JAPANESE,
  [Language.Korean]: EMAIL_CODE_COPY_KOREAN,
  [Language.Chinese]: EMAIL_CODE_COPY_CHINESE,
  [Language.Hindi]: EMAIL_CODE_COPY_HINDI,
  [Language.Arabic]: EMAIL_CODE_COPY_ARABIC,
};
