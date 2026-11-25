import { describe, expect, test } from 'vitest';
import { AddressingVerdict, addressingOf } from '../../src/day-email/reply-addressing';
import { parsedHeadersOf } from '../fixtures/day-email/raw-message';

const RECIPIENT = `reply+${'a'.repeat(32)}@todz.app`;
const MESSAGE_ID = '<one@mail.example.com>';

async function addressingOfHeaders(headers: string[]) {
  return addressingOf({ headers: await parsedHeadersOf(headers), recipient: RECIPIENT });
}

describe('addressingOf', () => {
  test('one To naming the recipient and one Message-ID is addressed, with the Message-ID trimmed', async () => {
    expect(await addressingOfHeaders([`To: todz <${RECIPIENT}>`, `Message-ID:  ${MESSAGE_ID} `])).toEqual({
      verdict: AddressingVerdict.Addressed,
      messageId: MESSAGE_ID,
    });
  });

  test('the recipient in Cc with another To is addressed', async () => {
    expect(await addressingOfHeaders(['To: friend@example.com', `Cc: ${RECIPIENT.toUpperCase()}`, `Message-ID: ${MESSAGE_ID}`])).toEqual({
      verdict: AddressingVerdict.Addressed,
      messageId: MESSAGE_ID,
    });
  });

  test('the recipient inside a group is addressed', async () => {
    expect(await addressingOfHeaders([`To: team: ${RECIPIENT};`, `Message-ID: ${MESSAGE_ID}`])).toEqual({
      verdict: AddressingVerdict.Addressed,
      messageId: MESSAGE_ID,
    });
  });

  test.each([
    [['To: friend@example.com', `Message-ID: ${MESSAGE_ID}`]],
    [[`To: ${RECIPIENT}`, `To: ${RECIPIENT}`, `Message-ID: ${MESSAGE_ID}`]],
    [[`Message-ID: ${MESSAGE_ID}`]],
    [[`To: "${RECIPIENT}" <friend@example.com>`, `Message-ID: ${MESSAGE_ID}`]],
  ])('%j is not a reply', async (headers) => {
    expect(await addressingOfHeaders(headers)).toEqual({ verdict: AddressingVerdict.NotAReply });
  });

  test.each([
    [[`To: ${RECIPIENT}`]],
    [[`To: ${RECIPIENT}`, 'Message-ID: ']],
    [[`To: ${RECIPIENT}`, `Message-ID: ${MESSAGE_ID}`, 'Message-ID: <two@mail.example.com>']],
  ])('%j has no single Message-ID', async (headers) => {
    expect(await addressingOfHeaders(headers)).toEqual({ verdict: AddressingVerdict.NoMessageId });
  });
});
