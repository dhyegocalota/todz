import type { EmailMessage } from '../email-sender';
import { AdminPath } from '../site/admin-paths';
import type { WaitlistDigestFacts } from '../site/admin-store';
import { EmailSlot, type EmailSlotValues, filledTextOf } from './email-slot';
import { filledEmailOf } from './filled-email';
import type { GeneratedEmail } from './generated-email';
import { WAITLIST_DIGEST_EMAIL, WAITLIST_DIGEST_EMPTY_EMAIL } from './generated/email-templates';

const ADDRESS_SEPARATOR = '\n';
const NO_MORE_ADDRESSES = '';

function moreSentenceOf(moreAddresses: number): string {
  if (moreAddresses === 0) return NO_MORE_ADDRESSES;
  return `and ${moreAddresses} more.`;
}

function valuesOf({ facts, origin }: { facts: WaitlistDigestFacts; origin: string }): EmailSlotValues {
  return {
    [EmailSlot.Joined]: String(facts.joined),
    [EmailSlot.Total]: String(facts.total),
    [EmailSlot.Failed]: String(facts.failedConfirmations),
    [EmailSlot.Addresses]: facts.addresses.join(ADDRESS_SEPARATOR),
    [EmailSlot.More]: moreSentenceOf(facts.moreAddresses),
    [EmailSlot.Link]: `${origin}${AdminPath.Panel}`,
    [EmailSlot.Origin]: origin,
  };
}

function subjectOf({ email, values }: { email: GeneratedEmail; values: EmailSlotValues }): string {
  return filledTextOf({ text: email.subject, values });
}

export function waitlistDigestMail({ to, facts, origin }: { to: string; facts: WaitlistDigestFacts; origin: string }): EmailMessage {
  const email = facts.joined === 0 ? WAITLIST_DIGEST_EMPTY_EMAIL : WAITLIST_DIGEST_EMAIL;
  const values = valuesOf({ facts, origin });
  return filledEmailOf({ email, values, to, subject: subjectOf({ email, values }) });
}
