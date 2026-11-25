import { addressParser } from 'postal-mime';
import type { Header } from 'postal-mime';
import { headersNamed } from './reply-headers';

const TO_HEADER = 'to';
const CC_HEADER = 'cc';
const MESSAGE_ID_HEADER = 'message-id';

export enum AddressingVerdict {
  Addressed = 'addressed',
  NotAReply = 'not_a_reply',
  NoMessageId = 'no_message_id',
}

export type Addressing =
  { verdict: AddressingVerdict.Addressed; messageId: string } | { verdict: Exclude<AddressingVerdict, AddressingVerdict.Addressed> };

function addressesOf(headers: Header[]): string[] {
  return headers
    .flatMap((header) => addressParser(header.value))
    .flatMap((entry) => (entry.group === undefined ? [entry] : entry.group))
    .map(({ address }) => address.toLowerCase());
}

export function addressingOf({ headers, recipient }: { headers: Header[]; recipient: string; domain: string }): Addressing {
  const toHeaders = headersNamed({ headers, name: TO_HEADER });
  const namedRecipients = addressesOf([...toHeaders, ...headersNamed({ headers, name: CC_HEADER })]);
  const isReply = toHeaders.length === 1 && namedRecipients.includes(recipient.toLowerCase());
  if (!isReply) return { verdict: AddressingVerdict.NotAReply };
  const [messageIdHeader, ...otherMessageIdHeaders] = headersNamed({ headers, name: MESSAGE_ID_HEADER });
  const messageId = messageIdHeader?.value.trim();
  const hasSingleMessageId = messageId !== undefined && messageId !== '' && otherMessageIdHeaders.length === 0;
  if (!hasSingleMessageId) return { verdict: AddressingVerdict.NoMessageId };
  return { verdict: AddressingVerdict.Addressed, messageId };
}
