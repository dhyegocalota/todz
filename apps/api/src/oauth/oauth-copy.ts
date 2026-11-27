import { CLOUD_COPY } from '../cloud-copy';

export const OAUTH_COPY = {
  meta: {
    description: 'Connect an app to your todz account.',
    signInTitle: 'Connect an app · todz',
    inboxTitle: 'Check your inbox · todz',
    consentTitle: 'Approve an app · todz',
    refusedTitle: "Can't connect · todz",
    linkTitle: 'Signing in · todz',
  },
  signIn: {
    titleOf: (clientName: string) => `Sign in to connect ${clientName}`,
    lead: 'Enter the address of your todz account. A link is mailed to you, and it opens in this browser.',
    emailLabel: 'Email address',
    emailPlaceholder: 'you@example.com',
    submit: 'Email me a link',
    submitting: 'Sending…',
    invalidAddress: 'Enter a valid email address.',
    tooMany: "Couldn't send a link right now. Try again in a minute.",
    unavailable: 'Signing in to connect apps is not available on this server.',
  },
  inbox: {
    title: 'Check your inbox',
    body: 'If that address can sign in, a link is on its way. It works once, in this browser, and brings you back here.',
  },
  consent: {
    titleOf: (clientName: string) => `Connect ${clientName} to todz?`,
    redirectOf: (host: string) => `After you answer, todz sends you back to ${host}.`,
    loopbackRedirectOf: (host: string) => `After you answer, todz sends you back to ${host}, an app on this computer.`,
    legend: 'What may it reach?',
    projectHint: "A project lets it read and change that project's tasks, and move them to the other projects of its workspace.",
    ownerLabel: 'Your whole account (owner scope)',
    ownerWarning: 'It can create, rename and delete every workspace and project.',
    noProjects: 'You have no projects yet. Create one in the todz app, then come back.',
    approve: 'Approve',
    deny: 'Deny',
  },
  refusal: {
    invalidTitle: "This link can't be used to connect an app",
    invalidBody:
      'Start again from the app you are connecting. If it keeps landing here, clear its saved sign-in first (in Claude Code: /mcp, then Clear authentication).',
    choiceTitle: "That choice isn't available",
    choiceBody: 'Start again from the app you are connecting and pick one of the choices shown.',
    forbiddenTitle: 'Request refused',
    forbiddenBody: "That request didn't come from this page. Start again from the app you are connecting.",
  },
  link: {
    working: 'Signing you in…',
    failedTitle: "This link can't be used.",
    failedBody: 'Ask for a new one from this browser.',
    failedAction: 'Get a new link',
    cloudFullTitle: 'todz cloud is full right now',
    cloudFullBody: CLOUD_COPY.full,
    noScriptTitle: 'Finish signing in',
    noScript: 'This page needs JavaScript to finish signing you in. Turn it on, then open the link again.',
  },
};
