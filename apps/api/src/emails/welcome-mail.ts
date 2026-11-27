import type { Language } from '@todz/types';
import type { EmailMessage } from '../email-sender';
import { EmailSlot } from './email-slot';
import { filledEmailOf } from './filled-email';
import { WELCOME_EMAIL } from './generated/email-templates';

export function welcomeMail({ to, origin, language }: { to: string; origin: string; language: Language }): EmailMessage {
  return filledEmailOf({ email: WELCOME_EMAIL[language], values: { [EmailSlot.Email]: to, [EmailSlot.Origin]: origin }, to });
}
