import type { EmailMessage } from '../email-sender';
import { EmailSlot } from './email-slot';
import { filledEmailOf } from './filled-email';
import { ADMIN_SIGN_IN_EMAIL } from './generated/email-templates';

export function adminSignInMail({ to, link, origin }: { to: string; link: string; origin: string }): EmailMessage {
  return filledEmailOf({ email: ADMIN_SIGN_IN_EMAIL, values: { [EmailSlot.Link]: link, [EmailSlot.Origin]: origin }, to });
}
