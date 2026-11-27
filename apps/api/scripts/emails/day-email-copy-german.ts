import type { DayEmailCopy, DayEmailEmptyCopy } from './day-email-copy';
import { EmailSlot } from '../../src/emails/email-slot';

const SHARED_COPY = {
  replyHint: `Antworte von der Adresse, mit der du dich anmeldest, in einer Zeile, um sie zu Heute in der Inbox von ${EmailSlot.Workspace} hinzuzufügen.`,
  footer: `Gesendet um ${EmailSlot.Time}, weil „Meinen Tag per E-Mail senden“ in den todz-Einstellungen an ist, wo es standardmäßig eingeschaltet ist.`,
  stopLabel: 'Diese E-Mails beenden',
};

export const DAY_EMAIL_COPY_GERMAN: DayEmailCopy = {
  ...SHARED_COPY,
  subject: `Dein Tag: ${EmailSlot.Count} fällig`,
  preview: `${EmailSlot.Count} heute fällig in todz. Antworte, um eine Aufgabe hinzuzufügen.`,
  heading: `${EmailSlot.Count} heute fällig`,
};

export const DAY_EMAIL_EMPTY_COPY_GERMAN: DayEmailEmptyCopy = {
  ...SHARED_COPY,
  subject: 'Dein Tag: nichts fällig',
  preview: 'Heute ist in todz nichts fällig. Antworte, um eine Aufgabe hinzuzufügen.',
  heading: 'Heute ist nichts fällig',
};
