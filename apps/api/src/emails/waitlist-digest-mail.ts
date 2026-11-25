import type { EmailMessage } from '../email-sender';
import type { WaitlistDigestFacts } from '../site/admin-store';

export function waitlistDigestMail(_input: { to: string; facts: WaitlistDigestFacts; origin: string }): EmailMessage {
  throw new Error('waitlistDigestMail is not implemented');
}
