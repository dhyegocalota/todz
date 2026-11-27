import type { EmailMessage } from '../email-sender';
import { EmailSlot } from './email-slot';
import { filledEmailOf } from './filled-email';
import { OAUTH_SIGN_IN_EMAIL } from './generated/email-templates';

export function oauthSignInMail({ to, link, origin }: { to: string; link: string; origin: string }): EmailMessage {
  return filledEmailOf({ email: OAUTH_SIGN_IN_EMAIL, values: { [EmailSlot.Link]: link, [EmailSlot.Origin]: origin }, to });
}
