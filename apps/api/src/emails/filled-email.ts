import { type EmailMessage, REPLY_TO_ADDRESS } from '../email-sender';
import { type EmailSlotValues, filledHtmlOf, filledTextOf } from './email-slot';
import type { GeneratedEmail } from './generated-email';

export function filledEmailOf({
  email,
  values,
  to,
  subject = email.subject,
  replyTo = REPLY_TO_ADDRESS,
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
