import type { DayEmailCopy, DayEmailEmptyCopy } from './day-email-copy';
import { EmailSlot } from '../../src/emails/email-slot';

const SHARED_COPY = {
  replyHint: `Responde desde la dirección con la que inicias sesión, en una sola línea, para añadirla a Hoy en el Inbox de ${EmailSlot.Workspace}.`,
  footer: `Enviado a las ${EmailSlot.Time} porque Enviarme mi día por correo está activado en los Ajustes de todz, donde viene activado por defecto.`,
  stopLabel: 'Dejar de recibir estos correos',
};

export const DAY_EMAIL_COPY_SPANISH: DayEmailCopy = {
  ...SHARED_COPY,
  subject: `Tu día: vencen ${EmailSlot.Count}`,
  preview: `Hoy vencen ${EmailSlot.Count} en todz. Responde para añadir una tarea.`,
  heading: `Hoy vencen ${EmailSlot.Count}`,
};

export const DAY_EMAIL_EMPTY_COPY_SPANISH: DayEmailEmptyCopy = {
  ...SHARED_COPY,
  subject: 'Tu día: no vence nada',
  preview: 'Hoy no vence nada en todz. Responde para añadir una tarea.',
  heading: 'Hoy no vence nada',
};
