import type { OAuthSignInEmailCopy } from './oauth-sign-in-email-copy';
export const OAUTH_SIGN_IN_EMAIL_COPY_FRENCH: OAuthSignInEmailCopy = {
  subject: 'Approuver une app pour todz',
  preview: 'Votre lien pour approuver une app pour todz. Il fonctionne une seule fois.',
  heading: 'Approuver une app pour todz',
  intro:
    'Une app a demandé à se connecter à votre compte todz. Utilisez le bouton dans le navigateur où vous avez commencé pour choisir à quoi elle peut accéder.',
  action: 'Continuer dans le navigateur',
  fallback: 'Il s’ouvre dans le mauvais navigateur ? Collez ce lien dans celui où vous l’avez demandé :',
  footer:
    'Ce lien fonctionne une seule fois, expire bientôt et s’ouvre uniquement dans le navigateur où vous l’avez demandé. Si vous n’avez rien demandé, ignorez cet e-mail : rien n’est connecté.',
};
