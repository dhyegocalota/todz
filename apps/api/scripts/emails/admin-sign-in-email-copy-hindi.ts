import type { AdminSignInEmailCopy } from './admin-sign-in-email-copy';
import { ADMIN_SIGN_IN_LINK_LIFETIME_MINUTES } from '../../src/site/admin-paths';

export const ADMIN_SIGN_IN_EMAIL_COPY_HINDI: AdminSignInEmailCopy = {
  subject: 'todz एडमिन में साइन इन करें',
  preview: 'todz एडमिन का आपका लिंक। यह एक बार चलता है।',
  heading: 'एडमिन में साइन इन करें',
  intro: 'todz एडमिन में साइन इन करने के लिए बटन दबाएँ।',
  action: 'साइन इन करें',
  fallback: 'गलत ब्राउज़र में खुल रहा है? यह लिंक उसी ब्राउज़र में पेस्ट करें जहाँ आपने माँगा था:',
  footer: `यह लिंक एक बार, ${ADMIN_SIGN_IN_LINK_LIFETIME_MINUTES} मिनट तक, उसी ब्राउज़र में चलता है जहाँ आपने इसे माँगा था।`,
};
