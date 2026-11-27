import type { OAuthCopy } from './oauth-copy';
export const OAUTH_COPY_JAPANESE: OAuthCopy = {
  meta: {
    description: 'アプリをtodzアカウントに接続します。',
    signInTitle: 'アプリを接続 · todz',
    inboxTitle: '受信トレイを確認してください · todz',
    consentTitle: 'アプリを承認 · todz',
    refusedTitle: '接続できません · todz',
    linkTitle: 'サインイン中 · todz',
    returnTitle: 'アプリに戻っています · todz',
    approvedTitle: '承認済み · todz',
  },
  signIn: {
    titleOf: (clientName: string) => `${clientName}を接続するにはサインインしてください`,
    lead: 'todzアカウントのアドレスを入力してください。リンクがメールで届き、このブラウザで開きます。',
    emailLabel: 'メールアドレス',
    emailPlaceholder: 'you@example.com',
    submit: 'リンクをメールで送信',
    submitting: '送信中…',
    invalidAddress: '有効なメールアドレスを入力してください。',
    tooMany: 'いまはリンクを送信できませんでした。1分後にもう一度お試しください。',
    unavailable: 'このサーバでは、アプリを接続するためのサインインを利用できません。',
  },
  inbox: {
    title: '受信トレイを確認してください',
    body: 'そのアドレスでサインインできる場合は、リンクを送信中です。リンクは、このブラウザで1回だけ使え、ここに戻ります。',
  },
  consent: {
    titleOf: (clientName: string) => `${clientName}をtodzに接続しますか？`,
    redirectOf: (host: string) => `回答すると、todzは${host}に戻します。`,
    loopbackRedirectOf: (host: string) => `回答すると、todzは${host}（このコンピュータ上のアプリ）に戻します。`,
    legend: 'どこまで使えるようにしますか？',
    projectHint: 'プロジェクトを選ぶと、そのプロジェクトのタスクの読み取りと変更ができ、同じワークスペースのほかのプロジェクトへの移動もできます。',
    ownerLabel: 'アカウント全体（オーナースコープ）',
    ownerWarning: 'すべてのタスクの読み取りと変更、およびすべてのワークスペースとプロジェクトの作成、名前変更、削除ができます。',
    noProjects: 'プロジェクトがまだありません。todzアプリで作成してから、戻ってきてください。',
    approve: '承認',
    approving: '承認しています…',
    deny: '拒否',
  },
  return: {
    titleOf: (clientName: string) => `${clientName}に戻っています`,
    body: '自動で開かない場合は、リンクを使ってください。',
    actionOf: (clientName: string) => `${clientName}に戻る`,
  },
  approved: {
    title: '承認済み',
    bodyOf: (clientName: string) =>
      `このリクエストは、すでに承認されています。接続を完了するには、${clientName}に戻ってください。それでも求められる場合は、${clientName}から最初からやり直してください。`,
  },
  refusal: {
    invalidTitle: 'このリンクではアプリを接続できません',
    invalidBody:
      '接続しようとしているアプリから、最初からやり直してください。それでもここに戻ってしまう場合は、先にそのアプリに保存されたサインインを消去してください（Claude Codeでは、/mcpを実行し、Clear authenticationを選びます）。',
    choiceTitle: 'その選択は利用できません',
    choiceBody: '接続しようとしているアプリから最初からやり直し、表示された選択肢から1つを選んでください。',
    forbiddenTitle: 'リクエストが拒否されました',
    forbiddenBody: 'そのリクエストは、このページから送信されたものではありません。接続しようとしているアプリから、最初からやり直してください。',
  },
  link: {
    working: 'サインインしています…',
    failedTitle: 'このリンクは使えません。',
    failedBody: 'このブラウザから、新しいリンクをリクエストしてください。',
    failedAction: '新しいリンクを取得',
    cloudFullTitle: 'todz cloudはただいま満員です',
    cloudFullBodyOf: ({ selfHostUrl }: { selfHostUrl: string }) =>
      `todz cloudはただいま満員です。メールアドレスを登録しておくと、枠が空いたときに利用できます。または、独自のサーバを動かすこともできます：${selfHostUrl}`,
    noScriptTitle: 'サインインを完了',
    noScript: 'サインインを完了するには、このページでJavaScriptが必要です。有効にしてから、もう一度リンクを開いてください。',
  },
};
