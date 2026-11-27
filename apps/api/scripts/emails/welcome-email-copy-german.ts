import type { WelcomeEmailCopy } from './welcome-email-copy';
import { EmailSlot } from '../../src/emails/email-slot';

export const WELCOME_EMAIL_COPY_GERMAN: WelcomeEmailCopy = {
  subject: 'Willkommen bei todz',
  preview: 'Dein todz-Konto ist bereit',
  heading: 'Du bist drin. Willkommen bei todz.',
  intro: `Dein todz-Konto für ${EmailSlot.Email} ist bereit. todz ist eine To-do-Liste, die du und deine KI-Agenten gemeinsam nutzen.`,
  start:
    'Verbinde einen Agenten über MCP und bitte ihn, deine erste Aufgabe hinzuzufügen, oder füge selbst eine über die Menüleiste hinzu.',
  signoff: 'Viel Erfolg beim Ausliefern.',
  footer: `Du hast diese E-Mail bekommen, weil sich ${EmailSlot.Email} bei todz angemeldet hat.`,
};
