import type { AdminSignInEmailCopy } from './admin-sign-in-email-copy';
import { ADMIN_SIGN_IN_LINK_LIFETIME_MINUTES } from '../../src/site/admin-paths';

export const ADMIN_SIGN_IN_EMAIL_COPY_SPANISH: AdminSignInEmailCopy = {
  subject: 'Inicia sesión en la administración de todz',
  preview: 'Tu enlace a la administración de todz. Funciona una sola vez.',
  heading: 'Inicia sesión en la administración',
  intro: 'Usa el botón para iniciar sesión en la administración de todz.',
  action: 'Iniciar sesión',
  fallback: '¿Se abre en el navegador equivocado? Pega este enlace en el navegador donde lo pediste:',
  footer: `Este enlace funciona una sola vez, durante ${ADMIN_SIGN_IN_LINK_LIFETIME_MINUTES} minutos, en el navegador donde lo pediste.`,
};
