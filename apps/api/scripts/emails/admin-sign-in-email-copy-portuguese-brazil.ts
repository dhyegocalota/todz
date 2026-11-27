import type { AdminSignInEmailCopy } from './admin-sign-in-email-copy';
import { ADMIN_SIGN_IN_LINK_LIFETIME_MINUTES } from '../../src/site/admin-paths';

export const ADMIN_SIGN_IN_EMAIL_COPY_PORTUGUESE_BRAZIL: AdminSignInEmailCopy = {
  subject: 'Entre na administração do todz',
  preview: 'Seu link para a administração do todz. Ele vale uma vez.',
  heading: 'Entre na administração',
  intro: 'Use o botão para entrar na administração do todz.',
  action: 'Entrar',
  fallback: 'Abriu no navegador errado? Cole este link no navegador em que você fez o pedido:',
  footer: `Este link vale uma vez, por ${ADMIN_SIGN_IN_LINK_LIFETIME_MINUTES} minutos, no navegador em que você o pediu.`,
};
