import type { WelcomeEmailCopy } from './welcome-email-copy';
import { EmailSlot } from '../../src/emails/email-slot';

export const WELCOME_EMAIL_COPY_SPANISH: WelcomeEmailCopy = {
  subject: 'Te damos la bienvenida a todz',
  preview: 'Tu cuenta de todz está lista',
  heading: 'Ya estás dentro. Te damos la bienvenida a todz.',
  intro: `Tu cuenta de todz para ${EmailSlot.Email} está lista. todz es una lista de tareas que compartes con tus agentes de IA.`,
  start: 'Conecta un agente mediante MCP y pídele que añada tu primera tarea, o añade una tú mismo desde la barra de menús.',
  signoff: 'Feliz entrega.',
  footer: `Recibiste este correo porque ${EmailSlot.Email} inició sesión en todz.`,
};
