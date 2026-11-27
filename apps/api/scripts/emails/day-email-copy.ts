import { Language } from '@todz/types';
import { DAY_EMAIL_COPY_PORTUGUESE_BRAZIL, DAY_EMAIL_EMPTY_COPY_PORTUGUESE_BRAZIL } from './day-email-copy-portuguese-brazil';
import { DAY_EMAIL_COPY_SPANISH, DAY_EMAIL_EMPTY_COPY_SPANISH } from './day-email-copy-spanish';
import { DAY_EMAIL_COPY_GERMAN, DAY_EMAIL_EMPTY_COPY_GERMAN } from './day-email-copy-german';
import { DAY_EMAIL_COPY_FRENCH, DAY_EMAIL_EMPTY_COPY_FRENCH } from './day-email-copy-french';
import { DAY_EMAIL_COPY_JAPANESE, DAY_EMAIL_EMPTY_COPY_JAPANESE } from './day-email-copy-japanese';
import { DAY_EMAIL_COPY_KOREAN, DAY_EMAIL_EMPTY_COPY_KOREAN } from './day-email-copy-korean';
import { DAY_EMAIL_COPY_CHINESE, DAY_EMAIL_EMPTY_COPY_CHINESE } from './day-email-copy-chinese';
import { DAY_EMAIL_COPY_ARABIC, DAY_EMAIL_EMPTY_COPY_ARABIC } from './day-email-copy-arabic';
import { DAY_EMAIL_COPY_HINDI, DAY_EMAIL_EMPTY_COPY_HINDI } from './day-email-copy-hindi';
import { EmailSlot } from '../../src/emails/email-slot';

const SHARED_COPY = {
  replyHint: `Reply from the address you sign in with, in one line, to add it to Today in the Inbox of ${EmailSlot.Workspace}.`,
  footer: `Sent at ${EmailSlot.Time} because Email me my day is on in todz Settings, where it starts on.`,
  stopLabel: 'Stop these emails',
};

export const DAY_EMAIL_COPY = {
  ...SHARED_COPY,
  subject: `Your day: ${EmailSlot.Count} due`,
  preview: `${EmailSlot.Count} due today in todz. Reply to add a task.`,
  heading: `${EmailSlot.Count} due today`,
};

export const DAY_EMAIL_EMPTY_COPY = {
  ...SHARED_COPY,
  subject: 'Your day: nothing due',
  preview: 'Nothing due today in todz. Reply to add a task.',
  heading: 'Nothing due today',
};

export type DayEmailCopy = typeof DAY_EMAIL_COPY;

export const DAY_EMAIL_COPY_BY_LANGUAGE: Record<Language, DayEmailCopy> = {
  [Language.English]: DAY_EMAIL_COPY,
  [Language.PortugueseBrazil]: DAY_EMAIL_COPY_PORTUGUESE_BRAZIL,
  [Language.Spanish]: DAY_EMAIL_COPY_SPANISH,
  [Language.German]: DAY_EMAIL_COPY_GERMAN,
  [Language.French]: DAY_EMAIL_COPY_FRENCH,
  [Language.Japanese]: DAY_EMAIL_COPY_JAPANESE,
  [Language.Korean]: DAY_EMAIL_COPY_KOREAN,
  [Language.Chinese]: DAY_EMAIL_COPY_CHINESE,
  [Language.Arabic]: DAY_EMAIL_COPY_ARABIC,
  [Language.Hindi]: DAY_EMAIL_COPY_HINDI,
};

export type DayEmailEmptyCopy = typeof DAY_EMAIL_EMPTY_COPY;

export const DAY_EMAIL_EMPTY_COPY_BY_LANGUAGE: Record<Language, DayEmailEmptyCopy> = {
  [Language.English]: DAY_EMAIL_EMPTY_COPY,
  [Language.PortugueseBrazil]: DAY_EMAIL_EMPTY_COPY_PORTUGUESE_BRAZIL,
  [Language.Spanish]: DAY_EMAIL_EMPTY_COPY_SPANISH,
  [Language.German]: DAY_EMAIL_EMPTY_COPY_GERMAN,
  [Language.French]: DAY_EMAIL_EMPTY_COPY_FRENCH,
  [Language.Japanese]: DAY_EMAIL_EMPTY_COPY_JAPANESE,
  [Language.Korean]: DAY_EMAIL_EMPTY_COPY_KOREAN,
  [Language.Chinese]: DAY_EMAIL_EMPTY_COPY_CHINESE,
  [Language.Arabic]: DAY_EMAIL_EMPTY_COPY_ARABIC,
  [Language.Hindi]: DAY_EMAIL_EMPTY_COPY_HINDI,
};
