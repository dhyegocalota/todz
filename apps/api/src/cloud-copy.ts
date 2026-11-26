import { DOCS_SELF_HOST_URL } from './site/self-host-redirect';

export const CLOUD_COPY = {
  full: `todz cloud is full right now. Leave your email and you'll get in when a spot opens, or run your own server: ${DOCS_SELF_HOST_URL}`,
  fullMail: {
    subject: 'todz cloud is full right now',
    textOf: ({ queueUrl }: { queueUrl: string }): string =>
      `todz cloud is full right now: free todz cloud spots are extremely limited. Confirm your address to get in line, and you'll get in when a spot opens: ${queueUrl}\n\nOr run your own server, which is always open: ${DOCS_SELF_HOST_URL}`,
  },
  atCapacity: `todz cloud is at capacity this month. Your changes are kept and sync next month, or run your own server: ${DOCS_SELF_HOST_URL}`,
  queued: "You're on the list. We'll email you when a spot opens.",
  queuePage: {
    title: 'Get in line for todz cloud',
    lead: 'Free todz cloud spots are extremely limited. Confirm below and we will write when one opens.',
    joinAs: 'Join the line as',
    invalidTitle: 'This link is no longer valid',
    invalidBody:
      'The link in the mail we sent when todz cloud was full works for a week. Ask for a new sign-in link in the app to get a new one.',
    submit: 'Get in line',
    submitting: 'Sending…',
    queuedTitle: "You're on the list",
    queuedBody: "We'll email you when a spot opens.",
    tryAgain: "Couldn't add you right now. Try again in a minute.",
    closed: 'The line is closed right now.',
    forbidden: "That request didn't come from this site.",
    selfHost: 'Or run your own server, which is always open:',
    selfHostLink: 'self-host guide',
  },
  invite: {
    subject: 'A spot opened on todz cloud',
    text: 'A spot opened on todz cloud. Open todz and sign in with this email address to get in.',
  },
  warning: {
    subject: 'todz cloud has used 80% of a monthly quota',
    textOf: (dimension: string): string => `todz cloud has used at least 80% of its included ${dimension} this month.`,
  },
  fallback: {
    subject: 'The todz cloud budget guard fell back to the estimate',
    textOf: (reason: string): string => `budget guard fell back to the estimate: ${reason}`,
  },
  digest: {
    subject: 'People are waiting for a todz cloud spot',
    textOf: ({ waiting, newest }: { waiting: number; newest: string }): string =>
      `${waiting} waiting for a spot on todz cloud. The newest is ${newest}. Admit them from the admin Cloud queue page.`,
  },
};
