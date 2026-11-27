import type { CloudPageCopy } from './cloud-page-copy';
export const CLOUD_PAGE_COPY_GERMAN: CloudPageCopy = {
  fullMail: {
    subject: 'todz cloud ist gerade voll',
    textOf: ({ queueUrl, selfHostUrl }: { queueUrl: string; selfHostUrl: string }): string =>
      `todz cloud ist gerade voll: Die kostenlosen Plätze in todz cloud sind extrem begrenzt. Bestätige deine Adresse, um dich in die Warteschlange einzureihen, dann kommst du rein, sobald ein Platz frei wird: ${queueUrl}\n\nOder betreibe deinen eigenen Server, der immer offen steht: ${selfHostUrl}`,
  },
  queuePage: {
    title: 'In die Warteschlange für todz cloud',
    lead: 'Die kostenlosen Plätze in todz cloud sind extrem begrenzt. Bestätige unten, dann schreiben wir dir, sobald einer frei wird.',
    joinAs: 'Der Warteschlange beitreten als',
    invalidTitle: 'Dieser Link ist nicht mehr gültig',
    invalidBody:
      'Der Link in der Mail, die wir gesendet haben, als todz cloud voll war, gilt eine Woche. Fordere in der App einen neuen Anmeldelink an, um einen neuen zu bekommen.',
    submit: 'In die Warteschlange',
    submitting: 'Wird gesendet…',
    queuedTitle: 'Du stehst auf der Liste',
    queuedBody: 'Wir schreiben dir, sobald ein Platz frei wird.',
    tryAgain: 'Du konntest gerade nicht hinzugefügt werden. Versuche es in einer Minute erneut.',
    closed: 'Die Warteschlange ist gerade geschlossen.',
    forbidden: 'Diese Anfrage kam nicht von dieser Website.',
    selfHost: 'Oder betreibe deinen eigenen Server, der immer offen steht:',
    selfHostLink: 'Self-Host-Anleitung',
  },
};
