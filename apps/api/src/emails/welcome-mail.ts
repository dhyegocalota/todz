import type { EmailMessage } from '../email-sender';

export function welcomeMail({ to, origin }: { to: string; origin: string }): EmailMessage {
  throw new Error(`welcomeMail is not implemented for ${to} on ${origin}`);
}
