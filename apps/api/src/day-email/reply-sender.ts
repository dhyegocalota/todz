import { addressParser } from 'postal-mime';
import type { Header } from 'postal-mime';
import { normalizedAddress } from '../email-address';
import { headersNamed } from './reply-headers';

const FROM_HEADER = 'from';
const DOMAIN_SEPARATOR = '@';
const ADDRESS_DELIMITERS = /[@<>]/;
const WHITESPACE_RUN = /\s+/g;

export enum SenderVerdict {
  Accepted = 'accepted',
  FromNotSingle = 'from_not_single',
  FromMismatch = 'from_mismatch',
  MailboxNotSingle = 'mailbox_not_single',
  AddressInvalid = 'address_invalid',
  DomainMismatch = 'domain_mismatch',
}

export type Sender = { verdict: SenderVerdict.Accepted; address: string } | { verdict: Exclude<SenderVerdict, SenderVerdict.Accepted> };

function collapsed(value: string): string {
  return value.replace(WHITESPACE_RUN, ' ').trim();
}

function addressCountOf(value: string): number {
  return value.split(DOMAIN_SEPARATOR).length - 1;
}

export function senderOf({ headers, domain, runtimeFrom }: { headers: Header[]; domain: string; runtimeFrom: string | null }): Sender {
  const [fromHeader, ...otherFromHeaders] = headersNamed({ headers, name: FROM_HEADER });
  if (fromHeader === undefined || otherFromHeaders.length > 0) return { verdict: SenderVerdict.FromNotSingle };
  if (runtimeFrom === null || collapsed(runtimeFrom) !== collapsed(fromHeader.value)) return { verdict: SenderVerdict.FromMismatch };
  const [mailbox, ...others] = addressParser(fromHeader.value);
  const isSingleMailbox = mailbox !== undefined && others.length === 0 && mailbox.group === undefined;
  if (!isSingleMailbox) return { verdict: SenderVerdict.MailboxNotSingle };
  const isAmbiguous = addressCountOf(fromHeader.value) > 1 || ADDRESS_DELIMITERS.test(mailbox.name);
  if (isAmbiguous) return { verdict: SenderVerdict.MailboxNotSingle };
  const address = normalizedAddress(mailbox.address);
  if (address === null) return { verdict: SenderVerdict.AddressInvalid };
  const isOnDomain = address.slice(address.lastIndexOf(DOMAIN_SEPARATOR) + 1) === domain;
  if (!isOnDomain) return { verdict: SenderVerdict.DomainMismatch };
  return { verdict: SenderVerdict.Accepted, address };
}
