import type { EmailMessage } from '../email-sender';

export function adminSignInMail({ to, link, origin }: { to: string; link: string; origin: string }): EmailMessage {
  return { to, subject: `Sign in to the todz admin at ${origin}`, html: link, text: link };
}
