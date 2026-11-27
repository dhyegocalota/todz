import type { AdminSignInEmailCopy } from './admin-sign-in-email-copy';
import { ADMIN_SIGN_IN_LINK_LIFETIME_MINUTES } from '../../src/site/admin-paths';

export const ADMIN_SIGN_IN_EMAIL_COPY_GERMAN: AdminSignInEmailCopy = {
  subject: 'Beim todz-Admin anmelden',
  preview: 'Dein Link zum todz-Admin. Er funktioniert einmal.',
  heading: 'Beim Admin anmelden',
  intro: 'Melde dich mit dem Button beim todz-Admin an.',
  action: 'Anmelden',
  fallback: 'Öffnet es sich im falschen Browser? Füge diesen Link in den Browser ein, in dem du ihn angefordert hast:',
  footer: `Dieser Link funktioniert einmal, ${ADMIN_SIGN_IN_LINK_LIFETIME_MINUTES} Minuten lang, in dem Browser, in dem du ihn angefordert hast.`,
  codeLabel: 'Oder gib diesen Code dort ein, wo du den Link angefordert hast. Er funktioniert einmal und läuft mit dem Link ab.',
};
