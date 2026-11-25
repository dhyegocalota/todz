import { describe, expect, test } from 'vitest';
import { SenderVerdict, senderOf } from '../../src/day-email/reply-sender';
import { OWNER_DOMAIN, parsedHeadersOf } from '../fixtures/day-email/raw-message';

async function senderOfHeaders(headers: string[]) {
  return senderOf({ headers: await parsedHeadersOf(headers), domain: OWNER_DOMAIN });
}

describe('senderOf', () => {
  test('one From with one mailbox is the mailbox, normalized', async () => {
    expect(await senderOfHeaders(['From: Owner <Owner@Gmail.com>'])).toEqual({
      verdict: SenderVerdict.Accepted,
      address: 'owner@gmail.com',
    });
  });

  test.each([
    [['From: owner@gmail.com', 'From: a@evil.test']],
    [['From: a@evil.test', 'From: owner@gmail.com']],
    [['From: owner@gmail.com', 'from: owner@gmail.com']],
    [['From: owner@gmail.com', 'From : a@evil.test']],
    [['Subject: x']],
  ])('%j is refused for its From headers', async (headers) => {
    expect(await senderOfHeaders(headers)).toEqual({ verdict: SenderVerdict.FromNotSingle });
  });

  test('a From that is a continuation line of another header is not a From', async () => {
    expect(await senderOfHeaders(['From: owner@gmail.com', 'Subject: x', ' From: a@evil.test'])).toEqual({
      verdict: SenderVerdict.Accepted,
      address: 'owner@gmail.com',
    });
  });

  test('a From with a spaced name counts as a From', async () => {
    expect(await senderOfHeaders(['From : owner@gmail.com'])).toEqual({ verdict: SenderVerdict.Accepted, address: 'owner@gmail.com' });
  });

  test.each([['From: g:owner@gmail.com;'], ['From: owner@gmail.com, other@gmail.com'], ['From: owner@gmail.com, a@evil.test'], ['From: ']])(
    '%s is refused as not one mailbox',
    async (header) => {
      expect(await senderOfHeaders([header])).toEqual({ verdict: SenderVerdict.MailboxNotSingle });
    },
  );

  test.each([
    ['From: owner@gmail.com (x) <a@evil.test>', 'a@evil.test'],
    ['From: "owner@gmail.com" <a@evil.test>', 'a@evil.test'],
  ])('%s is the mailbox in the angle brackets', async (header, address) => {
    const headers = await parsedHeadersOf([header]);
    expect(senderOf({ headers, domain: 'evil.test' })).toEqual({ verdict: SenderVerdict.Accepted, address });
    expect(senderOf({ headers, domain: OWNER_DOMAIN })).toEqual({ verdict: SenderVerdict.DomainMismatch });
  });

  test('a mailbox whose domain differs from the authenticated one is refused', async () => {
    expect(await senderOfHeaders(['From: owner@evil.test'])).toEqual({ verdict: SenderVerdict.DomainMismatch });
  });

  test('a domain that only ends with the authenticated one is refused', async () => {
    expect(await senderOfHeaders(['From: owner@evilgmail.com'])).toEqual({ verdict: SenderVerdict.DomainMismatch });
    expect(await senderOfHeaders(['From: owner@gmail.com.evil.test'])).toEqual({ verdict: SenderVerdict.DomainMismatch });
  });

  test('the domain is compared in lower case', async () => {
    expect(await senderOfHeaders(['From: owner@GMAIL.COM'])).toEqual({ verdict: SenderVerdict.Accepted, address: 'owner@gmail.com' });
  });

  test('an address that is not an address is refused', async () => {
    expect(await senderOfHeaders(['From: not-an-address'])).toEqual({ verdict: SenderVerdict.MailboxNotSingle });
  });
});
