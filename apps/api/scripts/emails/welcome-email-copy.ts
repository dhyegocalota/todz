import { Language } from '@todz/types';
import { WELCOME_EMAIL_COPY_PORTUGUESE_BRAZIL } from './welcome-email-copy-portuguese-brazil';
import { WELCOME_EMAIL_COPY_SPANISH } from './welcome-email-copy-spanish';
import { WELCOME_EMAIL_COPY_GERMAN } from './welcome-email-copy-german';
import { WELCOME_EMAIL_COPY_FRENCH } from './welcome-email-copy-french';
import { WELCOME_EMAIL_COPY_JAPANESE } from './welcome-email-copy-japanese';
import { WELCOME_EMAIL_COPY_KOREAN } from './welcome-email-copy-korean';
import { WELCOME_EMAIL_COPY_CHINESE } from './welcome-email-copy-chinese';
import { EmailSlot } from '../../src/emails/email-slot';

export const WELCOME_EMAIL_COPY = {
  subject: 'Welcome to todz',
  preview: 'Your todz account is ready',
  heading: "You're in. Welcome to todz.",
  intro: `Your todz account for ${EmailSlot.Email} is ready. todz is one to-do list that you and your AI agents share.`,
  start: 'Connect an agent through MCP and ask it to add your first task, or add one yourself from the menu bar.',
  signoff: 'Happy shipping.',
  footer: `You got this email because ${EmailSlot.Email} signed in to todz.`,
};

export type WelcomeEmailCopy = typeof WELCOME_EMAIL_COPY;

export const WELCOME_EMAIL_COPY_BY_LANGUAGE: Record<Language, WelcomeEmailCopy> = {
  [Language.English]: WELCOME_EMAIL_COPY,
  [Language.PortugueseBrazil]: WELCOME_EMAIL_COPY_PORTUGUESE_BRAZIL,
  [Language.Spanish]: WELCOME_EMAIL_COPY_SPANISH,
  [Language.German]: WELCOME_EMAIL_COPY_GERMAN,
  [Language.French]: WELCOME_EMAIL_COPY_FRENCH,
  [Language.Japanese]: WELCOME_EMAIL_COPY_JAPANESE,
  [Language.Korean]: WELCOME_EMAIL_COPY_KOREAN,
  [Language.Chinese]: WELCOME_EMAIL_COPY_CHINESE,
};
