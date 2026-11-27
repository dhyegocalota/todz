import type { LandingCopy } from './landing-copy';
import { formatShortId } from '@todz/core';
import { AUTHOR, COMPANY } from '@todz/types';
import { MCP_COPY, McpToolName } from '../mcp-copy';
import { AgentClient, agentSetupOf } from './agent-setup';
import { MCP_URL } from './site-urls';

const EXAMPLE_TASK_NUMBER = 12;
const EXAMPLE_TASK_TITLE = 'Revisar el PR';
const EXAMPLE_SECOND_TASK_TITLE = 'Publicar la beta';
const EXAMPLE_DUE_COUNT = 3;
const SERVER_DEPLOY_SCRIPT = 'server:deploy';

export const LANDING_COPY_SPANISH: LandingCopy = {
  meta: {
    siteName: 'todz',
    title: 'todz: tus tareas, compartidas con tus agentes',
    description:
      'Una lista de tareas nativa para Mac que Claude Code, Codex y Cursor trabajan mediante MCP. Barra de menús, widgets, sincronización sin conexión.',
  },
  shell: {
    skipLink: 'Saltar al contenido',
    homeLabel: 'Inicio de todz',
    wordmark: 'todz',
    navLabel: 'Sitio',
    selfHostLink: 'Guía de autoalojamiento',
    selfHostLinkShort: 'Autoalojamiento',
    installLink: 'Instalar en Mac',
    installLinkShort: 'Instalar',
    githubLabel: 'todz en GitHub',
    footerSelfHost: 'Guía de autoalojamiento',
    footerInstall: 'Instalar en Mac',
    footerGithub: 'GitHub',
    languageLabel: 'Idioma',
    themeLabel: 'Tema',
    themeSystem: 'Sistema',
    themeLight: 'Claro',
    themeDark: 'Oscuro',
    creditPrefix: '© todz ·',
    creditLead: 'todz es un producto de',
    creditName: COMPANY.tradeName,
    creditTail: ', hecho en Brasil',
  },
  hero: {
    eyebrow: 'macOS 14 o posterior',
    title: 'Tus tareas, compartidas con tus agentes.',
    lead: 'Una lista de tareas nativa para Mac que Claude Code, Codex y Cursor trabajan mediante MCP.',
  },
  download: {
    button: 'Descargar para Mac',
    heroButton: 'Descargar para Mac — Gratis',
    note: 'Todavía no está notarizada por Apple: la primera vez, ábrela desde Ajustes del Sistema › Privacidad y seguridad.',
    noteLink: 'Pasos de instalación',
  },
  free: {
    line: 'Gratis en todz cloud — o ejecuta el tuyo.',
    linkText: 'ejecuta el tuyo',
  },
  ways: {
    cloud: {
      title: 'todz cloud',
      badge: 'Gratis',
      points: ['Inicia sesión con tu correo.', 'Sincronizado entre tus Mac y tus agentes.', 'Nada que ejecutar.'],
      limit: 'Los cupos gratuitos de todz cloud son extremadamente limitados. El autoalojamiento siempre está abierto.',
      cta: 'Descargar para Mac',
    },
    selfHost: {
      title: 'Autoalojamiento',
      badge: 'Código abierto',
      body: 'Ejecuta el servidor en tu propia cuenta de Cloudflare. Es la misma app: cambia el servidor en Ajustes.',
      cta: 'Guía de configuración del servidor',
      terminal: {
        label: 'El paso de despliegue de la guía de autoalojamiento',
        command: `pnpm --filter @todz/api ${SERVER_DEPLOY_SCRIPT}`,
        ready: 'todz server ready: https://api.example.com',
        next: '→ paste it in todz › Settings › Server',
      },
    },
    note: 'La app es la misma en ambos casos, y se actualiza sola.',
  },
  openSource: {
    starLabel: 'Marcar con una estrella en GitHub',
    license: 'Licencia',
    contributing: 'Contribuir',
  },
  signature: {
    line: 'Hecho por un desarrollador, para desarrolladores y entusiastas de la IA.',
    name: AUTHOR.name,
  },
  stage: {
    label: 'La app todz en un escritorio de Mac',
    menuCount: '2',
  },
  benefits: {
    heading: 'Por qué todz',
    day: {
      eyebrow: 'Viene a ti',
      title: 'todz no espera a que lo abras.',
      railLabel: 'Un día con todz, de 07:00 a 18:00',
      email: {
        time: '07:00',
        subject: `Tu día: vencen ${EXAMPLE_DUE_COUNT}`,
        title: 'Tu día, por correo',
        body: 'Responde para añadir una tarea.',
      },
      glance: {
        time: '09:00',
        heading: 'Hoy',
        count: `Quedan ${EXAMPLE_DUE_COUNT}`,
        rows: [EXAMPLE_TASK_TITLE, EXAMPLE_SECOND_TASK_TITLE],
        title: 'Vistazo de la mañana',
        body: 'Despierta tu Mac: Hoy aparece unos segundos.',
      },
      agent: {
        time: '10:30',
        ask: '¿Qué sigue en todz?',
        toolCall: `todz - ${McpToolName.Next} (MCP)`,
        toolResult: MCP_COPY.agentNudge.line({
          summary: MCP_COPY.agentNudge.due(EXAMPLE_DUE_COUNT),
          taskId: formatShortId(EXAMPLE_TASK_NUMBER),
        }),
        title: 'Tus agentes lo saben',
        body: 'Pregunta qué sigue: empiezan por lo de hoy.',
      },
      close: {
        time: '18:00',
        count: `Quedan ${EXAMPLE_DUE_COUNT}`,
        task: `${formatShortId(EXAMPLE_TASK_NUMBER)} ${EXAMPLE_TASK_TITLE}`,
        actions: ['Hecha', 'Mañana', 'Sin fecha'],
        title: 'Cerrar el día',
        body: 'Cada tarea: Hecha, Mañana o Sin fecha.',
      },
      extras: {
        label: 'También en tu Mac',
        ribbon: {
          label: 'Cinta de la barra de menús',
          detail: `Quedan ${EXAMPLE_DUE_COUNT} · siguiente: ${formatShortId(EXAMPLE_TASK_NUMBER)} ${EXAMPLE_TASK_TITLE}`,
        },
        temperature: { label: 'Temperatura del día', detail: 'El recuento se atenúa después del mediodía.' },
        siri: { label: 'Siri', detail: '«¿Qué queda hoy en todz?»' },
      },
      note: 'Todo menos Siri es un interruptor en Ajustes. Respetar Foco mantiene tu Mac en silencio durante un Foco.',
    },
    agents: {
      title: 'Los agentes añaden tareas mediante MCP',
      body: 'Claude Code, Codex y Cursor leen, añaden y terminan tus tareas. Cada cambio dice quién lo hizo.',
    },
    offline: {
      title: 'Funciona sin conexión, se sincroniza en todas partes',
      body: 'Los cambios esperan mientras no tienes conexión y llegan a cada Mac en cuanto vuelves.',
    },
    lock: {
      title: 'Espacios de trabajo con la privacidad primero',
      body: 'Cada espacio de trabajo permanece separado en tu pantalla y en tus widgets. Touch ID protege cada cambio.',
    },
  },
  howItWorks: {
    eyebrow: 'Cómo funciona',
    title: 'Conecta una vez. Pide con palabras sencillas.',
    step1: 'Añade el servidor: un comando y luego inicia sesión.',
    step2: 'Pide a tu agente que añada, liste o termine una tarea.',
    step3: 'Aparece en tu barra de menús y en tus widgets.',
  },
  terminal: {
    label: 'Añadiendo todz a Claude Code y luego una tarea',
    shellPrompt: '$',
    command: agentSetupOf({ client: AgentClient.ClaudeCode, serverUrl: MCP_URL }),
    askPrompt: '>',
    ask: 'Añade una tarea en todz: revisar el PR',
    toolCall: `todz - ${McpToolName.Add} (MCP)(tasks: [{"title": "${EXAMPLE_TASK_TITLE}"}])`,
    toolResult: `${MCP_COPY.added} ${formatShortId(EXAMPLE_TASK_NUMBER)} ${EXAMPLE_TASK_TITLE}`,
  },
  final: {
    title: 'Consigue todz en tu Mac.',
  },
  alt: {
    window:
      'La ventana principal de todz: las tareas de un proyecto, una añadida mediante Claude Code, con sus notas e historial en el inspector',
    windowDark: 'La ventana principal de todz en modo oscuro: tres tareas añadidas mediante Claude Code',
    popover: 'El popover de la barra de menús de todz: las tareas de hoy y un campo Añadir una tarea',
    widgetMedium: 'El widget mediano de Hoy con tres tareas abiertas',
    agentTasks: 'Las tareas de un proyecto en todz, la más reciente añadida mediante Claude Code',
    workspaceLock: 'La barra lateral de todz mostrando solo el espacio de trabajo actual y sus listas',
  },
};
