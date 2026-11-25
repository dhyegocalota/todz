import type { EmailMessage } from '../email-sender';

const WAITLIST_SUBJECT = "You're on the todz waitlist";
const WAITLIST_BODY = "You're on the list. Thanks for joining the todz waitlist. We'll write once, when todz opens for you.";

export function waitlistMail({ to, origin }: { to: string; origin: string }): EmailMessage {
  const text = `${WAITLIST_BODY}\n\n${origin}`;
  return { to, subject: WAITLIST_SUBJECT, html: `<p>${text}</p>`, text };
}
