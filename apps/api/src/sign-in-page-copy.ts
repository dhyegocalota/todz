import { Language } from '@todz/types';
import { SIGN_IN_PAGE_COPY_PORTUGUESE_BRAZIL } from './sign-in-page-copy-portuguese-brazil';
import { SIGN_IN_PAGE_COPY_SPANISH } from './sign-in-page-copy-spanish';
import { SIGN_IN_PAGE_COPY_GERMAN } from './sign-in-page-copy-german';
import { SIGN_IN_PAGE_COPY_FRENCH } from './sign-in-page-copy-french';
import { SIGN_IN_PAGE_COPY_JAPANESE } from './sign-in-page-copy-japanese';
import { SIGN_IN_PAGE_COPY_KOREAN } from './sign-in-page-copy-korean';
import { SIGN_IN_PAGE_COPY_CHINESE } from './sign-in-page-copy-chinese';
import { SIGN_IN_PAGE_COPY_ARABIC } from './sign-in-page-copy-arabic';
import { SIGN_IN_PAGE_COPY_HINDI } from './sign-in-page-copy-hindi';
export const SIGN_IN_PAGE_COPY = {
  title: 'Sign in to todz',
  challengeTitle: 'Check this browser',
  checking: 'Checking this browser…',
  checkFailed: "Couldn't check this browser. Reload the page.",
  unavailable: 'Sign-in is unavailable right now. Try again later.',
  opening: 'Opening todz on your Mac…',
  openButton: 'Open todz',
  notOpened: 'Nothing happened? Open this link on the Mac that asked for it, with todz installed.',
  missingToken: 'This link is incomplete. Send a new one from todz.',
};

export type SignInPageCopy = typeof SIGN_IN_PAGE_COPY;

export const SIGN_IN_PAGE_COPY_BY_LANGUAGE: Record<Language, SignInPageCopy> = {
  [Language.English]: SIGN_IN_PAGE_COPY,
  [Language.PortugueseBrazil]: SIGN_IN_PAGE_COPY_PORTUGUESE_BRAZIL,
  [Language.Spanish]: SIGN_IN_PAGE_COPY_SPANISH,
  [Language.German]: SIGN_IN_PAGE_COPY_GERMAN,
  [Language.French]: SIGN_IN_PAGE_COPY_FRENCH,
  [Language.Japanese]: SIGN_IN_PAGE_COPY_JAPANESE,
  [Language.Korean]: SIGN_IN_PAGE_COPY_KOREAN,
  [Language.Chinese]: SIGN_IN_PAGE_COPY_CHINESE,
  [Language.Arabic]: SIGN_IN_PAGE_COPY_ARABIC,
  [Language.Hindi]: SIGN_IN_PAGE_COPY_HINDI,
};
