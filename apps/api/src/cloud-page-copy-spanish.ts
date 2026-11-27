import type { CloudPageCopy } from './cloud-page-copy';
export const CLOUD_PAGE_COPY_SPANISH: CloudPageCopy = {
  fullMail: {
    subject: 'todz cloud is full right now',
    textOf: ({ queueUrl, selfHostUrl }: { queueUrl: string; selfHostUrl: string }): string =>
      `todz cloud is full right now: free todz cloud spots are extremely limited. Confirm your address to get in line, and you'll get in when a spot opens: ${queueUrl}\n\nOr run your own server, which is always open: ${selfHostUrl}`,
  },
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
};
