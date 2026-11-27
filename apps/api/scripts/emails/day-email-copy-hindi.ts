import type { DayEmailCopy, DayEmailEmptyCopy } from './day-email-copy';
import { EmailSlot } from '../../src/emails/email-slot';

const SHARED_COPY = {
  replyHint: `Reply from the address you sign in with, in one line, to add it to Today in the Inbox of ${EmailSlot.Workspace}.`,
  footer: `Sent at ${EmailSlot.Time} because Email me my day is on in todz Settings, where it starts on.`,
  stopLabel: 'Stop these emails',
};

export const DAY_EMAIL_COPY_HINDI: DayEmailCopy = {
  ...SHARED_COPY,
  subject: `Your day: ${EmailSlot.Count} due`,
  preview: `${EmailSlot.Count} due today in todz. Reply to add a task.`,
  heading: `${EmailSlot.Count} due today`,
};

export const DAY_EMAIL_EMPTY_COPY_HINDI: DayEmailEmptyCopy = {
  ...SHARED_COPY,
  subject: 'Your day: nothing due',
  preview: 'Nothing due today in todz. Reply to add a task.',
  heading: 'Nothing due today',
};
