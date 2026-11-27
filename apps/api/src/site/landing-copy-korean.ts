import type { LandingCopy } from './landing-copy';
import { formatShortId } from '@todz/core';
import { AUTHOR, COMPANY } from '@todz/types';
import { MCP_COPY, McpToolName } from '../mcp-copy';
import { AgentClient, agentSetupOf } from './agent-setup';
import { MCP_URL } from './site-urls';

const EXAMPLE_TASK_NUMBER = 12;
const EXAMPLE_TASK_TITLE = 'PR 리뷰하기';
const EXAMPLE_SECOND_TASK_TITLE = '베타 출시하기';
const EXAMPLE_DUE_COUNT = 3;
const SERVER_DEPLOY_SCRIPT = 'server:deploy';

export const LANDING_COPY_KOREAN: LandingCopy = {
  meta: {
    siteName: 'todz',
    title: 'todz: 에이전트와 함께 쓰는 나의 할 일',
    description: 'Claude Code, Codex, Cursor가 MCP로 다루는 네이티브 Mac 할 일 목록. 메뉴 막대, 위젯, 오프라인 동기화.',
  },
  shell: {
    skipLink: '본문으로 건너뛰기',
    homeLabel: 'todz 홈',
    wordmark: 'todz',
    navLabel: '사이트',
    selfHostLink: '셀프 호스팅 가이드',
    selfHostLinkShort: '셀프 호스팅',
    installLink: 'Mac에 설치',
    installLinkShort: '설치',
    githubLabel: 'GitHub의 todz',
    footerSelfHost: '셀프 호스팅 가이드',
    footerInstall: 'Mac에 설치',
    footerGithub: 'GitHub',
    languageLabel: '언어',
    themeLabel: '테마',
    themeSystem: '시스템',
    themeLight: '라이트',
    themeDark: '다크',
    creditPrefix: '© todz ·',
    creditLead: 'todz는',
    creditName: COMPANY.tradeName,
    creditTail: '의 제품이에요. 브라질에서 만들었어요.',
  },
  hero: {
    eyebrow: 'macOS 14 이상',
    title: '에이전트와 함께 쓰는 나의 할 일.',
    lead: 'Claude Code, Codex, Cursor가 MCP로 다루는 네이티브 Mac 할 일 목록.',
  },
  download: {
    button: 'Mac용 다운로드',
    heroButton: 'Mac용 다운로드 — 무료',
    note: '아직 Apple 공증을 받지 않았어요. 처음에는 시스템 설정 › 개인정보 보호 및 보안에서 열어 주세요.',
    noteLink: '설치 방법',
  },
  free: {
    line: 'todz cloud에서는 무료예요. 아니면 직접 운영하세요.',
    linkText: '직접 운영하세요',
  },
  ways: {
    cloud: {
      title: 'todz cloud',
      badge: '무료',
      points: ['이메일로 로그인해요.', 'Mac과 에이전트 전반에서 동기화돼요.', '운영할 것이 없어요.'],
      limit: '무료 todz cloud 자리는 매우 한정되어 있어요. 셀프 호스팅은 언제나 열려 있어요.',
      cta: 'Mac용 다운로드',
    },
    selfHost: {
      title: '셀프 호스팅',
      badge: '오픈 소스',
      body: '내 Cloudflare 계정에서 서버를 운영해요. 앱은 그대로예요. 설정에서 서버만 바꾸면 돼요.',
      cta: '서버 설정 가이드',
      terminal: {
        label: '셀프 호스팅 가이드의 배포 단계',
        command: `pnpm --filter @todz/api ${SERVER_DEPLOY_SCRIPT}`,
        ready: 'todz server ready: https://api.example.com',
        next: '→ todz › 설정 › 서버에 붙여 넣으세요',
      },
    },
    note: '어느 쪽이든 앱은 같고, 스스로 업데이트해요.',
  },
  openSource: {
    starLabel: 'GitHub에서 별표',
    license: '라이선스',
    contributing: '기여하기',
  },
  signature: {
    line: '개발자가 개발자와 AI를 즐겨 만지는 사람들을 위해 만들었어요.',
    name: AUTHOR.name,
  },
  stage: {
    label: 'Mac 데스크탑 위의 todz 앱',
    menuCount: '2',
  },
  benefits: {
    heading: 'todz를 쓰는 이유',
    day: {
      eyebrow: '먼저 찾아와요',
      title: 'todz는 열어 주기를 기다리지 않아요.',
      railLabel: 'todz와 함께하는 하루, 07:00부터 18:00까지',
      email: {
        time: '07:00',
        subject: `내 하루: ${EXAMPLE_DUE_COUNT}개 마감`,
        title: '하루 요약을 이메일로',
        body: '답장하면 작업이 추가돼요.',
      },
      glance: {
        time: '09:00',
        heading: '오늘',
        count: `${EXAMPLE_DUE_COUNT}개 남음`,
        rows: [EXAMPLE_TASK_TITLE, EXAMPLE_SECOND_TASK_TITLE],
        title: '아침 요약',
        body: 'Mac을 깨우면 몇 초 동안 오늘 할 일이 나타나요.',
      },
      agent: {
        time: '10:30',
        ask: 'todz에서 다음 할 일이 뭐야?',
        toolCall: `todz - ${McpToolName.Next} (MCP)`,
        toolResult: MCP_COPY.agentNudge.line({
          summary: MCP_COPY.agentNudge.due(EXAMPLE_DUE_COUNT),
          taskId: formatShortId(EXAMPLE_TASK_NUMBER),
        }),
        title: '에이전트가 알아요',
        body: '다음에 할 일을 물으면 오늘 할 일부터 시작해요.',
      },
      close: {
        time: '18:00',
        count: `${EXAMPLE_DUE_COUNT}개 남음`,
        task: `${formatShortId(EXAMPLE_TASK_NUMBER)} ${EXAMPLE_TASK_TITLE}`,
        actions: ['완료', '내일', '날짜 없음'],
        title: '하루 마감',
        body: '작업마다 완료, 내일, 날짜 없음 중에서 골라요.',
      },
      extras: {
        label: 'Mac에서 더 많이',
        ribbon: {
          label: '메뉴 막대 리본',
          detail: `${EXAMPLE_DUE_COUNT}개 남음 · 다음: ${formatShortId(EXAMPLE_TASK_NUMBER)} ${EXAMPLE_TASK_TITLE}`,
        },
        temperature: { label: '하루 온도', detail: '정오가 지나면 개수가 흐려져요.' },
        siri: { label: 'Siri', detail: '“todz에서 오늘 남은 할 일”' },
      },
      note: 'Siri를 뺀 나머지는 모두 설정에서 켜고 끌 수 있어요. 집중 모드 따르기를 켜면 집중 모드 동안 Mac이 조용해요.',
    },
    agents: {
      title: '에이전트가 MCP로 작업을 추가해요',
      body: 'Claude Code, Codex, Cursor가 작업을 읽고, 추가하고, 끝내요. 모든 변경에는 누가 했는지 남아요.',
    },
    offline: {
      title: '오프라인에서도 쓰고, 어디서나 동기화돼요',
      body: '오프라인인 동안의 변경은 기다렸다가, 다시 연결되는 순간 모든 Mac에 반영돼요.',
    },
    lock: {
      title: '개인정보 보호가 먼저인 워크스페이스',
      body: '워크스페이스마다 화면과 위젯에서 따로 보여요. 전환할 때마다 Touch ID가 지켜 줘요.',
    },
  },
  howItWorks: {
    eyebrow: '이렇게 동작해요',
    title: '한 번 연결하고, 쉬운 말로 부탁하세요.',
    step1: '서버를 추가해요. 명령 하나를 실행하고 로그인하면 돼요.',
    step2: '에이전트에게 작업을 추가하거나, 나열하거나, 끝내 달라고 부탁하세요.',
    step3: '메뉴 막대와 위젯에 바로 나타나요.',
  },
  terminal: {
    label: 'Claude Code에 todz를 추가한 다음 작업 추가하기',
    shellPrompt: '$',
    command: agentSetupOf({ client: AgentClient.ClaudeCode, serverUrl: MCP_URL }),
    askPrompt: '>',
    ask: 'todz 작업 추가: PR 리뷰하기',
    toolCall: `todz - ${McpToolName.Add} (MCP)(tasks: [{"title": "${EXAMPLE_TASK_TITLE}"}])`,
    toolResult: `${MCP_COPY.added} ${formatShortId(EXAMPLE_TASK_NUMBER)} ${EXAMPLE_TASK_TITLE}`,
  },
  final: {
    title: 'Mac에서 todz를 만나 보세요.',
  },
  alt: {
    window: 'todz 메인 윈도우: 프로젝트의 작업들. 하나는 Claude Code로 추가했고, 인스펙터에 메모와 기록이 보여요',
    windowDark: '다크 모드의 todz 메인 윈도우: Claude Code로 추가한 작업 세 개',
    popover: 'todz 메뉴 막대 팝오버: 오늘의 작업과 작업 추가 입력란',
    widgetMedium: '열린 작업 세 개가 있는 중간 크기 오늘 위젯',
    agentTasks: 'todz의 프로젝트 작업들. 가장 최근 것은 Claude Code로 추가했어요',
    workspaceLock: '현재 워크스페이스와 그 목록만 보이는 todz 사이드바',
  },
};
