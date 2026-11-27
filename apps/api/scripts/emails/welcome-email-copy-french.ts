import type { WelcomeEmailCopy } from './welcome-email-copy';
import { EmailSlot } from '../../src/emails/email-slot';

export const WELCOME_EMAIL_COPY_FRENCH: WelcomeEmailCopy = {
  subject: 'Bienvenue dans todz',
  preview: 'Votre compte todz est prêt',
  heading: 'Vous y êtes. Bienvenue dans todz.',
  intro: `Votre compte todz pour ${EmailSlot.Email} est prêt. todz est une liste de tâches que vous partagez avec vos agents IA.`,
  start:
    'Connectez un agent par MCP et demandez-lui d’ajouter votre première tâche, ou ajoutez-en une vous-même depuis la barre des menus.',
  signoff: 'Bonne livraison.',
  footer: `Vous recevez cet e-mail parce que ${EmailSlot.Email} s’est connecté à todz.`,
};
