import type { EmailMessage } from '../email-sender';
import { SIGN_IN_MAIL_SUBJECT, signInMailText } from '../sign-in-mail-copy';

export function signInMail({ to, link }: { to: string; link: string; origin: string }): EmailMessage {
  return { to, subject: SIGN_IN_MAIL_SUBJECT, html: '', text: signInMailText(link) };
}
