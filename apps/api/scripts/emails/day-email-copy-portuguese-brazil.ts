import type { DayEmailCopy, DayEmailEmptyCopy } from './day-email-copy';
import { EmailSlot } from '../../src/emails/email-slot';

const SHARED_COPY = {
  replyHint: `Responda do endereço com que você entra, em uma linha, para adicionar a tarefa a Hoje na Caixa de entrada de ${EmailSlot.Workspace}.`,
  footer: `Enviado às ${EmailSlot.Time} porque Receber meu dia por e-mail está ativado nos Ajustes do todz, onde ele já vem ativado.`,
  stopLabel: 'Parar estes e-mails',
};

export const DAY_EMAIL_COPY_PORTUGUESE_BRAZIL: DayEmailCopy = {
  ...SHARED_COPY,
  subject: `Seu dia: ${EmailSlot.Count} para hoje`,
  preview: `${EmailSlot.Count} para hoje no todz. Responda para adicionar uma tarefa.`,
  heading: `${EmailSlot.Count} para hoje`,
};

export const DAY_EMAIL_EMPTY_COPY_PORTUGUESE_BRAZIL: DayEmailEmptyCopy = {
  ...SHARED_COPY,
  subject: 'Seu dia: nada para hoje',
  preview: 'Nada para hoje no todz. Responda para adicionar uma tarefa.',
  heading: 'Nada para hoje',
};
