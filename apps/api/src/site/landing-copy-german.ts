import type { LandingCopy } from './landing-copy';
import { formatShortId } from '@todz/core';
import { AUTHOR, COMPANY } from '@todz/types';
import { MCP_COPY, McpToolName } from '../mcp-copy';
import { AgentClient, agentSetupOf } from './agent-setup';
import { MCP_URL } from './site-urls';

const EXAMPLE_TASK_NUMBER = 12;
const EXAMPLE_TASK_TITLE = 'PR prüfen';
const EXAMPLE_SECOND_TASK_TITLE = 'Beta ausliefern';
const EXAMPLE_DUE_COUNT = 3;
const SERVER_DEPLOY_SCRIPT = 'server:deploy';

export const LANDING_COPY_GERMAN: LandingCopy = {
  meta: {
    siteName: 'todz',
    title: 'todz: deine Aufgaben, geteilt mit deinen Agenten',
    description: 'Eine native Mac-To-do-Liste, die Claude Code, Codex und Cursor über MCP bearbeiten. Menüleiste, Widgets, Offline-Sync.',
  },
  shell: {
    skipLink: 'Zum Inhalt springen',
    homeLabel: 'todz Startseite',
    wordmark: 'todz',
    navLabel: 'Website',
    selfHostLink: 'Self-Host-Anleitung',
    selfHostLinkShort: 'Selbst hosten',
    installLink: 'Auf dem Mac installieren',
    installLinkShort: 'Installieren',
    githubLabel: 'todz auf GitHub',
    footerSelfHost: 'Self-Host-Anleitung',
    footerInstall: 'Auf dem Mac installieren',
    footerGithub: 'GitHub',
    languageLabel: 'Sprache',
    themeLabel: 'Erscheinungsbild',
    themeSystem: 'System',
    themeLight: 'Hell',
    themeDark: 'Dunkel',
    creditPrefix: '© todz ·',
    creditLead: 'todz ist ein Produkt von',
    creditName: COMPANY.tradeName,
    creditTail: ', gemacht in Brasilien',
  },
  hero: {
    eyebrow: 'macOS 14 oder neuer',
    title: 'Deine Aufgaben, geteilt mit deinen Agenten.',
    lead: 'Eine native Mac-To-do-Liste, die Claude Code, Codex und Cursor über MCP bearbeiten.',
  },
  download: {
    button: 'Download für Mac',
    heroButton: 'Download für Mac — kostenlos',
    note: 'Noch nicht von Apple notarisiert: Öffne sie beim ersten Mal über Systemeinstellungen › Datenschutz & Sicherheit.',
    noteLink: 'Installationsschritte',
  },
  free: {
    line: 'Kostenlos in todz cloud — oder betreibe deinen eigenen Server.',
    linkText: 'betreibe deinen eigenen Server',
  },
  ways: {
    cloud: {
      title: 'todz cloud',
      badge: 'Kostenlos',
      points: ['Melde dich mit deiner E-Mail an.', 'Synchron auf deinen Macs und bei deinen Agenten.', 'Nichts zu betreiben.'],
      limit: 'Die kostenlosen Plätze in todz cloud sind extrem begrenzt. Selbst-Hosting steht immer offen.',
      cta: 'Download für Mac',
    },
    selfHost: {
      title: 'Selbst hosten',
      badge: 'Open Source',
      body: 'Betreibe den Server in deinem eigenen Cloudflare-Account. Dieselbe App: Wechsle den Server in den Einstellungen.',
      cta: 'Anleitung zum Server-Setup',
      terminal: {
        label: 'Der Deploy-Schritt der Self-Host-Anleitung',
        command: `pnpm --filter @todz/api ${SERVER_DEPLOY_SCRIPT}`,
        ready: 'todz server ready: https://api.example.com',
        next: '→ füge sie in todz › Einstellungen › Server ein',
      },
    },
    note: 'Die App ist in beiden Fällen dieselbe und aktualisiert sich selbst.',
  },
  openSource: {
    starLabel: 'Auf GitHub mit Stern markieren',
    license: 'Lizenz',
    contributing: 'Beitragen',
  },
  signature: {
    line: 'Von einem Entwickler gebaut, für Entwickler und KI-Tüftler.',
    name: AUTHOR.name,
  },
  stage: {
    label: 'Die todz-App auf einem Mac-Schreibtisch',
    menuCount: '2',
  },
  benefits: {
    heading: 'Warum todz',
    day: {
      eyebrow: 'Es kommt zu dir',
      title: 'todz wartet nicht darauf, geöffnet zu werden.',
      railLabel: 'Ein Tag mit todz, von 07:00 bis 18:00',
      email: {
        time: '07:00',
        subject: `Dein Tag: ${EXAMPLE_DUE_COUNT} fällig`,
        title: 'Dein Tag per E-Mail',
        body: 'Antworte, um eine Aufgabe hinzuzufügen.',
      },
      glance: {
        time: '09:00',
        heading: 'Heute',
        count: `${EXAMPLE_DUE_COUNT} übrig`,
        rows: [EXAMPLE_TASK_TITLE, EXAMPLE_SECOND_TASK_TITLE],
        title: 'Morgenüberblick',
        body: 'Weck deinen Mac auf: Heute erscheint für ein paar Sekunden.',
      },
      agent: {
        time: '10:30',
        ask: 'Was steht in todz als Nächstes an?',
        toolCall: `todz - ${McpToolName.Next} (MCP)`,
        toolResult: MCP_COPY.agentNudge.line({
          summary: MCP_COPY.agentNudge.due(EXAMPLE_DUE_COUNT),
          taskId: formatShortId(EXAMPLE_TASK_NUMBER),
        }),
        title: 'Deine Agenten wissen Bescheid',
        body: 'Frag, was als Nächstes ansteht: Sie beginnen mit heute.',
      },
      close: {
        time: '18:00',
        count: `${EXAMPLE_DUE_COUNT} übrig`,
        task: `${formatShortId(EXAMPLE_TASK_NUMBER)} ${EXAMPLE_TASK_TITLE}`,
        actions: ['Erledigt', 'Morgen', 'Kein Datum'],
        title: 'Tag abschließen',
        body: 'Jede Aufgabe: Erledigt, Morgen oder Kein Datum.',
      },
      extras: {
        label: 'Außerdem auf deinem Mac',
        ribbon: {
          label: 'Band der Menüleiste',
          detail: `${EXAMPLE_DUE_COUNT} übrig · als Nächstes: ${formatShortId(EXAMPLE_TASK_NUMBER)} ${EXAMPLE_TASK_TITLE}`,
        },
        temperature: { label: 'Tagestemperatur', detail: 'Der Zähler verblasst nach dem Mittag.' },
        siri: { label: 'Siri', detail: '„Was steht heute noch an in todz?“' },
      },
      note: 'Jedes davon außer Siri ist ein Schalter in den Einstellungen. „Fokus respektieren“ hält deinen Mac während eines Fokus ruhig.',
    },
    agents: {
      title: 'Agenten fügen Aufgaben über MCP hinzu',
      body: 'Claude Code, Codex und Cursor lesen, fügen hinzu und erledigen deine Aufgaben. Jede Änderung zeigt, von wem sie stammt.',
    },
    offline: {
      title: 'Funktioniert offline, synchronisiert überall',
      body: 'Änderungen warten, solange du offline bist, und landen auf jedem Mac, sobald du wieder online bist.',
    },
    lock: {
      title: 'Workspaces mit Privatsphäre zuerst',
      body: 'Jeder Workspace bleibt auf deinem Bildschirm und in deinen Widgets getrennt. Touch ID schützt jeden Wechsel.',
    },
  },
  howItWorks: {
    eyebrow: 'So funktioniert es',
    title: 'Einmal verbinden. In einfachen Worten fragen.',
    step1: 'Füge den Server hinzu: ein Befehl, dann anmelden.',
    step2: 'Bitte deinen Agenten, eine Aufgabe hinzuzufügen, aufzulisten oder zu erledigen.',
    step3: 'Sie erscheint in deiner Menüleiste und in deinen Widgets.',
  },
  terminal: {
    label: 'todz zu Claude Code hinzufügen, dann eine Aufgabe hinzufügen',
    shellPrompt: '$',
    command: agentSetupOf({ client: AgentClient.ClaudeCode, serverUrl: MCP_URL }),
    askPrompt: '>',
    ask: 'Füge eine todz-Aufgabe hinzu: PR prüfen',
    toolCall: `todz - ${McpToolName.Add} (MCP)(tasks: [{"title": "${EXAMPLE_TASK_TITLE}"}])`,
    toolResult: `${MCP_COPY.added} ${formatShortId(EXAMPLE_TASK_NUMBER)} ${EXAMPLE_TASK_TITLE}`,
  },
  final: {
    title: 'Hol dir todz auf deinen Mac.',
  },
  alt: {
    window: 'Das todz-Hauptfenster: die Aufgaben eines Projekts, eine über Claude Code hinzugefügt, mit Notizen und Verlauf im Inspektor',
    windowDark: 'Das todz-Hauptfenster im Dunkelmodus: drei über Claude Code hinzugefügte Aufgaben',
    popover: 'Das todz-Popover der Menüleiste: die heutigen Aufgaben und ein Feld „Aufgabe hinzufügen“',
    widgetMedium: 'Das mittlere Heute-Widget mit drei offenen Aufgaben',
    agentTasks: 'Die Aufgaben eines Projekts in todz, die neueste über Claude Code hinzugefügt',
    workspaceLock: 'Die todz-Seitenleiste, die nur den aktuellen Workspace und seine Listen zeigt',
  },
};
