import { EmailSlot } from '../../src/emails/email-slot';

const SHARED_COPY = {
  replyHint: `Reply from the address you sign in with, in one line, to add it to Today in the Inbox of ${EmailSlot.Workspace}.`,
  footer: `Sent at ${EmailSlot.Time} because Email me my day is on in todz Settings. Turn it off there.`,
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
