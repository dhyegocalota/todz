import type { DayEmailCopy, DayEmailEmptyCopy } from './day-email-copy';
import { EmailSlot } from '../../src/emails/email-slot';

const SHARED_COPY = {
  replyHint: `Répondez depuis l’adresse avec laquelle vous vous connectez, en une ligne, pour l’ajouter à Aujourd’hui dans la Boîte de réception de ${EmailSlot.Workspace}.`,
  footer: `Envoyé à ${EmailSlot.Time} parce que « M’envoyer ma journée par e-mail » est activé dans les Réglages de todz, où il l’est par défaut.`,
  stopLabel: 'Arrêter ces e-mails',
};

export const DAY_EMAIL_COPY_FRENCH: DayEmailCopy = {
  ...SHARED_COPY,
  subject: `Votre journée : ${EmailSlot.Count} pour aujourd’hui`,
  preview: `${EmailSlot.Count} pour aujourd’hui dans todz. Répondez pour ajouter une tâche.`,
  heading: `${EmailSlot.Count} pour aujourd’hui`,
};

export const DAY_EMAIL_EMPTY_COPY_FRENCH: DayEmailEmptyCopy = {
  ...SHARED_COPY,
  subject: 'Votre journée : rien de prévu',
  preview: 'Rien pour aujourd’hui dans todz. Répondez pour ajouter une tâche.',
  heading: 'Rien pour aujourd’hui',
};
