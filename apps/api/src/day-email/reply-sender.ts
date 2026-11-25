import { addressParser } from 'postal-mime';
import type { Header } from 'postal-mime';
import { normalizedAddress } from '../email-address';
import { headersNamed } from './reply-headers';

const FROM_HEADER = 'from';
const DOMAIN_SEPARATOR = '@';

export enum SenderVerdict {
  Accepted = 'accepted',
  FromNotSingle = 'from_not_single',
  MailboxNotSingle = 'mailbox_not_single',
  AddressInvalid = 'address_invalid',
  DomainMismatch = 'domain_mismatch',
}

export type Sender = { verdict: SenderVerdict.Accepted; address: string } | { verdict: Exclude<SenderVerdict, SenderVerdict.Accepted> };

export function senderOf({ headers, domain }: { headers: Header[]; domain: string }): Sender {
  const [fromHeader, ...otherFromHeaders] = headersNamed({ headers, name: FROM_HEADER });
  if (!fromHeader || otherFromHeaders.length > 0) return { verdict: SenderVerdict.FromNotSingle };
  const [mailbox, ...others] = addressParser(fromHeader.value);
  const isSingleMailbox = mailbox !== undefined && others.length === 0 && mailbox.group === undefined;
  if (!isSingleMailbox) return { verdict: SenderVerdict.MailboxNotSingle };
  const address = normalizedAddress(mailbox.address);
  if (!address) return { verdict: SenderVerdict.AddressInvalid };
  const isOnDomain = address.slice(address.lastIndexOf(DOMAIN_SEPARATOR) + 1) === domain;
  if (!isOnDomain) return { verdict: SenderVerdict.DomainMismatch };
  return { verdict: SenderVerdict.Accepted, address };
}
