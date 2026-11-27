import type { AdminSignInEmailCopy } from './admin-sign-in-email-copy';
import { ADMIN_SIGN_IN_LINK_LIFETIME_MINUTES } from '../../src/site/admin-paths';

export const ADMIN_SIGN_IN_EMAIL_COPY_CHINESE: AdminSignInEmailCopy = {
  subject: 'Sign in to the todz admin',
  preview: 'Your link to the todz admin. It works once.',
  heading: 'Sign in to the admin',
  intro: 'Use the button to sign in to the todz admin.',
  action: 'Sign in',
  fallback: 'Opens in the wrong browser? Paste this link into the one where you asked:',
  footer: `This link works once, for ${ADMIN_SIGN_IN_LINK_LIFETIME_MINUTES} minutes, in the browser where you asked for it.`,
};
