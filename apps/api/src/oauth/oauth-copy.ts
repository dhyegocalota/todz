import { Language } from '@todz/types';
import { OAUTH_COPY_PORTUGUESE_BRAZIL } from './oauth-copy-portuguese-brazil';
import { OAUTH_COPY_SPANISH } from './oauth-copy-spanish';
import { OAUTH_COPY_GERMAN } from './oauth-copy-german';
import { OAUTH_COPY_FRENCH } from './oauth-copy-french';
import { OAUTH_COPY_JAPANESE } from './oauth-copy-japanese';
import { OAUTH_COPY_KOREAN } from './oauth-copy-korean';
import { OAUTH_COPY_CHINESE } from './oauth-copy-chinese';
import { OAUTH_COPY_ARABIC } from './oauth-copy-arabic';
import { OAUTH_COPY_HINDI } from './oauth-copy-hindi';
export const OAUTH_COPY = {
  meta: {
    description: 'Connect an app to your todz account.',
    signInTitle: 'Connect an app · todz',
    inboxTitle: 'Check your inbox · todz',
    consentTitle: 'Approve an app · todz',
    refusedTitle: "Can't connect · todz",
    linkTitle: 'Signing in · todz',
    returnTitle: 'Returning to the app · todz',
    approvedTitle: 'Already approved · todz',
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
    ownerLabel: 'Your whole account (owner scope)',
    ownerWarning: 'It can read and change every task, and create, rename and delete every workspace and project.',
    noProjects: 'You have no projects yet. Create one in the todz app, then come back.',
    approve: 'Approve',
    approving: 'Approving…',
    deny: 'Deny',
    selectionHint:
      'Tick whole workspaces or only some of their projects. It reads and changes their tasks, and moves tasks between the projects of one workspace.',
    selectAll: 'Select all workspaces',
    workspaceIncludes: 'Includes all of its projects, now and later',
    showProjects: 'Show projects',
    hideProjects: 'Hide projects',
    summaryNone: 'Nothing selected yet',
    summaryWorkspaceOne: '{{count}} workspace',
    summaryWorkspaceMany: '{{count}} workspaces',
    summaryProjectOne: '{{count}} project',
    summaryProjectMany: '{{count}} projects',
    summaryBoth: '{{workspaces}} and {{projects}}',
    accountName: 'Your whole account',
    holdsOf: ({ clientName, held }: { clientName: string; held: string }) => `${clientName} already has: ${held}`,
  },
  return: {
    titleOf: (clientName: string) => `Returning you to ${clientName}`,
    body: "If it doesn't open by itself, use the link.",
    actionOf: (clientName: string) => `Return to ${clientName}`,
  },
  approved: {
    title: 'Already approved',
    bodyOf: (clientName: string) =>
      `This request was approved already. Return to ${clientName} to finish connecting. If it still asks, start again from ${clientName}.`,
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
    cloudFullBodyOf: ({ selfHostUrl }: { selfHostUrl: string }) =>
      `todz cloud is full right now. Leave your email and you'll get in when a spot opens, or run your own server: ${selfHostUrl}`,
    noScriptTitle: 'Finish signing in',
    noScript: 'This page needs JavaScript to finish signing you in. Turn it on, then open the link again.',
  },
};

export type OAuthCopy = typeof OAUTH_COPY;

export const OAUTH_COPY_BY_LANGUAGE: Record<Language, OAuthCopy> = {
  [Language.English]: OAUTH_COPY,
  [Language.PortugueseBrazil]: OAUTH_COPY_PORTUGUESE_BRAZIL,
  [Language.Spanish]: OAUTH_COPY_SPANISH,
  [Language.German]: OAUTH_COPY_GERMAN,
  [Language.French]: OAUTH_COPY_FRENCH,
  [Language.Japanese]: OAUTH_COPY_JAPANESE,
  [Language.Korean]: OAUTH_COPY_KOREAN,
  [Language.Chinese]: OAUTH_COPY_CHINESE,
  [Language.Arabic]: OAUTH_COPY_ARABIC,
  [Language.Hindi]: OAUTH_COPY_HINDI,
};
