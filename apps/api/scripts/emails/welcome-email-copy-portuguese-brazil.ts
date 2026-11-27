import type { WelcomeEmailCopy } from './welcome-email-copy';
import { EmailSlot } from '../../src/emails/email-slot';

export const WELCOME_EMAIL_COPY_PORTUGUESE_BRAZIL: WelcomeEmailCopy = {
  subject: 'Boas-vindas ao todz',
  preview: 'Sua conta do todz está pronta',
  heading: 'Tudo certo. Boas-vindas ao todz.',
  intro: `Sua conta do todz para ${EmailSlot.Email} está pronta. O todz é uma lista de tarefas só, que você e seus agentes de IA compartilham.`,
  start: 'Conecte um agente por MCP e peça a ele para adicionar a sua primeira tarefa, ou adicione uma você mesmo pela barra de menus.',
  signoff: 'Bom trabalho.',
  footer: `Você recebeu este e-mail porque ${EmailSlot.Email} entrou no todz.`,
};
