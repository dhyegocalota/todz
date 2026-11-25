import { afterEach, describe, expect, test, vi } from 'vitest';
import { emailSenderOf } from '../src/email-sender';
import { PUBLIC_HTTPS_ORIGIN, bindingFailingWith, consoleOutput, recordingBinding, sentMail } from './email-sign-in-client';

afterEach(() => {
  vi.restoreAllMocks();
});

const LOCAL_ORIGIN = 'http://localhost:8787';
const PUBLIC_REQUEST_URL = 'https://api.todz.test/owner/sign-in-links';
const LOCAL_REQUEST_URL = 'http://localhost:8787/owner/sign-in-links';
const REPLY_ADDRESS = 'reply+0123456789abcdef0123456789abcdef@todz.app';
const AUTO_SUBMITTED_HEADERS = { 'Auto-Submitted': 'auto-generated' };
const MAIL = { to: 'maria@example.com', subject: 'Hello', html: '<p>Hello</p>', text: 'Hello', replyTo: 'hello@todz.app' };

describe('the cloudflare sender', () => {
  test('sends through the binding from todz at noreply@todz.app with a reply-to of hello@todz.app', async () => {
    const { binding, sent } = recordingBinding();
    const sender = emailSenderOf({
      configured: 'cloudflare',
      publicOrigin: PUBLIC_HTTPS_ORIGIN,
      requestUrl: PUBLIC_REQUEST_URL,
      binding,
    });
    await sender?.send(MAIL);
    expect(sent).toEqual([{ ...MAIL, from: { name: 'todz', email: 'noreply@todz.app' }, replyTo: 'hello@todz.app' }]);
  });

  test('sends the reply-to of the message and no headers when it names none', async () => {
    const { binding, sent } = recordingBinding();
    const sender = emailSenderOf({ configured: 'cloudflare', publicOrigin: PUBLIC_HTTPS_ORIGIN, requestUrl: PUBLIC_REQUEST_URL, binding });
    await sender?.send({ ...MAIL, replyTo: REPLY_ADDRESS });
    expect(sent.map((message) => message.replyTo)).toEqual([REPLY_ADDRESS]);
    expect(sent.map((message) => message.headers)).toEqual([undefined]);
  });

  test('sends the headers of the message through the binding', async () => {
    const { binding, sent } = recordingBinding();
    const sender = emailSenderOf({ configured: 'cloudflare', publicOrigin: PUBLIC_HTTPS_ORIGIN, requestUrl: PUBLIC_REQUEST_URL, binding });
    await sender?.send({ ...MAIL, headers: AUTO_SUBMITTED_HEADERS });
    expect(sent.map((message) => message.headers)).toEqual([AUTO_SUBMITTED_HEADERS]);
  });

  test('passes an address with brackets only as the structured to field', async () => {
    const { binding, sent } = recordingBinding();
    const sender = emailSenderOf({
      configured: 'cloudflare',
      publicOrigin: PUBLIC_HTTPS_ORIGIN,
      requestUrl: PUBLIC_REQUEST_URL,
      binding,
    });
    await sender?.send({ ...MAIL, to: 'a(b)@x.co' });
    expect(sent.map((message) => message.to)).toEqual(['a(b)@x.co']);
  });

  test('rejects when the binding throws', async () => {
    const sender = emailSenderOf({
      configured: 'cloudflare',
      publicOrigin: PUBLIC_HTTPS_ORIGIN,
      requestUrl: PUBLIC_REQUEST_URL,
      binding: bindingFailingWith(new Error('the binding is down')),
    });
    await expect(sender?.send(MAIL)).rejects.toThrow('the binding is down');
  });

  test('is no sender without the binding', () => {
    expect(emailSenderOf({ configured: 'cloudflare', publicOrigin: PUBLIC_HTTPS_ORIGIN, requestUrl: PUBLIC_REQUEST_URL })).toBeNull();
  });

  test('is a sender on a public https origin and a public request host', () => {
    const { binding } = recordingBinding();
    const sender = emailSenderOf({ configured: 'cloudflare', publicOrigin: PUBLIC_HTTPS_ORIGIN, requestUrl: PUBLIC_REQUEST_URL, binding });
    expect(sender).not.toBeNull();
  });
});

describe('emailSenderOf', () => {
  test.each([
    ['no kind', undefined, LOCAL_ORIGIN, LOCAL_REQUEST_URL, false],
    ['an unknown kind', 'carrier-pigeon', LOCAL_ORIGIN, LOCAL_REQUEST_URL, false],
    ['the console kind on a local origin and a local request', 'console', LOCAL_ORIGIN, LOCAL_REQUEST_URL, true],
    ['the console kind on a public origin', 'console', PUBLIC_HTTPS_ORIGIN, LOCAL_REQUEST_URL, false],
    ['the console kind on a public request host', 'console', LOCAL_ORIGIN, PUBLIC_REQUEST_URL, false],
  ])('%s is a sender: %s', (_name, configured, publicOrigin, requestUrl, isSender) => {
    expect(emailSenderOf({ configured, publicOrigin, requestUrl }) !== null).toBe(isSender);
  });

  test('the console sender logs the address, the reply-to and the text only', async () => {
    const output = consoleOutput();
    const sender = emailSenderOf({ configured: 'console', publicOrigin: LOCAL_ORIGIN, requestUrl: LOCAL_REQUEST_URL });
    await sender?.send(MAIL);
    expect(sentMail(output)).toEqual([{ to: MAIL.to, replyTo: MAIL.replyTo, text: MAIL.text }]);
  });
});
