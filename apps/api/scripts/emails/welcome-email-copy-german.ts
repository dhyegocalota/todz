import type { WelcomeEmailCopy } from './welcome-email-copy';
import { EmailSlot } from '../../src/emails/email-slot';

export const WELCOME_EMAIL_COPY_GERMAN: WelcomeEmailCopy = {
  subject: 'Welcome to todz',
  preview: 'Your todz account is ready',
  heading: "You're in. Welcome to todz.",
  intro: `Your todz account for ${EmailSlot.Email} is ready. todz is one to-do list that you and your AI agents share.`,
  start: 'Connect an agent through MCP and ask it to add your first task, or add one yourself from the menu bar.',
  signoff: 'Happy shipping.',
  footer: `You got this email because ${EmailSlot.Email} signed in to todz.`,
};
