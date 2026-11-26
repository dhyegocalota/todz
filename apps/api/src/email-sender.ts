import { MAIL_SENDER_ADDRESS } from '@todz/types';
import { mailMeterOf, recordMail } from './cloud-mail-meter';
import { logCrash } from './crash-log';
import type { Env } from './env';
import { enumValueOf } from './enum-value';
import { isLocalOrigin } from './local-origin';

const SENDER_ADDRESS: EmailAddress = { name: 'todz', email: MAIL_SENDER_ADDRESS };
export const REPLY_TO_ADDRESS = 'hello@todz.app';

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

type EmailSenderFactory = ({ binding, meter }: { binding: SendEmail | undefined; meter: D1Database | null }) => EmailSender | null;

// NB ADR 0041: the console sender only logs, so a deployed origin never selects it.
const EMAIL_SENDER_FACTORY_OF_KIND: Record<EmailSenderKind, EmailSenderFactory> = {
  [EmailSenderKind.Console]: () => ({
    async send({ to, replyTo, text }) {
      console.log(JSON.stringify({ to, replyTo, text }));
    },
  }),
  [EmailSenderKind.Cloudflare]: ({ binding, meter }) => {
    if (binding === undefined) return null;
    return {
      async send({ to, subject, html, text, replyTo, headers }) {
        await binding.send({ from: SENDER_ADDRESS, replyTo, to, subject, html, text, headers });
        if (meter === null) return;
        await recordMail({ directory: meter, address: to, now: Date.now() }).catch(logCrash);
      },
    };
  },
};

export function emailSenderOf({
  configured,
  publicOrigin,
  requestUrl,
  binding,
  meter,
}: {
  configured: string | undefined;
  publicOrigin: string;
  requestUrl: string;
  binding?: SendEmail;
  meter: D1Database | null;
}): EmailSender | null {
  const kind = enumValueOf({ enumeration: EmailSenderKind, candidate: configured });
  if (kind === null) return null;
  const isConsoleOnPublicHost = kind === EmailSenderKind.Console && !(isLocalOrigin(publicOrigin) && isLocalOrigin(requestUrl));
  if (isConsoleOnPublicHost) return null;
  return EMAIL_SENDER_FACTORY_OF_KIND[kind]({ binding, meter });
}

export function emailSenderForOrigin({ env, origin }: { env: Env; origin: string | null }): EmailSender | null {
  if (origin === null) return null;
  return emailSenderOf({
    configured: env.EMAIL_SENDER,
    publicOrigin: origin,
    requestUrl: origin,
    binding: env.EMAIL,
    meter: mailMeterOf(env),
  });
}
