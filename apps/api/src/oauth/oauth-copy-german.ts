import type { OAuthCopy } from './oauth-copy';
export const OAUTH_COPY_GERMAN: OAuthCopy = {
  meta: {
    description: 'Verbinde eine App mit deinem todz-Konto.',
    signInTitle: 'Eine App verbinden · todz',
    inboxTitle: 'Prüfe dein Postfach · todz',
    consentTitle: 'Eine App genehmigen · todz',
    refusedTitle: 'Verbindung nicht möglich · todz',
    linkTitle: 'Anmeldung läuft · todz',
    returnTitle: 'Zurück zur App · todz',
    approvedTitle: 'Bereits genehmigt · todz',
  },
  signIn: {
    titleOf: (clientName: string) => `Melde dich an, um ${clientName} zu verbinden`,
    lead: 'Gib die Adresse deines todz-Kontos ein. Ein Link wird dir per E-Mail gesendet und öffnet sich in diesem Browser.',
    emailLabel: 'E-Mail-Adresse',
    emailPlaceholder: 'du@example.com',
    submit: 'Link per E-Mail senden',
    submitting: 'Wird gesendet…',
    invalidAddress: 'Gib eine gültige E-Mail-Adresse ein.',
    tooMany: 'Ein Link konnte gerade nicht gesendet werden. Versuche es in einer Minute erneut.',
    unavailable: 'Die Anmeldung zum Verbinden von Apps ist auf diesem Server nicht verfügbar.',
  },
  inbox: {
    title: 'Prüfe dein Postfach',
    body: 'Wenn sich diese Adresse anmelden darf, ist ein Link unterwegs. Er funktioniert einmal, in diesem Browser, und bringt dich hierher zurück.',
  },
  consent: {
    titleOf: (clientName: string) => `${clientName} mit todz verbinden?`,
    redirectOf: (host: string) => `Nach deiner Antwort leitet todz dich zurück zu ${host}.`,
    loopbackRedirectOf: (host: string) => `Nach deiner Antwort leitet todz dich zurück zu ${host}, einer App auf diesem Computer.`,
    legend: 'Worauf darf sie zugreifen?',
    projectHint:
      'Ein Projekt erlaubt ihr, die Aufgaben dieses Projekts zu lesen und zu ändern und sie in die anderen Projekte seines Workspace zu verschieben.',
    ownerLabel: 'Dein ganzes Konto (Owner-Scope)',
    ownerWarning: 'Er kann jede Aufgabe lesen und ändern sowie jeden Workspace und jedes Projekt anlegen, umbenennen und löschen.',
    noProjects: 'Du hast noch keine Projekte. Lege in der todz-App eines an und komm dann zurück.',
    approve: 'Genehmigen',
    approving: 'Wird genehmigt…',
    deny: 'Ablehnen',
  },
  return: {
    titleOf: (clientName: string) => `Du wirst zu ${clientName} zurückgeleitet`,
    body: 'Öffnet es sich nicht von selbst, nutze den Link.',
    actionOf: (clientName: string) => `Zurück zu ${clientName}`,
  },
  approved: {
    title: 'Bereits genehmigt',
    bodyOf: (clientName: string) =>
      `Diese Anfrage wurde bereits genehmigt. Kehre zu ${clientName} zurück, um die Verbindung abzuschließen. Fragt es weiterhin, starte erneut von ${clientName} aus.`,
  },
  refusal: {
    invalidTitle: 'Dieser Link kann nicht verwendet werden, um eine App zu verbinden',
    invalidBody:
      'Starte erneut von der App aus, die du verbindest. Landest du immer wieder hier, lösche zuerst ihre gespeicherte Anmeldung (in Claude Code: /mcp, dann Clear authentication).',
    choiceTitle: 'Diese Auswahl ist nicht verfügbar',
    choiceBody: 'Starte erneut von der App aus, die du verbindest, und wähle eine der angezeigten Möglichkeiten.',
    forbiddenTitle: 'Anfrage abgelehnt',
    forbiddenBody: 'Diese Anfrage kam nicht von dieser Seite. Starte erneut von der App aus, die du verbindest.',
  },
  link: {
    working: 'Du wirst angemeldet…',
    failedTitle: 'Dieser Link kann nicht verwendet werden.',
    failedBody: 'Fordere in diesem Browser einen neuen an.',
    failedAction: 'Neuen Link anfordern',
    cloudFullTitle: 'todz cloud ist gerade voll',
    cloudFullBodyOf: ({ selfHostUrl }: { selfHostUrl: string }) =>
      `todz cloud ist gerade voll. Hinterlasse deine E-Mail-Adresse, dann kommst du rein, sobald ein Platz frei wird, oder betreibe deinen eigenen Server: ${selfHostUrl}`,
    noScriptTitle: 'Anmeldung abschließen',
    noScript: 'Diese Seite braucht JavaScript, um deine Anmeldung abzuschließen. Schalte es ein und öffne den Link dann erneut.',
  },
};
