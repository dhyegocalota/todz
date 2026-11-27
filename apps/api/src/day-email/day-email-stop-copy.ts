import { Language } from '@todz/types';
import { DAY_EMAIL_STOP_COPY_PORTUGUESE_BRAZIL } from './day-email-stop-copy-portuguese-brazil';
import { DAY_EMAIL_STOP_COPY_SPANISH } from './day-email-stop-copy-spanish';
import { DAY_EMAIL_STOP_COPY_GERMAN } from './day-email-stop-copy-german';
import { DAY_EMAIL_STOP_COPY_FRENCH } from './day-email-stop-copy-french';
import { DAY_EMAIL_STOP_COPY_JAPANESE } from './day-email-stop-copy-japanese';
import { DAY_EMAIL_STOP_COPY_KOREAN } from './day-email-stop-copy-korean';
import { DAY_EMAIL_STOP_COPY_CHINESE } from './day-email-stop-copy-chinese';
import { DAY_EMAIL_STOP_COPY_ARABIC } from './day-email-stop-copy-arabic';
import { DAY_EMAIL_STOP_COPY_HINDI } from './day-email-stop-copy-hindi';
export const DAY_EMAIL_STOP_COPY = {
  confirm: {
    heading: 'Stop your day email?',
    sentence: 'todz will stop mailing your day to this address.',
    button: 'Stop my day email',
  },
  done: {
    heading: 'Your day email is off',
    sentence: 'Turn it back on in todz Settings.',
  },
  gone: {
    heading: 'This link no longer works',
    sentence: 'Your day email is set in todz Settings.',
  },
  limited: {
    heading: 'Try again in a minute',
    sentence: 'Too many tries from here.',
  },
};

export type DayEmailStopCopy = typeof DAY_EMAIL_STOP_COPY;

export const DAY_EMAIL_STOP_COPY_BY_LANGUAGE: Record<Language, DayEmailStopCopy> = {
  [Language.English]: DAY_EMAIL_STOP_COPY,
  [Language.PortugueseBrazil]: DAY_EMAIL_STOP_COPY_PORTUGUESE_BRAZIL,
  [Language.Spanish]: DAY_EMAIL_STOP_COPY_SPANISH,
  [Language.German]: DAY_EMAIL_STOP_COPY_GERMAN,
  [Language.French]: DAY_EMAIL_STOP_COPY_FRENCH,
  [Language.Japanese]: DAY_EMAIL_STOP_COPY_JAPANESE,
  [Language.Korean]: DAY_EMAIL_STOP_COPY_KOREAN,
  [Language.Chinese]: DAY_EMAIL_STOP_COPY_CHINESE,
  [Language.Arabic]: DAY_EMAIL_STOP_COPY_ARABIC,
  [Language.Hindi]: DAY_EMAIL_STOP_COPY_HINDI,
};
