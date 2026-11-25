import type { EmailMessage } from '../email-sender';
import { type EmailSlotValues, filledHtmlOf, filledTextOf } from './email-slot';
import type { GeneratedEmail } from './generated-email';

export function filledEmailOf({
  email,
  values,
  to,
  subject = email.subject,
}: {
  email: GeneratedEmail;
  values: EmailSlotValues;
  to: string;
  subject?: string;
}): EmailMessage {
  return {
    to,
    subject,
    html: filledHtmlOf({ html: email.html, values }),
    text: filledTextOf({ text: email.text, values }),
  };
}
