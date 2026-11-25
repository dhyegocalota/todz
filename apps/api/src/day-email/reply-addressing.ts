import { addressParser } from 'postal-mime';
import type { Header } from 'postal-mime';
import { headersNamed } from './reply-headers';

const TO_HEADER = 'to';
const MESSAGE_ID_HEADER = 'message-id';
const DKIM_SIGNATURE_HEADER = 'dkim-signature';
const DOMAIN_TAG = 'd';
const SIGNED_HEADERS_TAG = 'h';
const TAG_SEPARATOR = ';';
const TAG_ASSIGNMENT = '=';
const SIGNED_HEADER_SEPARATOR = ':';

export enum AddressingVerdict {
  Addressed = 'addressed',
  NotAReply = 'not_a_reply',
  NoMessageId = 'no_message_id',
}

export type Addressing =
  { verdict: AddressingVerdict.Addressed; messageId: string } | { verdict: Exclude<AddressingVerdict, AddressingVerdict.Addressed> };

type Tag = { name: string; value: string };

function tagOf(part: string): Tag {
  const assignmentIndex = part.indexOf(TAG_ASSIGNMENT);
  if (assignmentIndex === -1) return { name: part.trim().toLowerCase(), value: '' };
  return {
    name: part.slice(0, assignmentIndex).trim().toLowerCase(),
    value: part
      .slice(assignmentIndex + 1)
      .trim()
      .toLowerCase(),
  };
}

function tagValuesOf({ tags, name }: { tags: Tag[]; name: string }): string[] {
  return tags.filter((tag) => tag.name === name).map((tag) => tag.value);
}

function signaturesOf({ headers, domain }: { headers: Header[]; domain: string }): Tag[][] {
  return headersNamed({ headers, name: DKIM_SIGNATURE_HEADER })
    .map((header) => header.value.split(TAG_SEPARATOR).map(tagOf))
    .filter((tags) => tagValuesOf({ tags, name: DOMAIN_TAG }).includes(domain));
}

function signsToHeader(tags: Tag[]): boolean {
  const [signedHeaders, ...others] = tagValuesOf({ tags, name: SIGNED_HEADERS_TAG });
  if (signedHeaders === undefined || others.length > 0) return false;
  return signedHeaders.split(SIGNED_HEADER_SEPARATOR).some((name) => name.trim() === TO_HEADER);
}

function mailboxesOf(header: Header): string[] {
  return addressParser(header.value).flatMap((entry) => (entry.group === undefined ? [entry.address.toLowerCase()] : []));
}

// NB ADR 0064: the reply address must be the one To, and every signature of the authenticated domain must sign To.
export function addressingOf({ headers, recipient, domain }: { headers: Header[]; recipient: string; domain: string }): Addressing {
  const [toHeader, ...otherToHeaders] = headersNamed({ headers, name: TO_HEADER });
  const isOnlyRecipient = toHeader !== undefined && otherToHeaders.length === 0 && mailboxesOf(toHeader).includes(recipient.toLowerCase());
  const signatures = signaturesOf({ headers, domain });
  const isSignedTo = signatures.length > 0 && signatures.every(signsToHeader);
  if (!isOnlyRecipient || !isSignedTo) return { verdict: AddressingVerdict.NotAReply };
  const [messageIdHeader, ...otherMessageIdHeaders] = headersNamed({ headers, name: MESSAGE_ID_HEADER });
  const messageId = messageIdHeader?.value.trim();
  const hasSingleMessageId = messageId !== undefined && messageId !== '' && otherMessageIdHeaders.length === 0;
  if (!hasSingleMessageId) return { verdict: AddressingVerdict.NoMessageId };
  return { verdict: AddressingVerdict.Addressed, messageId };
}
