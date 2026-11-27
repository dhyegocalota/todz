import type { AdminSignInEmailCopy } from './admin-sign-in-email-copy';
import { ADMIN_SIGN_IN_LINK_LIFETIME_MINUTES } from '../../src/site/admin-paths';

export const ADMIN_SIGN_IN_EMAIL_COPY_ARABIC: AdminSignInEmailCopy = {
  subject: 'تسجيل الدخول إلى إدارة todz',
  preview: 'رابطك إلى إدارة todz. يعمل مرة واحدة.',
  heading: 'تسجيل الدخول إلى الإدارة',
  intro: 'استخدم الزر لتسجيل الدخول إلى إدارة todz.',
  action: 'تسجيل الدخول',
  fallback: 'يُفتح في المتصفح الخطأ؟ الصق هذا الرابط في المتصفح الذي طلبته منه:',
  footer: `يعمل هذا الرابط مرة واحدة، لمدة ${ADMIN_SIGN_IN_LINK_LIFETIME_MINUTES} دقيقة، في المتصفح الذي طلبته منه.`,
};
