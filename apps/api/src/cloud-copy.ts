import { DOCS_SELF_HOST_URL } from './site/self-host-redirect';

export const CLOUD_COPY = {
  full: `todz cloud is full right now. Leave your email and you'll get in when a spot opens, or run your own server: ${DOCS_SELF_HOST_URL}`,
  atCapacity: `todz cloud is at capacity this month. Reading still works and writing resumes next month, or run your own server: ${DOCS_SELF_HOST_URL}`,
  queued: "You're on the list. We'll email you when a spot opens.",
  invite: {
    subject: 'A spot opened on todz cloud',
    text: 'A spot opened on todz cloud. Open todz and sign in with this email address to get in.',
  },
  warning: {
    subject: 'todz cloud has used 80% of a monthly quota',
    textOf: (dimension: string): string => `todz cloud has used at least 80% of its included ${dimension} this month.`,
  },
  digest: {
    subject: 'People are waiting for a todz cloud spot',
    textOf: ({ waiting, newest }: { waiting: number; newest: string }): string =>
      `${waiting} waiting for a spot on todz cloud. The newest is ${newest}. Admit them from the admin Cloud queue page.`,
  },
};
