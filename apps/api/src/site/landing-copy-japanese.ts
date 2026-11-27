import type { LandingCopy } from './landing-copy';
import { formatShortId } from '@todz/core';
import { AUTHOR, COMPANY } from '@todz/types';
import { MCP_COPY, McpToolName } from '../mcp-copy';
import { AgentClient, agentSetupOf } from './agent-setup';
import { MCP_URL } from './site-urls';

const EXAMPLE_TASK_NUMBER = 12;
const EXAMPLE_TASK_TITLE = 'PRをレビュー';
const EXAMPLE_SECOND_TASK_TITLE = 'ベータ版を出荷';
const EXAMPLE_DUE_COUNT = 3;
const SERVER_DEPLOY_SCRIPT = 'server:deploy';

export const LANDING_COPY_JAPANESE: LandingCopy = {
  meta: {
    siteName: 'todz',
    title: 'todz：あなたのタスクを、エージェントと共有',
    description: 'Claude Code、Codex、CursorがMCP経由で扱える、ネイティブMacのToDoリスト。メニューバー、ウィジェット、オフライン同期。',
  },
  shell: {
    skipLink: 'コンテンツへスキップ',
    homeLabel: 'todzのホーム',
    wordmark: 'todz',
    navLabel: 'サイト',
    selfHostLink: 'セルフホストガイド',
    selfHostLinkShort: 'セルフホスト',
    installLink: 'Macにインストール',
    installLinkShort: 'インストール',
    githubLabel: 'GitHubのtodz',
    footerSelfHost: 'セルフホストガイド',
    footerInstall: 'Macにインストール',
    footerGithub: 'GitHub',
    languageLabel: '言語',
    themeLabel: 'テーマ',
    themeSystem: 'システム',
    themeLight: 'ライト',
    themeDark: 'ダーク',
    creditPrefix: '© todz ·',
    creditLead: 'todzは',
    creditName: COMPANY.tradeName,
    creditTail: 'の製品です。ブラジルで開発しています。',
  },
  hero: {
    eyebrow: 'macOS 14以降',
    title: 'あなたのタスクを、エージェントと共有。',
    lead: 'Claude Code、Codex、CursorがMCP経由で扱える、ネイティブMacのToDoリスト。',
  },
  download: {
    button: 'Mac版をダウンロード',
    heroButton: 'Mac版をダウンロード（無料）',
    note: 'まだAppleの公証を受けていません。初回は、システム設定 › プライバシーとセキュリティから開いてください。',
    noteLink: 'インストール手順',
  },
  free: {
    line: 'todz cloudなら無料。自分で動かすこともできます。',
    linkText: '自分で動かす',
  },
  ways: {
    cloud: {
      title: 'todz cloud',
      badge: '無料',
      points: ['メールアドレスでサインイン。', 'すべてのMacとエージェントで同期。', '動かすものは何もありません。'],
      limit: '無料のtodz cloudの枠は非常に限られています。セルフホストはいつでも利用できます。',
      cta: 'Mac版をダウンロード',
    },
    selfHost: {
      title: 'セルフホスト',
      badge: 'オープンソース',
      body: '自分のCloudflareアカウントでサーバを動かします。アプリは同じで、設定でサーバを切り替えるだけです。',
      cta: 'サーバのセットアップガイド',
      terminal: {
        label: 'セルフホストガイドのデプロイ手順',
        command: `pnpm --filter @todz/api ${SERVER_DEPLOY_SCRIPT}`,
        ready: 'todz server ready: https://api.example.com',
        next: '→ todz › 設定 › サーバに貼り付けます',
      },
    },
    note: 'どちらでも同じアプリで、自分でアップデートします。',
  },
  openSource: {
    starLabel: 'GitHubでスターを付ける',
    license: 'ライセンス',
    contributing: 'コントリビュート',
  },
  signature: {
    line: '開発者が、開発者とAI好きのために作りました。',
    name: AUTHOR.name,
  },
  stage: {
    label: 'Macのデスクトップ上のtodzアプリ',
    menuCount: '2',
  },
  benefits: {
    heading: 'todzを選ぶ理由',
    day: {
      eyebrow: '向こうから届く',
      title: 'todzは、開かれるのを待ちません。',
      railLabel: 'todzのある1日、7:00から18:00まで',
      email: {
        time: '07:00',
        subject: `今日の予定：期限${EXAMPLE_DUE_COUNT}件`,
        title: '1日の予定をメールで',
        body: '返信するとタスクを追加できます。',
      },
      glance: {
        time: '09:00',
        heading: '今日',
        count: `残り${EXAMPLE_DUE_COUNT}件`,
        rows: [EXAMPLE_TASK_TITLE, EXAMPLE_SECOND_TASK_TITLE],
        title: '朝のひと目確認',
        body: 'Macを起こすと、今日のタスクが数秒間表示されます。',
      },
      agent: {
        time: '10:30',
        ask: 'todzで次にやることは？',
        toolCall: `todz - ${McpToolName.Next} (MCP)`,
        toolResult: MCP_COPY.agentNudge.line({
          summary: MCP_COPY.agentNudge.due(EXAMPLE_DUE_COUNT),
          taskId: formatShortId(EXAMPLE_TASK_NUMBER),
        }),
        title: 'エージェントも知っている',
        body: '次にやることを尋ねると、今日の分から始まります。',
      },
      close: {
        time: '18:00',
        count: `残り${EXAMPLE_DUE_COUNT}件`,
        task: `${formatShortId(EXAMPLE_TASK_NUMBER)} ${EXAMPLE_TASK_TITLE}`,
        actions: ['完了', '明日', '日付なし'],
        title: '1日を締めくくる',
        body: 'タスクごとに、完了、明日、日付なしを選べます。',
      },
      extras: {
        label: 'Macにはほかにも',
        ribbon: {
          label: 'メニューバーのリボン',
          detail: `残り${EXAMPLE_DUE_COUNT}件 · 次：${formatShortId(EXAMPLE_TASK_NUMBER)} ${EXAMPLE_TASK_TITLE}`,
        },
        temperature: { label: '日の温度', detail: '正午を過ぎると件数が薄くなります。' },
        siri: { label: 'Siri', detail: '「todzで今日の残りは」' },
      },
      note: 'Siri以外は、すべて設定のスイッチです。集中モードを尊重にすると、集中モードの間、Macを静かに保ちます。',
    },
    agents: {
      title: 'エージェントがMCPでタスクを追加',
      body: 'Claude Code、Codex、Cursorがタスクを読み、追加し、完了します。すべての変更に、誰が行ったかが記録されます。',
    },
    offline: {
      title: 'オフラインでも使え、どこでも同期',
      body: 'オフラインの間の変更は待機し、オンラインに戻った瞬間に、すべてのMacに反映されます。',
    },
    lock: {
      title: 'プライバシーを第一にしたワークスペース',
      body: '各ワークスペースは、画面でもウィジェットでも分かれたままです。切り替えるたびに、Touch IDが守ります。',
    },
  },
  howItWorks: {
    eyebrow: '仕組み',
    title: '一度つなげば、あとは普通の言葉で頼むだけ。',
    step1: 'サーバを追加します。コマンド1つで、あとはサインインするだけ。',
    step2: 'エージェントに、タスクの追加、一覧表示、完了を頼みます。',
    step3: 'メニューバーとウィジェットに表示されます。',
  },
  terminal: {
    label: 'Claude Codeにtodzを追加して、タスクを追加する',
    shellPrompt: '$',
    command: agentSetupOf({ client: AgentClient.ClaudeCode, serverUrl: MCP_URL }),
    askPrompt: '>',
    ask: 'todzにタスクを追加：PRをレビュー',
    toolCall: `todz - ${McpToolName.Add} (MCP)(tasks: [{"title": "${EXAMPLE_TASK_TITLE}"}])`,
    toolResult: `${MCP_COPY.added} ${formatShortId(EXAMPLE_TASK_NUMBER)} ${EXAMPLE_TASK_TITLE}`,
  },
  final: {
    title: 'Macにtodzを入れましょう。',
  },
  alt: {
    window: 'todzのメインウィンドウ：プロジェクトのタスク。1件はClaude Code経由で追加され、インスペクタにメモと履歴が表示されている',
    windowDark: 'ダークモードのtodzのメインウィンドウ：Claude Code経由で追加された3件のタスク',
    popover: 'todzのメニューバーのポップオーバ：今日のタスクと、タスクを追加のフィールド',
    widgetMedium: '3件の未完了タスクが表示された、中サイズの今日のウィジェット',
    agentTasks: 'todzのプロジェクトのタスク。最新の1件はClaude Code経由で追加されている',
    workspaceLock: '現在のワークスペースとそのリストだけが表示されたtodzのサイドバー',
  },
};
