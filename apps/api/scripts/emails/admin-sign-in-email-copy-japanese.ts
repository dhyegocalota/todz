import type { AdminSignInEmailCopy } from './admin-sign-in-email-copy';
import { ADMIN_SIGN_IN_LINK_LIFETIME_MINUTES } from '../../src/site/admin-paths';

export const ADMIN_SIGN_IN_EMAIL_COPY_JAPANESE: AdminSignInEmailCopy = {
  subject: 'todz管理ページにサインイン',
  preview: 'todz管理ページへのリンクです。1回だけ使えます。',
  heading: '管理ページにサインイン',
  intro: 'ボタンを使って、todz管理ページにサインインしてください。',
  action: 'サインイン',
  fallback: '別のブラウザで開きますか？リクエストしたブラウザに、次のリンクを貼り付けてください：',
  footer: `このリンクは、リクエストしたブラウザで${ADMIN_SIGN_IN_LINK_LIFETIME_MINUTES}分間、1回だけ使えます。`,
  codeLabel: 'または、リンクをリクエストした画面でこのコードを入力してください。コードは1回だけ使え、リンクと同時に期限が切れます。',
};
