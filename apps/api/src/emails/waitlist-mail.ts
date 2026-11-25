import type { EmailMessage } from '../email-sender';
import { EmailSlot } from './email-slot';
import { filledEmailOf } from './filled-email';
import { WAITLIST_EMAIL } from './generated/email-templates';

export function waitlistMail({ to, origin }: { to: string; origin: string }): EmailMessage {
  return filledEmailOf({ email: WAITLIST_EMAIL, values: { [EmailSlot.Origin]: origin }, to });
}
