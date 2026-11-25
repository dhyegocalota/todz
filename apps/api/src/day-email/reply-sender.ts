import type { Header } from 'postal-mime';

export enum SenderVerdict {
  Accepted = 'accepted',
  FromNotSingle = 'from_not_single',
  MailboxNotSingle = 'mailbox_not_single',
  AddressInvalid = 'address_invalid',
  DomainMismatch = 'domain_mismatch',
}

export type Sender = { verdict: SenderVerdict.Accepted; address: string } | { verdict: Exclude<SenderVerdict, SenderVerdict.Accepted> };

export function senderOf({ headers, domain }: { headers: Header[]; domain: string }): Sender {
  throw new Error('senderOf is not implemented');
}
