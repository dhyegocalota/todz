import type { Env } from './env';
import { enumValueOf } from './enum-value';
import { isLocalOrigin } from './local-origin';

const SENDER_ADDRESS: EmailAddress = { name: 'todz', email: 'noreply@todz.app' };

export enum EmailSenderKind {
  Console = 'console',
  Cloudflare = 'cloudflare',
}

export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo: string;
  headers?: Record<string, string>;
};

export type EmailSender = { send(message: EmailMessage): Promise<void> };

type EmailSenderFactory = (binding: SendEmail | undefined) => EmailSender | null;

// NB ADR 0041: the console sender only logs, so a deployed origin never selects it.
const EMAIL_SENDER_FACTORY_OF_KIND: Record<EmailSenderKind, EmailSenderFactory> = {
  [EmailSenderKind.Console]: () => ({
    async send({ to, replyTo, text }) {
      console.log(JSON.stringify({ to, replyTo, text }));
    },
  }),
  [EmailSenderKind.Cloudflare]: (binding) => {
    if (binding === undefined) return null;
    return {
      async send({ to, subject, html, text, replyTo, headers }) {
        await binding.send({ from: SENDER_ADDRESS, replyTo, to, subject, html, text, headers });
      },
    };
  },
};

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
  const kind = enumValueOf({ enumeration: EmailSenderKind, candidate: configured });
  if (kind === null) return null;
  const isConsoleOnPublicHost = kind === EmailSenderKind.Console && !(isLocalOrigin(publicOrigin) && isLocalOrigin(requestUrl));
  if (isConsoleOnPublicHost) return null;
  return EMAIL_SENDER_FACTORY_OF_KIND[kind](binding);
}

export function emailSenderForOrigin({ env, origin }: { env: Env; origin: string | null }): EmailSender | null {
  if (origin === null) return null;
  return emailSenderOf({ configured: env.EMAIL_SENDER, publicOrigin: origin, requestUrl: origin, binding: env.EMAIL });
}
