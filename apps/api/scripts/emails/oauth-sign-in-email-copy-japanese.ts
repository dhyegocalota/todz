import type { OAuthSignInEmailCopy } from './oauth-sign-in-email-copy';
export const OAUTH_SIGN_IN_EMAIL_COPY_JAPANESE: OAuthSignInEmailCopy = {
  subject: 'todzへのアプリを承認',
  preview: 'todzへのアプリを承認するためのリンクです。1回だけ使えます。',
  heading: 'todzへのアプリを承認',
  intro: 'アプリがtodzアカウントへの接続をリクエストしました。開始したブラウザでボタンを使い、どこまで使えるようにするかを選んでください。',
  action: 'ブラウザで続ける',
  fallback: '別のブラウザで開きますか？リクエストしたブラウザに、次のリンクを貼り付けてください：',
  footer:
    'このリンクは1回だけ使え、まもなく期限が切れ、リクエストしたブラウザでしか開けません。心当たりがない場合は、このメールを無視してください。何も接続されません。',
  codeLabel: 'または、リンクをリクエストした画面でこのコードを入力してください。コードは1回だけ使え、リンクと同時に期限が切れます。',
};
