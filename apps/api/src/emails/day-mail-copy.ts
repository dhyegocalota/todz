import { Language } from '@todz/types';
import { DAY_MAIL_COPY_PORTUGUESE_BRAZIL } from './day-mail-copy-portuguese-brazil';
import { DAY_MAIL_COPY_SPANISH } from './day-mail-copy-spanish';
import { DAY_MAIL_COPY_GERMAN } from './day-mail-copy-german';
import { DAY_MAIL_COPY_FRENCH } from './day-mail-copy-french';
import { DAY_MAIL_COPY_JAPANESE } from './day-mail-copy-japanese';
import { DAY_MAIL_COPY_KOREAN } from './day-mail-copy-korean';
import { DAY_MAIL_COPY_CHINESE } from './day-mail-copy-chinese';
import { DAY_MAIL_COPY_ARABIC } from './day-mail-copy-arabic';
import { DAY_MAIL_COPY_HINDI } from './day-mail-copy-hindi';
export const DAY_MAIL_COPY = {
  moreTasks: (count: number): string => `and ${count} more.`,
  overdue: ' · overdue',
  lineSeparator: ' · ',
  workspaceSeparator: ' / ',
};

export type DayMailCopy = typeof DAY_MAIL_COPY;

export const DAY_MAIL_COPY_BY_LANGUAGE: Record<Language, DayMailCopy> = {
  [Language.English]: DAY_MAIL_COPY,
  [Language.PortugueseBrazil]: DAY_MAIL_COPY_PORTUGUESE_BRAZIL,
  [Language.Spanish]: DAY_MAIL_COPY_SPANISH,
  [Language.German]: DAY_MAIL_COPY_GERMAN,
  [Language.French]: DAY_MAIL_COPY_FRENCH,
  [Language.Japanese]: DAY_MAIL_COPY_JAPANESE,
  [Language.Korean]: DAY_MAIL_COPY_KOREAN,
  [Language.Chinese]: DAY_MAIL_COPY_CHINESE,
  [Language.Arabic]: DAY_MAIL_COPY_ARABIC,
  [Language.Hindi]: DAY_MAIL_COPY_HINDI,
};
