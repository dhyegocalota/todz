import { formatShortId } from '@todz/core';
import { AUTHOR, COMPANY } from '@todz/types';
import { MCP_COPY, McpToolName } from '../mcp-copy';
import { AgentClient, agentSetupOf } from './agent-setup';
import { MCP_URL } from './site-urls';

const EXAMPLE_TASK_NUMBER = 12;
const EXAMPLE_TASK_TITLE = 'Review PR';
const EXAMPLE_SECOND_TASK_TITLE = 'Ship the beta';
const EXAMPLE_DUE_COUNT = 3;
const SERVER_DEPLOY_SCRIPT = 'server:deploy';

export const LANDING_COPY = {
  meta: {
    siteName: 'todz',
    title: 'todz: your tasks, shared with your agents',
    description: 'A native Mac to-do list that Claude Code, Codex and Cursor work over MCP. Menu bar, widgets, offline sync.',
  },
  shell: {
    skipLink: 'Skip to content',
    homeLabel: 'todz home',
    wordmark: 'todz',
    navLabel: 'Site',
    selfHostLink: 'Self-host guide',
    selfHostLinkShort: 'Self-host',
    installLink: 'Install on Mac',
    installLinkShort: 'Install',
    githubLabel: 'todz on GitHub',
    footerSelfHost: 'Self-host guide',
    footerInstall: 'Install on Mac',
    footerGithub: 'GitHub',
    creditPrefix: '© todz ·',
    creditLead: 'todz is a product of',
    creditName: COMPANY.tradeName,
    creditTail: ', made in Brazil',
  },
  hero: {
    eyebrow: 'macOS 14 or later',
    title: 'Your tasks, shared with your agents.',
    lead: 'A native Mac to-do list that Claude Code, Codex and Cursor work over MCP.',
  },
  download: {
    button: 'Download for Mac',
    heroButton: 'Download for Mac — Free',
    note: 'Not notarized by Apple yet: the first time, open it from System Settings › Privacy & Security.',
    noteLink: 'Install steps',
  },
  free: {
    line: 'Free on todz cloud — or run your own.',
    linkText: 'run your own',
  },
  ways: {
    cloud: {
      title: 'todz cloud',
      badge: 'Free',
      points: ['Sign in with your email.', 'Synced across your Macs and agents.', 'Nothing to run.'],
      limit: 'Free todz cloud spots are extremely limited. Self-hosting is always open.',
      cta: 'Download for Mac',
    },
    selfHost: {
      title: 'Self-host',
      badge: 'Open source',
      body: 'Run the server on your own Cloudflare account. Same app: switch the server in Settings.',
      cta: 'Server setup guide',
      terminal: {
        label: 'The deploy step of the self-host guide',
        command: `pnpm --filter @todz/api ${SERVER_DEPLOY_SCRIPT}`,
        ready: 'todz server ready: https://api.example.com',
        next: '→ paste it in todz › Settings › Server',
      },
    },
    note: 'The app is the same either way, and updates itself.',
  },
  openSource: {
    starLabel: 'Star on GitHub',
    license: 'License',
    contributing: 'Contributing',
  },
  signature: {
    line: 'Built by a developer, for developers and AI tinkerers.',
    name: AUTHOR.name,
  },
  stage: {
    label: 'The todz app on a Mac desktop',
    menuCount: '2',
  },
  benefits: {
    heading: 'Why todz',
    day: {
      eyebrow: 'It comes to you',
      title: "todz doesn't wait to be opened.",
      railLabel: 'A day with todz, from 07:00 to 18:00',
      email: {
        time: '07:00',
        subject: `Your day: ${EXAMPLE_DUE_COUNT} due`,
        title: 'Your day, by email',
        body: 'Reply to add a task.',
      },
      glance: {
        time: '09:00',
        heading: 'Today',
        count: `${EXAMPLE_DUE_COUNT} left`,
        rows: [EXAMPLE_TASK_TITLE, EXAMPLE_SECOND_TASK_TITLE],
        title: 'Morning glance',
        body: 'Wake your Mac: Today shows for a few seconds.',
      },
      agent: {
        time: '10:30',
        ask: "What's next in todz?",
        toolCall: `todz - ${McpToolName.Next} (MCP)`,
        toolResult: MCP_COPY.agentNudge.line({
          summary: MCP_COPY.agentNudge.due(EXAMPLE_DUE_COUNT),
          taskId: formatShortId(EXAMPLE_TASK_NUMBER),
        }),
        title: 'Your agents know',
        body: "Ask what's next: they start with today.",
      },
      close: {
        time: '18:00',
        count: `${EXAMPLE_DUE_COUNT} left`,
        task: `${formatShortId(EXAMPLE_TASK_NUMBER)} ${EXAMPLE_TASK_TITLE}`,
        actions: ['Done', 'Tomorrow', 'No date'],
        title: 'Close the day',
        body: 'Each task: Done, Tomorrow or No date.',
      },
      extras: {
        label: 'Also on your Mac',
        ribbon: {
          label: 'Menu bar ribbon',
          detail: `${EXAMPLE_DUE_COUNT} left · next: ${formatShortId(EXAMPLE_TASK_NUMBER)} ${EXAMPLE_TASK_TITLE}`,
        },
        temperature: { label: 'Day temperature', detail: 'The count fades after noon.' },
        siri: { label: 'Siri', detail: "“What's left today in todz?”" },
      },
      note: 'Each one but Siri is a switch in Settings. Respect Focus keeps your Mac quiet during a Focus.',
    },
    agents: {
      title: 'Agents add tasks over MCP',
      body: 'Claude Code, Codex and Cursor read, add and finish tasks after one sign-in. Every change says who made it.',
    },
    offline: {
      title: 'Works offline, syncs everywhere',
      body: 'Changes wait while you are offline and land on every Mac when you are back.',
    },
  },
  howItWorks: {
    eyebrow: 'How it works',
    title: 'Connect once. Ask in plain words.',
    step1: 'Add the server: one command, then sign in.',
    step2: 'Ask your agent to add, list or finish a task.',
    step3: 'It shows up in your menu bar and widgets.',
  },
  terminal: {
    label: 'Adding todz to Claude Code, then adding a task',
    shellPrompt: '$',
    command: agentSetupOf({ client: AgentClient.ClaudeCode, serverUrl: MCP_URL }),
    askPrompt: '>',
    ask: 'Add a todz task: review the PR',
    toolCall: `todz - ${McpToolName.Add} (MCP)(tasks: [{"title": "${EXAMPLE_TASK_TITLE}"}])`,
    toolResult: `${MCP_COPY.added} ${formatShortId(EXAMPLE_TASK_NUMBER)} ${EXAMPLE_TASK_TITLE}`,
  },
  final: {
    title: 'Get todz on your Mac.',
  },
  alt: {
    window: "The todz main window: a project's tasks, one added via Claude Code, with its notes and history in the inspector",
    windowDark: 'The todz main window in dark mode: three tasks added via Claude Code',
    popover: "The todz menu bar popover: today's tasks and an Add a task field",
    widgetMedium: 'The medium Today widget with three open tasks',
    agentTasks: "A project's tasks in todz, the newest added via Claude Code",
  },
};

const { day } = LANDING_COPY.benefits;

export const LANDING_DAY_LINES = [
  ...[day.email, day.glance, day.agent, day.close].map(({ time, title, body }) => `${time} ${title}: ${body}`),
  ...[day.extras.ribbon, day.extras.temperature, day.extras.siri].map(({ label, detail }) => `${label}: ${detail}`),
];
