import type { EmailMessage } from '../email-sender';
import { type EmailSlotValues, filledHtmlOf, filledTextOf } from './email-slot';
import type { GeneratedEmail } from './generated-email';

const HELLO_ADDRESS = 'hello@todz.app';

export function filledEmailOf({
  email,
  values,
  to,
  subject = email.subject,
  replyTo = HELLO_ADDRESS,
}: {
  email: GeneratedEmail;
  values: EmailSlotValues;
  to: string;
  subject?: string;
  replyTo?: string;
}): EmailMessage {
  return {
    to,
    subject,
    replyTo,
    html: filledHtmlOf({ html: email.html, values }),
    text: filledTextOf({ text: email.text, values }),
  };
}
