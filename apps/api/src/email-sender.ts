import { enumValueOf } from './enum-value';

const LOCAL_HOSTNAMES = ['localhost', '127.0.0.1'];

export enum EmailSenderKind {
  Console = 'console',
}

export type EmailMessage = { to: string; subject: string; text: string };

export type EmailSender = { send(message: EmailMessage): Promise<void> };

// NB ADR 0041: the console sender only logs, so a deployed origin never selects it.
const EMAIL_SENDER_OF_KIND: Record<EmailSenderKind, EmailSender> = {
  [EmailSenderKind.Console]: {
    async send({ to, text }) {
      console.log(JSON.stringify({ to, text }));
    },
  },
};

export function emailSenderOf({ configured, publicOrigin }: { configured: string | undefined; publicOrigin: string }): EmailSender | null {
  const kind = enumValueOf({ enumeration: EmailSenderKind, configured });
  if (kind === null) return null;
  const isConsoleOnPublicOrigin = kind === EmailSenderKind.Console && !LOCAL_HOSTNAMES.includes(new URL(publicOrigin).hostname);
  if (isConsoleOnPublicOrigin) return null;
  return EMAIL_SENDER_OF_KIND[kind];
}
