import type { EmailMessage } from '../email-sender';
import { EmailSlot } from './email-slot';
import { filledEmailOf } from './filled-email';
import { WELCOME_EMAIL } from './generated/email-templates';

export function welcomeMail({ to, origin }: { to: string; origin: string }): EmailMessage {
  return filledEmailOf({ email: WELCOME_EMAIL, values: { [EmailSlot.Email]: to, [EmailSlot.Origin]: origin }, to });
}
