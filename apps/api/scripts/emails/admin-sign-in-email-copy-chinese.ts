import type { AdminSignInEmailCopy } from './admin-sign-in-email-copy';
import { ADMIN_SIGN_IN_LINK_LIFETIME_MINUTES } from '../../src/site/admin-paths';

export const ADMIN_SIGN_IN_EMAIL_COPY_CHINESE: AdminSignInEmailCopy = {
  subject: '登录 todz 管理后台',
  preview: '你登录 todz 管理后台的链接。它只能使用一次。',
  heading: '登录管理后台',
  intro: '点按按钮登录 todz 管理后台。',
  action: '登录',
  fallback: '在错误的浏览器中打开了？请把这个链接粘贴到你申请时所用的那个浏览器：',
  footer: `此链接只能使用一次，有效期 ${ADMIN_SIGN_IN_LINK_LIFETIME_MINUTES} 分钟，且只能在你申请它的浏览器中打开。`,
};
