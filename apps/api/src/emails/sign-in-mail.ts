import type { Language } from '@todz/types';
import type { EmailMessage } from '../email-sender';
import { EmailSlot } from './email-slot';
import { filledEmailOf } from './filled-email';
import { SIGN_IN_EMAIL } from './generated/email-templates';

export function signInMail({
  to,
  link,
  code,
  origin,
  language,
}: {
  to: string;
  link: string;
  code: string;
  origin: string;
  language: Language;
}): EmailMessage {
  return filledEmailOf({
    email: SIGN_IN_EMAIL[language],
    values: { [EmailSlot.Link]: link, [EmailSlot.Code]: code, [EmailSlot.Origin]: origin },
    to,
  });
}
