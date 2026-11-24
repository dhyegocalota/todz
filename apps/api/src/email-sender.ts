import { enumValueOf } from './enum-value';

const LOCAL_HOSTNAMES = ['localhost', '127.0.0.1'];

export enum EmailSenderKind {
  Console = 'console',
  Cloudflare = 'cloudflare',
}

export type EmailMessage = { to: string; subject: string; html: string; text: string };

export type EmailSender = { send(message: EmailMessage): Promise<void> };

type EmailSenderFactory = (binding: SendEmail | undefined) => EmailSender | null;

// NB ADR 0041: the console sender only logs, so a deployed origin never selects it.
const EMAIL_SENDER_FACTORY_OF_KIND: Record<EmailSenderKind, EmailSenderFactory> = {
  [EmailSenderKind.Console]: () => ({
    async send({ to, text }) {
      console.log(JSON.stringify({ to, text }));
    },
  }),
  [EmailSenderKind.Cloudflare]: () => ({
    async send() {
      throw new Error('the cloudflare sender is not implemented');
    },
  }),
};

export function isLocalOrigin(origin: string): boolean {
  return LOCAL_HOSTNAMES.includes(new URL(origin).hostname);
}

export function emailSenderOf({
  configured,
  publicOrigin,
  requestUrl,
  binding,
}: {
  configured: string | undefined;
  publicOrigin: string;
  requestUrl: string;
  binding?: SendEmail;
}): EmailSender | null {
  const kind = enumValueOf({ enumeration: EmailSenderKind, configured });
  if (kind === null) return null;
  const isConsoleOnPublicHost = kind === EmailSenderKind.Console && !(isLocalOrigin(publicOrigin) && isLocalOrigin(requestUrl));
  if (isConsoleOnPublicHost) return null;
  return EMAIL_SENDER_FACTORY_OF_KIND[kind](binding);
}
