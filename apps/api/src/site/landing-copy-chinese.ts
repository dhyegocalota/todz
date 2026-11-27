import type { LandingCopy } from './landing-copy';
import { formatShortId } from '@todz/core';
import { AUTHOR, COMPANY } from '@todz/types';
import { MCP_COPY, McpToolName } from '../mcp-copy';
import { AgentClient, agentSetupOf } from './agent-setup';
import { MCP_URL } from './site-urls';

const EXAMPLE_TASK_NUMBER = 12;
const EXAMPLE_TASK_TITLE = '审阅 PR';
const EXAMPLE_SECOND_TASK_TITLE = '发布 beta 版';
const EXAMPLE_DUE_COUNT = 3;
const SERVER_DEPLOY_SCRIPT = 'server:deploy';

export const LANDING_COPY_CHINESE: LandingCopy = {
  meta: {
    siteName: 'todz',
    title: 'todz：你的任务，与你的智能体共享',
    description: '原生 Mac 待办清单，Claude Code、Codex 和 Cursor 通过 MCP 协同处理。菜单栏、小组件、离线同步。',
  },
  shell: {
    skipLink: '跳到正文',
    homeLabel: 'todz 首页',
    wordmark: 'todz',
    navLabel: '网站',
    selfHostLink: '自行托管指南',
    selfHostLinkShort: '自行托管',
    installLink: '在 Mac 上安装',
    installLinkShort: '安装',
    githubLabel: 'GitHub 上的 todz',
    footerSelfHost: '自行托管指南',
    footerInstall: '在 Mac 上安装',
    footerGithub: 'GitHub',
    languageLabel: '语言',
    themeLabel: '主题',
    themeSystem: '系统',
    themeLight: '浅色',
    themeDark: '深色',
    creditPrefix: '© todz ·',
    creditLead: 'todz 是',
    creditName: COMPANY.tradeName,
    creditTail: ' 的产品，诞生于巴西',
  },
  hero: {
    eyebrow: 'macOS 14 或更高版本',
    title: '你的任务，与你的智能体共享。',
    lead: '原生 Mac 待办清单，Claude Code、Codex 和 Cursor 通过 MCP 协同处理。',
  },
  download: {
    button: '下载 Mac 版',
    heroButton: '下载 Mac 版 — 免费',
    note: '尚未经 Apple 公证：第一次请从系统设置 › 隐私与安全性中打开。',
    noteLink: '安装步骤',
  },
  free: {
    line: '在 todz cloud 上免费使用，或运行你自己的服务器。',
    linkText: '运行你自己的服务器',
  },
  ways: {
    cloud: {
      title: 'todz cloud',
      badge: '免费',
      points: ['用邮箱登录。', '在你的各台 Mac 和智能体之间同步。', '无需自己运行任何东西。'],
      limit: '免费的 todz cloud 名额极其有限。自行托管永远开放。',
      cta: '下载 Mac 版',
    },
    selfHost: {
      title: '自行托管',
      badge: '开源',
      body: '在你自己的 Cloudflare 账户上运行服务器。还是同一个 App：在设置中切换服务器即可。',
      cta: '服务器设置指南',
      terminal: {
        label: '自行托管指南中的部署步骤',
        command: `pnpm --filter @todz/api ${SERVER_DEPLOY_SCRIPT}`,
        ready: 'todz server ready: https://api.example.com',
        next: '→ 把它粘贴到 todz › 设置 › 服务器',
      },
    },
    note: '无论哪种方式，App 都是同一个，并且会自行更新。',
  },
  openSource: {
    starLabel: '在 GitHub 上加星',
    license: '许可证',
    contributing: '参与贡献',
  },
  signature: {
    line: '由开发者打造，为开发者和 AI 爱好者而做。',
    name: AUTHOR.name,
  },
  stage: {
    label: 'Mac 桌面上的 todz App',
    menuCount: '2',
  },
  benefits: {
    heading: '为什么选 todz',
    day: {
      eyebrow: '它主动来找你',
      title: 'todz 不会等着被打开。',
      railLabel: 'todz 陪伴的一天，从 07:00 到 18:00',
      email: {
        time: '07:00',
        subject: `你的一天：${EXAMPLE_DUE_COUNT} 项到期`,
        title: '你的一天，发到邮箱',
        body: '回复邮件即可添加任务。',
      },
      glance: {
        time: '09:00',
        heading: '今天',
        count: `还剩 ${EXAMPLE_DUE_COUNT} 项`,
        rows: [EXAMPLE_TASK_TITLE, EXAMPLE_SECOND_TASK_TITLE],
        title: '晨间速览',
        body: '唤醒你的 Mac：今天的任务会显示几秒钟。',
      },
      agent: {
        time: '10:30',
        ask: 'todz 里接下来做什么？',
        toolCall: `todz - ${McpToolName.Next} (MCP)`,
        toolResult: MCP_COPY.agentNudge.line({
          summary: MCP_COPY.agentNudge.due(EXAMPLE_DUE_COUNT),
          taskId: formatShortId(EXAMPLE_TASK_NUMBER),
        }),
        title: '你的智能体知道',
        body: '问问接下来做什么：它们会从今天说起。',
      },
      close: {
        time: '18:00',
        count: `还剩 ${EXAMPLE_DUE_COUNT} 项`,
        task: `${formatShortId(EXAMPLE_TASK_NUMBER)} ${EXAMPLE_TASK_TITLE}`,
        actions: ['完成', '明天', '无日期'],
        title: '收工',
        body: '每个任务：完成、明天或无日期。',
      },
      extras: {
        label: '你的 Mac 上还有',
        ribbon: {
          label: '菜单栏丝带',
          detail: `还剩 ${EXAMPLE_DUE_COUNT} 项 · 下一项：${formatShortId(EXAMPLE_TASK_NUMBER)} ${EXAMPLE_TASK_TITLE}`,
        },
        temperature: { label: '日温度', detail: '过了中午，计数会渐渐变暗。' },
        siri: { label: 'Siri', detail: '“今天在 todz 中还剩什么？”' },
      },
      note: '除 Siri 外，每一项都是设置中的一个开关。“遵循专注模式”会让你的 Mac 在专注模式期间保持安静。',
    },
    agents: {
      title: '智能体通过 MCP 添加任务',
      body: 'Claude Code、Codex 和 Cursor 可以读取、添加和完成你的任务。每一次更改都会注明是谁做的。',
    },
    offline: {
      title: '离线可用，处处同步',
      body: '离线时，更改会先等着，你一恢复在线，就会出现在每一台 Mac 上。',
    },
    lock: {
      title: '隐私优先的工作区',
      body: '每个工作区在你的屏幕和小组件中都保持独立。Touch ID 守护每一次切换。',
    },
  },
  howItWorks: {
    eyebrow: '运作方式',
    title: '连接一次，用大白话提问。',
    step1: '添加服务器：一条命令，然后登录。',
    step2: '让你的智能体添加、列出或完成任务。',
    step3: '它会出现在你的菜单栏和小组件里。',
  },
  terminal: {
    label: '把 todz 添加到 Claude Code，然后添加一个任务',
    shellPrompt: '$',
    command: agentSetupOf({ client: AgentClient.ClaudeCode, serverUrl: MCP_URL }),
    askPrompt: '>',
    ask: '添加一个 todz 任务：审阅 PR',
    toolCall: `todz - ${McpToolName.Add} (MCP)(tasks: [{"title": "${EXAMPLE_TASK_TITLE}"}])`,
    toolResult: `${MCP_COPY.added} ${formatShortId(EXAMPLE_TASK_NUMBER)} ${EXAMPLE_TASK_TITLE}`,
  },
  final: {
    title: '把 todz 装到你的 Mac 上。',
  },
  alt: {
    window: 'todz 主窗口：一个项目的任务，其中一个由 Claude Code 添加，检查器中显示它的备注和历史记录',
    windowDark: '深色模式下的 todz 主窗口：三个由 Claude Code 添加的任务',
    popover: 'todz 菜单栏弹出窗口：今天的任务和一个“添加任务”输入框',
    widgetMedium: '带有三个未完成任务的中号“今天”小组件',
    agentTasks: 'todz 中一个项目的任务，最新的一个由 Claude Code 添加',
    workspaceLock: 'todz 边栏，只显示当前的工作区及其列表',
  },
};
