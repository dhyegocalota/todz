import { EmailSlot } from '../../src/emails/email-slot';

const SHARED_COPY = {
  total: `${EmailSlot.Total} on the list in all.`,
  failed: `Failed confirmations: ${EmailSlot.Failed}.`,
  action: 'Open the admin',
  footer: 'The last 24 hours, sent once a day at 11:00 UTC to the admin address.',
};

export const WAITLIST_DIGEST_EMAIL_COPY = {
  ...SHARED_COPY,
  subject: `Your todz waitlist: ${EmailSlot.Joined} new`,
  preview: `${EmailSlot.Joined} new on the todz waitlist in the last day`,
  heading: `${EmailSlot.Joined} new on the waitlist`,
};

export const WAITLIST_DIGEST_EMPTY_EMAIL_COPY = {
  ...SHARED_COPY,
  subject: 'Your todz waitlist: no one new',
  preview: 'No one joined the todz waitlist in the last day',
  heading: 'No one new on the waitlist',
};
