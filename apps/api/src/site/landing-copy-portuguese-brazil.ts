import type { LandingCopy } from './landing-copy';
import { formatShortId } from '@todz/core';
import { AUTHOR, COMPANY } from '@todz/types';
import { MCP_COPY, McpToolName } from '../mcp-copy';
import { AgentClient, agentSetupOf } from './agent-setup';
import { MCP_URL } from './site-urls';

const EXAMPLE_TASK_NUMBER = 12;
const EXAMPLE_TASK_TITLE = 'Revisar o PR';
const EXAMPLE_SECOND_TASK_TITLE = 'Lançar o beta';
const EXAMPLE_DUE_COUNT = 3;
const SERVER_DEPLOY_SCRIPT = 'server:deploy';

export const LANDING_COPY_PORTUGUESE_BRAZIL: LandingCopy = {
  meta: {
    siteName: 'todz',
    title: 'todz: suas tarefas, compartilhadas com seus agentes',
    description:
      'Uma lista de tarefas nativa para Mac que o Claude Code, o Codex e o Cursor usam por MCP. Barra de menus, widgets, sincronização offline.',
  },
  shell: {
    skipLink: 'Pular para o conteúdo',
    homeLabel: 'Página inicial do todz',
    wordmark: 'todz',
    navLabel: 'Navegação',
    selfHostLink: 'Guia de auto-hospedagem',
    selfHostLinkShort: 'Auto-hospedagem',
    installLink: 'Instalar no Mac',
    installLinkShort: 'Instalar',
    githubLabel: 'todz no GitHub',
    footerSelfHost: 'Guia de auto-hospedagem',
    footerInstall: 'Instalar no Mac',
    footerGithub: 'GitHub',
    languageLabel: 'Idioma',
    themeLabel: 'Tema',
    themeSystem: 'Sistema',
    themeLight: 'Claro',
    themeDark: 'Escuro',
    creditPrefix: '© todz ·',
    creditLead: 'O todz é um produto da',
    creditName: COMPANY.tradeName,
    creditTail: ', feito no Brasil',
  },
  hero: {
    eyebrow: 'macOS 14 ou mais recente',
    title: 'Suas tarefas, compartilhadas com seus agentes.',
    lead: 'Uma lista de tarefas nativa para Mac que o Claude Code, o Codex e o Cursor usam por MCP.',
  },
  download: {
    button: 'Baixar para Mac',
    heroButton: 'Baixar para Mac — grátis',
    note: 'Ainda não é notarizado pela Apple: na primeira vez, abra pelos Ajustes do Sistema › Privacidade e Segurança.',
    noteLink: 'Passos de instalação',
  },
  free: {
    line: 'Grátis no todz cloud — ou rode o seu próprio.',
    linkText: 'rode o seu próprio',
  },
  ways: {
    cloud: {
      title: 'todz cloud',
      badge: 'Grátis',
      points: ['Entre com o seu e-mail.', 'Sincronizado entre os seus Macs e agentes.', 'Nada para rodar.'],
      limit: 'As vagas gratuitas do todz cloud são extremamente limitadas. A auto-hospedagem está sempre aberta.',
      cta: 'Baixar para Mac',
    },
    selfHost: {
      title: 'Auto-hospedagem',
      badge: 'Código aberto',
      body: 'Rode o servidor na sua própria conta Cloudflare. O mesmo app: troque o servidor nos Ajustes.',
      cta: 'Guia de configuração do servidor',
      terminal: {
        label: 'O passo de deploy do guia de auto-hospedagem',
        command: `pnpm --filter @todz/api ${SERVER_DEPLOY_SCRIPT}`,
        ready: 'todz server ready: https://api.example.com',
        next: '→ cole em todz › Ajustes › Servidor',
      },
    },
    note: 'O app é o mesmo nos dois casos, e se atualiza sozinho.',
  },
  openSource: {
    starLabel: 'Dar estrela no GitHub',
    license: 'Licença',
    contributing: 'Contribuir',
  },
  signature: {
    line: 'Feito por um desenvolvedor, para desenvolvedores e entusiastas de IA.',
    name: AUTHOR.name,
  },
  stage: {
    label: 'O app todz em uma mesa do Mac',
    menuCount: '2',
  },
  benefits: {
    heading: 'Por que o todz',
    day: {
      eyebrow: 'Ele vai até você',
      title: 'O todz não espera ser aberto.',
      railLabel: 'Um dia com o todz, das 07:00 às 18:00',
      email: {
        time: '07:00',
        subject: `Seu dia: ${EXAMPLE_DUE_COUNT} para hoje`,
        title: 'Seu dia, por e-mail',
        body: 'Responda para adicionar uma tarefa.',
      },
      glance: {
        time: '09:00',
        heading: 'Hoje',
        count: `${EXAMPLE_DUE_COUNT} restantes`,
        rows: [EXAMPLE_TASK_TITLE, EXAMPLE_SECOND_TASK_TITLE],
        title: 'Resumo da manhã',
        body: 'Acorde o Mac: Hoje aparece por alguns segundos.',
      },
      agent: {
        time: '10:30',
        ask: 'O que vem a seguir no todz?',
        toolCall: `todz - ${McpToolName.Next} (MCP)`,
        toolResult: MCP_COPY.agentNudge.line({
          summary: MCP_COPY.agentNudge.due(EXAMPLE_DUE_COUNT),
          taskId: formatShortId(EXAMPLE_TASK_NUMBER),
        }),
        title: 'Seus agentes sabem',
        body: 'Pergunte o que vem a seguir: eles começam pelo dia de hoje.',
      },
      close: {
        time: '18:00',
        count: `${EXAMPLE_DUE_COUNT} restantes`,
        task: `${formatShortId(EXAMPLE_TASK_NUMBER)} ${EXAMPLE_TASK_TITLE}`,
        actions: ['Concluir', 'Amanhã', 'Sem data'],
        title: 'Fechar o dia',
        body: 'Cada tarefa: Concluir, Amanhã ou Sem data.',
      },
      extras: {
        label: 'Também no seu Mac',
        ribbon: {
          label: 'Faixa da barra de menus',
          detail: `${EXAMPLE_DUE_COUNT} restantes · a seguir: ${formatShortId(EXAMPLE_TASK_NUMBER)} ${EXAMPLE_TASK_TITLE}`,
        },
        temperature: { label: 'Temperatura do dia', detail: 'A contagem esmaece depois do meio-dia.' },
        siri: { label: 'Siri', detail: '“O que falta para hoje no todz?”' },
      },
      note: 'Cada um, menos a Siri, é um interruptor nos Ajustes. Respeitar o Foco mantém o seu Mac em silêncio durante um Foco.',
    },
    agents: {
      title: 'Agentes adicionam tarefas por MCP',
      body: 'O Claude Code, o Codex e o Cursor leem, adicionam e concluem as suas tarefas. Toda mudança diz quem a fez.',
    },
    offline: {
      title: 'Funciona offline, sincroniza em todo lugar',
      body: 'As mudanças esperam enquanto você está offline e chegam a todos os Macs assim que você volta.',
    },
    lock: {
      title: 'Workspaces com privacidade em primeiro lugar',
      body: 'Cada workspace fica separado na sua tela e nos seus widgets. O Touch ID protege cada troca.',
    },
  },
  howItWorks: {
    eyebrow: 'Como funciona',
    title: 'Conecte uma vez. Peça em palavras simples.',
    step1: 'Adicione o servidor: um comando e depois entre na conta.',
    step2: 'Peça ao seu agente para adicionar, listar ou concluir uma tarefa.',
    step3: 'Ela aparece na sua barra de menus e nos seus widgets.',
  },
  terminal: {
    label: 'Adicionando o todz ao Claude Code e depois adicionando uma tarefa',
    shellPrompt: '$',
    command: agentSetupOf({ client: AgentClient.ClaudeCode, serverUrl: MCP_URL }),
    askPrompt: '>',
    ask: 'Adicione uma tarefa no todz: revisar o PR',
    toolCall: `todz - ${McpToolName.Add} (MCP)(tasks: [{"title": "${EXAMPLE_TASK_TITLE}"}])`,
    toolResult: `${MCP_COPY.added} ${formatShortId(EXAMPLE_TASK_NUMBER)} ${EXAMPLE_TASK_TITLE}`,
  },
  final: {
    title: 'Leve o todz para o seu Mac.',
  },
  alt: {
    window:
      'A janela principal do todz: as tarefas de um projeto, uma delas adicionada via Claude Code, com as notas e o histórico no inspetor',
    windowDark: 'A janela principal do todz no modo escuro: três tarefas adicionadas via Claude Code',
    popover: 'O popover da barra de menus do todz: as tarefas de hoje e um campo Adicionar uma tarefa',
    widgetMedium: 'O widget médio Hoje com três tarefas abertas',
    agentTasks: 'As tarefas de um projeto no todz, a mais recente adicionada via Claude Code',
    workspaceLock: 'A barra lateral do todz mostrando apenas o workspace atual e as listas dele',
  },
};
