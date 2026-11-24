export const SIGN_IN_MAIL_SUBJECT = 'Your todz sign-in link';

export function signInMailText(link: string): string {
  return `Open this link to sign in to todz:\n\n${link}\n\nIf you didn't ask for this, ignore this email.`;
}
