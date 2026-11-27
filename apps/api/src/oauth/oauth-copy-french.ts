import type { OAuthCopy } from './oauth-copy';
export const OAUTH_COPY_FRENCH: OAuthCopy = {
  meta: {
    description: 'Connectez une app à votre compte todz.',
    signInTitle: 'Connecter une app · todz',
    inboxTitle: 'Consultez votre boîte de réception · todz',
    consentTitle: 'Approuver une app · todz',
    refusedTitle: 'Connexion impossible · todz',
    linkTitle: 'Connexion · todz',
    returnTitle: 'Retour à l’app · todz',
    approvedTitle: 'Déjà approuvée · todz',
  },
  signIn: {
    titleOf: (clientName: string) => `Connectez-vous pour connecter ${clientName}`,
    lead: 'Saisissez l’adresse de votre compte todz. Un lien vous est envoyé par e-mail, et il s’ouvre dans ce navigateur.',
    emailLabel: 'Adresse e-mail',
    emailPlaceholder: 'vous@example.com',
    submit: 'M’envoyer un lien par e-mail',
    submitting: 'Envoi…',
    invalidAddress: 'Saisissez une adresse e-mail valide.',
    tooMany: 'Impossible d’envoyer un lien pour le moment. Réessayez dans une minute.',
    unavailable: 'La connexion pour connecter des apps n’est pas disponible sur ce serveur.',
  },
  inbox: {
    title: 'Consultez votre boîte de réception',
    body: 'Si cette adresse peut se connecter, un lien est en route. Il fonctionne une seule fois, dans ce navigateur, et vous ramène ici.',
  },
  consent: {
    titleOf: (clientName: string) => `Connecter ${clientName} à todz ?`,
    redirectOf: (host: string) => `Après votre réponse, todz vous renvoie vers ${host}.`,
    loopbackRedirectOf: (host: string) => `Après votre réponse, todz vous renvoie vers ${host}, une app sur cet ordinateur.`,
    legend: 'À quoi peut-elle accéder ?',
    projectHint:
      'Un projet lui permet de lire et de modifier les tâches de ce projet, et de les déplacer vers les autres projets de son espace de travail.',
    ownerLabel: 'Tout votre compte (portée propriétaire)',
    ownerWarning:
      'Il peut lire et modifier toutes les tâches, et créer, renommer et supprimer tous les espaces de travail et tous les projets.',
    noProjects: 'Vous n’avez pas encore de projet. Créez-en un dans l’app todz, puis revenez.',
    approve: 'Approuver',
    approving: 'Approbation…',
    deny: 'Refuser',
  },
  return: {
    titleOf: (clientName: string) => `Retour vers ${clientName}`,
    body: 'Si elle ne s’ouvre pas toute seule, utilisez le lien.',
    actionOf: (clientName: string) => `Retourner à ${clientName}`,
  },
  approved: {
    title: 'Déjà approuvée',
    bodyOf: (clientName: string) =>
      `Cette demande a déjà été approuvée. Retournez à ${clientName} pour terminer la connexion. Si elle le redemande, recommencez depuis ${clientName}.`,
  },
  refusal: {
    invalidTitle: 'Ce lien ne peut pas être utilisé pour connecter une app',
    invalidBody:
      'Recommencez depuis l’app que vous connectez. Si vous atterrissez toujours ici, effacez d’abord sa connexion enregistrée (dans Claude Code : /mcp, puis Clear authentication).',
    choiceTitle: 'Ce choix n’est pas disponible',
    choiceBody: 'Recommencez depuis l’app que vous connectez et choisissez l’une des options affichées.',
    forbiddenTitle: 'Requête refusée',
    forbiddenBody: 'Cette requête ne vient pas de cette page. Recommencez depuis l’app que vous connectez.',
  },
  link: {
    working: 'Connexion en cours…',
    failedTitle: 'Ce lien ne peut pas être utilisé.',
    failedBody: 'Demandez-en un nouveau depuis ce navigateur.',
    failedAction: 'Obtenir un nouveau lien',
    cloudFullTitle: 'todz cloud est complet pour le moment',
    cloudFullBodyOf: ({ selfHostUrl }: { selfHostUrl: string }) =>
      `todz cloud est complet pour le moment. Laissez votre e-mail et vous entrerez quand une place se libérera, ou faites tourner votre propre serveur : ${selfHostUrl}`,
    noScriptTitle: 'Terminer la connexion',
    noScript: 'Cette page a besoin de JavaScript pour terminer votre connexion. Activez-le, puis rouvrez le lien.',
  },
};
