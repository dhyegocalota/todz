import type { LandingCopy } from './landing-copy';
import { formatShortId } from '@todz/core';
import { AUTHOR, COMPANY } from '@todz/types';
import { MCP_COPY, McpToolName } from '../mcp-copy';
import { AgentClient, agentSetupOf } from './agent-setup';
import { MCP_URL } from './site-urls';

const EXAMPLE_TASK_NUMBER = 12;
const EXAMPLE_TASK_TITLE = 'Relire la PR';
const EXAMPLE_SECOND_TASK_TITLE = 'Livrer la bêta';
const EXAMPLE_DUE_COUNT = 3;
const SERVER_DEPLOY_SCRIPT = 'server:deploy';

export const LANDING_COPY_FRENCH: LandingCopy = {
  meta: {
    siteName: 'todz',
    title: 'todz : vos tâches, partagées avec vos agents',
    description:
      'Une liste de tâches native pour Mac que Claude Code, Codex et Cursor font travailler par MCP. Barre des menus, widgets, synchronisation hors connexion.',
  },
  shell: {
    skipLink: 'Aller au contenu',
    homeLabel: 'Accueil de todz',
    wordmark: 'todz',
    navLabel: 'Navigation du site',
    selfHostLink: 'Guide d’auto-hébergement',
    selfHostLinkShort: 'Auto-hébergement',
    installLink: 'Installer sur Mac',
    installLinkShort: 'Installer',
    githubLabel: 'todz sur GitHub',
    footerSelfHost: 'Guide d’auto-hébergement',
    footerInstall: 'Installer sur Mac',
    footerGithub: 'GitHub',
    languageLabel: 'Langue',
    themeLabel: 'Thème',
    themeSystem: 'Système',
    themeLight: 'Clair',
    themeDark: 'Sombre',
    creditPrefix: '© todz ·',
    creditLead: 'todz est un produit de',
    creditName: COMPANY.tradeName,
    creditTail: ', conçu au Brésil',
  },
  hero: {
    eyebrow: 'macOS 14 ou ultérieur',
    title: 'Vos tâches, partagées avec vos agents.',
    lead: 'Une liste de tâches native pour Mac que Claude Code, Codex et Cursor font travailler par MCP.',
  },
  download: {
    button: 'Télécharger pour Mac',
    heroButton: 'Télécharger pour Mac — gratuit',
    note: 'Pas encore notarisé par Apple : la première fois, ouvrez-le depuis Réglages Système › Confidentialité et sécurité.',
    noteLink: 'Étapes d’installation',
  },
  free: {
    line: 'Gratuit sur todz cloud — ou hébergez le vôtre.',
    linkText: 'hébergez le vôtre',
  },
  ways: {
    cloud: {
      title: 'todz cloud',
      badge: 'Gratuit',
      points: ['Connectez-vous avec votre e-mail.', 'Synchronisé entre vos Mac et vos agents.', 'Rien à faire tourner.'],
      limit: 'Les places gratuites sur todz cloud sont extrêmement limitées. L’auto-hébergement reste toujours ouvert.',
      cta: 'Télécharger pour Mac',
    },
    selfHost: {
      title: 'Auto-hébergement',
      badge: 'Open source',
      body: 'Faites tourner le serveur sur votre propre compte Cloudflare. Même app : changez le serveur dans les Réglages.',
      cta: 'Guide de configuration du serveur',
      terminal: {
        label: 'L’étape de déploiement du guide d’auto-hébergement',
        command: `pnpm --filter @todz/api ${SERVER_DEPLOY_SCRIPT}`,
        ready: 'todz server ready: https://api.example.com',
        next: '→ paste it in todz › Settings › Server',
      },
    },
    note: 'L’app est la même dans les deux cas, et se met à jour toute seule.',
  },
  openSource: {
    starLabel: 'Mettre une étoile sur GitHub',
    license: 'Licence',
    contributing: 'Contribuer',
  },
  signature: {
    line: 'Conçu par un développeur, pour les développeurs et les bidouilleurs d’IA.',
    name: AUTHOR.name,
  },
  stage: {
    label: 'L’app todz sur le bureau d’un Mac',
    menuCount: '2',
  },
  benefits: {
    heading: 'Pourquoi todz',
    day: {
      eyebrow: 'Il vient à vous',
      title: 'todz n’attend pas qu’on l’ouvre.',
      railLabel: 'Une journée avec todz, de 07:00 à 18:00',
      email: {
        time: '07:00',
        subject: `Votre journée : ${EXAMPLE_DUE_COUNT} pour aujourd’hui`,
        title: 'Votre journée, par e-mail',
        body: 'Répondez pour ajouter une tâche.',
      },
      glance: {
        time: '09:00',
        heading: 'Aujourd’hui',
        count: `${EXAMPLE_DUE_COUNT} restantes`,
        rows: [EXAMPLE_TASK_TITLE, EXAMPLE_SECOND_TASK_TITLE],
        title: 'Coup d’œil du matin',
        body: 'Réveillez votre Mac : Aujourd’hui s’affiche quelques secondes.',
      },
      agent: {
        time: '10:30',
        ask: 'Quelle est la suite dans todz ?',
        toolCall: `todz - ${McpToolName.Next} (MCP)`,
        toolResult: MCP_COPY.agentNudge.line({
          summary: MCP_COPY.agentNudge.due(EXAMPLE_DUE_COUNT),
          taskId: formatShortId(EXAMPLE_TASK_NUMBER),
        }),
        title: 'Vos agents savent',
        body: 'Demandez la suite : ils commencent par aujourd’hui.',
      },
      close: {
        time: '18:00',
        count: `${EXAMPLE_DUE_COUNT} restantes`,
        task: `${formatShortId(EXAMPLE_TASK_NUMBER)} ${EXAMPLE_TASK_TITLE}`,
        actions: ['Terminé', 'Demain', 'Sans date'],
        title: 'Clôturer la journée',
        body: 'Pour chaque tâche : Terminé, Demain ou Sans date.',
      },
      extras: {
        label: 'Aussi sur votre Mac',
        ribbon: {
          label: 'Ruban de la barre des menus',
          detail: `${EXAMPLE_DUE_COUNT} restantes · suivante : ${formatShortId(EXAMPLE_TASK_NUMBER)} ${EXAMPLE_TASK_TITLE}`,
        },
        temperature: { label: 'Température du jour', detail: 'Le compteur s’estompe après midi.' },
        siri: { label: 'Siri', detail: '« Qu’est-ce qu’il me reste aujourd’hui dans todz ? »' },
      },
      note: 'Chacune, sauf Siri, est un interrupteur dans les Réglages. Respecter la concentration garde votre Mac silencieux pendant un mode de concentration.',
    },
    agents: {
      title: 'Les agents ajoutent des tâches par MCP',
      body: 'Claude Code, Codex et Cursor lisent, ajoutent et terminent vos tâches. Chaque modification dit qui l’a faite.',
    },
    offline: {
      title: 'Fonctionne hors connexion, synchronise partout',
      body: 'Les modifications attendent pendant que vous êtes hors connexion et arrivent sur chaque Mac dès votre retour.',
    },
    lock: {
      title: 'Des espaces de travail respectueux de votre vie privée',
      body: 'Chaque espace de travail reste séparé sur votre écran et dans vos widgets. Touch ID protège chaque changement.',
    },
  },
  howItWorks: {
    eyebrow: 'Comment ça marche',
    title: 'Connectez une fois. Demandez avec des mots simples.',
    step1: 'Ajoutez le serveur : une commande, puis connectez-vous.',
    step2: 'Demandez à votre agent d’ajouter, de lister ou de terminer une tâche.',
    step3: 'Elle apparaît dans votre barre des menus et vos widgets.',
  },
  terminal: {
    label: 'Ajout de todz à Claude Code, puis ajout d’une tâche',
    shellPrompt: '$',
    command: agentSetupOf({ client: AgentClient.ClaudeCode, serverUrl: MCP_URL }),
    askPrompt: '>',
    ask: 'Ajoute une tâche todz : relire la PR',
    toolCall: `todz - ${McpToolName.Add} (MCP)(tasks: [{"title": "${EXAMPLE_TASK_TITLE}"}])`,
    toolResult: `${MCP_COPY.added} ${formatShortId(EXAMPLE_TASK_NUMBER)} ${EXAMPLE_TASK_TITLE}`,
  },
  final: {
    title: 'Installez todz sur votre Mac.',
  },
  alt: {
    window:
      'La fenêtre principale de todz : les tâches d’un projet, dont une ajoutée via Claude Code, avec ses notes et son historique dans l’inspecteur',
    windowDark: 'La fenêtre principale de todz en mode sombre : trois tâches ajoutées via Claude Code',
    popover: 'Le panneau de la barre des menus de todz : les tâches du jour et un champ Ajouter une tâche',
    widgetMedium: 'Le widget Aujourd’hui de taille moyenne avec trois tâches ouvertes',
    agentTasks: 'Les tâches d’un projet dans todz, la plus récente ajoutée via Claude Code',
    workspaceLock: 'La barre latérale de todz qui n’affiche que l’espace de travail actuel et ses listes',
  },
};
