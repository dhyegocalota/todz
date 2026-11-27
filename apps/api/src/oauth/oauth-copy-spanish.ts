import type { OAuthCopy } from './oauth-copy';
export const OAUTH_COPY_SPANISH: OAuthCopy = {
  meta: {
    description: 'Conecta una app a tu cuenta de todz.',
    signInTitle: 'Conectar una app · todz',
    inboxTitle: 'Revisa tu bandeja de entrada · todz',
    consentTitle: 'Aprobar una app · todz',
    refusedTitle: 'No se puede conectar · todz',
    linkTitle: 'Iniciando sesión · todz',
    returnTitle: 'Volviendo a la app · todz',
    approvedTitle: 'Ya aprobada · todz',
  },
  signIn: {
    titleOf: (clientName: string) => `Inicia sesión para conectar ${clientName}`,
    lead: 'Introduce la dirección de tu cuenta de todz. Te enviamos un enlace por correo, y se abre en este navegador.',
    emailLabel: 'Dirección de correo',
    emailPlaceholder: 'tu@example.com',
    submit: 'Envíame un enlace por correo',
    submitting: 'Enviando…',
    invalidAddress: 'Introduce una dirección de correo válida.',
    tooMany: 'No se pudo enviar un enlace en este momento. Vuelve a intentarlo en un minuto.',
    unavailable: 'Iniciar sesión para conectar apps no está disponible en este servidor.',
  },
  inbox: {
    title: 'Revisa tu bandeja de entrada',
    body: 'Si esa dirección puede iniciar sesión, un enlace va en camino. Funciona una sola vez, en este navegador, y te trae de vuelta aquí.',
  },
  consent: {
    titleOf: (clientName: string) => `¿Conectar ${clientName} a todz?`,
    redirectOf: (host: string) => `Cuando respondas, todz te devuelve a ${host}.`,
    loopbackRedirectOf: (host: string) => `Cuando respondas, todz te devuelve a ${host}, una app de este ordenador.`,
    legend: '¿A qué puede acceder?',
    projectHint: 'Un proyecto le permite leer y cambiar las tareas de ese proyecto, y moverlas a los otros proyectos de su espacio de trabajo.',
    ownerLabel: 'Toda tu cuenta (ámbito de propietario)',
    ownerWarning: 'Puede leer y cambiar todas las tareas, y crear, renombrar y eliminar todos los espacios de trabajo y proyectos.',
    noProjects: 'Todavía no tienes proyectos. Crea uno en la app de todz y vuelve.',
    approve: 'Aprobar',
    approving: 'Aprobando…',
    deny: 'Denegar',
  },
  return: {
    titleOf: (clientName: string) => `Volviendo a ${clientName}`,
    body: 'Si no se abre solo, usa el enlace.',
    actionOf: (clientName: string) => `Volver a ${clientName}`,
  },
  approved: {
    title: 'Ya aprobada',
    bodyOf: (clientName: string) =>
      `Esta solicitud ya se aprobó. Vuelve a ${clientName} para terminar de conectar. Si todavía te lo pide, empieza de nuevo desde ${clientName}.`,
  },
  refusal: {
    invalidTitle: 'Este enlace no se puede usar para conectar una app',
    invalidBody:
      'Empieza de nuevo desde la app que estás conectando. Si sigues llegando aquí, borra primero su inicio de sesión guardado (en Claude Code: /mcp y luego Clear authentication).',
    choiceTitle: 'Esa opción no está disponible',
    choiceBody: 'Empieza de nuevo desde la app que estás conectando y elige una de las opciones que se muestran.',
    forbiddenTitle: 'Solicitud rechazada',
    forbiddenBody: 'Esa solicitud no vino de esta página. Empieza de nuevo desde la app que estás conectando.',
  },
  link: {
    working: 'Iniciando tu sesión…',
    failedTitle: 'Este enlace no se puede usar.',
    failedBody: 'Pide uno nuevo desde este navegador.',
    failedAction: 'Obtener un enlace nuevo',
    cloudFullTitle: 'todz cloud está lleno en este momento',
    cloudFullBodyOf: ({ selfHostUrl }: { selfHostUrl: string }) =>
      `todz cloud está lleno en este momento. Deja tu correo y entrarás cuando se abra un cupo, o ejecuta tu propio servidor: ${selfHostUrl}`,
    noScriptTitle: 'Termina de iniciar sesión',
    noScript: 'Esta página necesita JavaScript para terminar de iniciar tu sesión. Actívalo y vuelve a abrir el enlace.',
  },
};
