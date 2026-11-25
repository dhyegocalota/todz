import { describe, expect, test } from 'vitest';
import { AddressingVerdict, addressingOf } from '../../src/day-email/reply-addressing';
import { OWNER_DOMAIN, parsedHeadersOf } from '../fixtures/day-email/raw-message';

const RECIPIENT = `reply+${'a'.repeat(32)}@todz.app`;
const MESSAGE_ID = '<one@mail.example.com>';
const SIGNED_TO = `DKIM-Signature: v=1; a=rsa-sha256; d=${OWNER_DOMAIN}; s=20230601; h=from:to:subject:message-id; bh=abc; b=def`;
const UNSIGNED_TO = `DKIM-Signature: v=1; a=rsa-sha256; d=${OWNER_DOMAIN}; s=20230601; h=from:subject:message-id; bh=abc; b=def`;
const OTHER_DOMAIN_UNSIGNED_TO = 'DKIM-Signature: v=1; a=rsa-sha256; d=mailgun.example; s=k1; h=from:subject; bh=abc; b=def';

async function addressingOfHeaders(headers: string[]) {
  return addressingOf({ headers: await parsedHeadersOf(headers), recipient: RECIPIENT, domain: OWNER_DOMAIN });
}

describe('addressingOf', () => {
  test('one To naming the recipient, a signature that signs To and one Message-ID is addressed, with the Message-ID trimmed', async () => {
    expect(await addressingOfHeaders([`To: todz <${RECIPIENT}>`, `Message-ID:  ${MESSAGE_ID} `, SIGNED_TO])).toEqual({
      verdict: AddressingVerdict.Addressed,
      messageId: MESSAGE_ID,
    });
  });

  test('the recipient in upper case, and the signed header list in upper case, is addressed', async () => {
    const signed = SIGNED_TO.replace('h=from:to', 'H=FROM:TO');
    expect(await addressingOfHeaders([`To: ${RECIPIENT.toUpperCase()}`, `Message-ID: ${MESSAGE_ID}`, signed])).toEqual({
      verdict: AddressingVerdict.Addressed,
      messageId: MESSAGE_ID,
    });
  });

  test('a signature of another domain that does not sign To does not matter', async () => {
    expect(await addressingOfHeaders([`To: ${RECIPIENT}`, `Message-ID: ${MESSAGE_ID}`, SIGNED_TO, OTHER_DOMAIN_UNSIGNED_TO])).toEqual({
      verdict: AddressingVerdict.Addressed,
      messageId: MESSAGE_ID,
    });
  });

  test.each([
    ['a To naming another address', ['To: friend@example.com', SIGNED_TO]],
    ['the recipient only in Cc', ['To: friend@example.com', `Cc: ${RECIPIENT}`, SIGNED_TO]],
    ['the recipient in a group in To', [`To: team: ${RECIPIENT};`, SIGNED_TO]],
    ['two To headers', [`To: ${RECIPIENT}`, `To: ${RECIPIENT}`, SIGNED_TO]],
    ['no To header', [SIGNED_TO]],
    ['a display name holding the recipient', [`To: "${RECIPIENT}" <friend@example.com>`, SIGNED_TO]],
    ['a signature that does not sign To', [`To: ${RECIPIENT}`, UNSIGNED_TO]],
    ['one signature that signs To and one that does not, both of the domain', [`To: ${RECIPIENT}`, SIGNED_TO, UNSIGNED_TO]],
    ['no signature of the domain', [`To: ${RECIPIENT}`, OTHER_DOMAIN_UNSIGNED_TO]],
    ['no signature at all', [`To: ${RECIPIENT}`]],
  ])('%s is not a reply', async (_name, headers) => {
    expect(await addressingOfHeaders([...headers, `Message-ID: ${MESSAGE_ID}`])).toEqual({ verdict: AddressingVerdict.NotAReply });
  });

  test.each([
    [[`To: ${RECIPIENT}`, SIGNED_TO]],
    [[`To: ${RECIPIENT}`, SIGNED_TO, 'Message-ID: ']],
    [[`To: ${RECIPIENT}`, SIGNED_TO, `Message-ID: ${MESSAGE_ID}`, 'Message-ID: <two@mail.example.com>']],
  ])('%j has no single Message-ID', async (headers) => {
    expect(await addressingOfHeaders(headers)).toEqual({ verdict: AddressingVerdict.NoMessageId });
  });
});
