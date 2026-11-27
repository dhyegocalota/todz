import type { CloudPageCopy } from './cloud-page-copy';
export const CLOUD_PAGE_COPY_FRENCH: CloudPageCopy = {
  fullMail: {
    subject: 'todz cloud est complet pour le moment',
    textOf: ({ queueUrl, selfHostUrl }: { queueUrl: string; selfHostUrl: string }): string =>
      `todz cloud est complet pour le moment : les places gratuites sur todz cloud sont extrêmement limitées. Confirmez votre adresse pour entrer dans la file d’attente, et vous entrerez quand une place se libérera : ${queueUrl}\n\nOu faites tourner votre propre serveur, toujours ouvert : ${selfHostUrl}`,
  },
  queuePage: {
    title: 'Entrer dans la file d’attente de todz cloud',
    lead: 'Les places gratuites sur todz cloud sont extrêmement limitées. Confirmez ci-dessous et nous vous écrirons quand une place se libérera.',
    joinAs: 'Rejoindre la file d’attente en tant que',
    invalidTitle: 'Ce lien n’est plus valide',
    invalidBody:
      'Le lien du message envoyé quand todz cloud était complet fonctionne pendant une semaine. Demandez un nouveau lien de connexion dans l’app pour en obtenir un nouveau.',
    submit: 'Entrer dans la file d’attente',
    submitting: 'Envoi…',
    queuedTitle: 'Vous êtes sur la liste',
    queuedBody: 'Nous vous écrirons quand une place se libérera.',
    tryAgain: 'Impossible de vous ajouter pour le moment. Réessayez dans une minute.',
    closed: 'La file d’attente est fermée pour le moment.',
    forbidden: 'Cette requête ne vient pas de ce site.',
    selfHost: 'Ou faites tourner votre propre serveur, toujours ouvert :',
    selfHostLink: 'guide d’auto-hébergement',
  },
};
