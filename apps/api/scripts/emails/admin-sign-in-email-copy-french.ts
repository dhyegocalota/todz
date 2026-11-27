import type { AdminSignInEmailCopy } from './admin-sign-in-email-copy';
import { ADMIN_SIGN_IN_LINK_LIFETIME_MINUTES } from '../../src/site/admin-paths';

export const ADMIN_SIGN_IN_EMAIL_COPY_FRENCH: AdminSignInEmailCopy = {
  subject: 'Connexion à l’administration de todz',
  preview: 'Votre lien vers l’administration de todz. Il fonctionne une seule fois.',
  heading: 'Connexion à l’administration',
  intro: 'Utilisez le bouton pour vous connecter à l’administration de todz.',
  action: 'Se connecter',
  fallback: 'Il s’ouvre dans le mauvais navigateur ? Collez ce lien dans celui où vous l’avez demandé :',
  footer: `Ce lien fonctionne une seule fois, pendant ${ADMIN_SIGN_IN_LINK_LIFETIME_MINUTES} minutes, dans le navigateur où vous l’avez demandé.`,
};
