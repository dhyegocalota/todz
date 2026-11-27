import type { CloudPageCopy } from './cloud-page-copy';
export const CLOUD_PAGE_COPY_JAPANESE: CloudPageCopy = {
  fullMail: {
    subject: 'todz cloudはただいま満員です',
    textOf: ({ queueUrl, selfHostUrl }: { queueUrl: string; selfHostUrl: string }): string =>
      `todz cloudはただいま満員です。無料のtodz cloudの枠は非常に限られています。アドレスを確認して順番待ちに加わると、枠が空いたときに利用できます：${queueUrl}\n\nまたは、いつでも利用できる、独自のサーバを動かす方法もあります：${selfHostUrl}`,
  },
  queuePage: {
    title: 'todz cloudの順番待ちに加わる',
    lead: '無料のtodz cloudの枠は非常に限られています。下で確認していただくと、枠が空いたときにご連絡します。',
    joinAs: '次のアドレスで順番待ちに加わる：',
    invalidTitle: 'このリンクは、もう有効ではありません',
    invalidBody:
      'todz cloudが満員だったときに送信したメールのリンクは、1週間有効です。新しいリンクは、アプリでサインインリンクをもう一度リクエストすると取得できます。',
    submit: '順番待ちに加わる',
    submitting: '送信中…',
    queuedTitle: 'リストに登録されました',
    queuedBody: '枠が空いたら、メールでお知らせします。',
    tryAgain: 'いまは登録できませんでした。1分後にもう一度お試しください。',
    closed: '順番待ちは現在閉じています。',
    forbidden: 'そのリクエストは、このサイトから送信されたものではありません。',
    selfHost: 'または、いつでも利用できる、独自のサーバを動かす方法もあります：',
    selfHostLink: 'セルフホストガイド',
  },
};
