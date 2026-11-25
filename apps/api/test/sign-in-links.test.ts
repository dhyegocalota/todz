import { MILLISECONDS_PER_MINUTE } from '@todz/types';
import { env } from 'cloudflare:workers';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { digestCredential } from '../src/credential-digest';
import { publicOriginOf } from '../src/sign-in-links';
import { TURNSTILE_DUMMY_TOKEN, TurnstileAction } from '../src/turnstile';
import { seedEmailIdentity, seedOwner } from './directory-seed';
import {
  LINK_CHALLENGE,
  freshAddress,
  guardedSettings,
  EMAIL_SETTINGS,
  PUBLIC_HTTPS_ORIGIN,
  PUBLIC_ORIGIN,
  TURNSTILE_TOKEN_OF_ACTION,
  acceptingSiteverify,
  bindingFailingWith,
  consoleOutput,
  emailEnv,
  linkRows,
  mailSent,
  messageSent,
  recordingBinding,
  requestLink,
  sentMail,
  tokenOfMail,
} from './email-sign-in-client';
import { recordingEnv, serveOwnerCall } from './owner-client';
import { CLOCK_NOW } from './task-fixtures';

const LINK_LIFETIME_MS = 15 * MILLISECONDS_PER_MINUTE;
const LINKS_PER_WINDOW_MAX = 5;
const ADDRESS_LENGTH_MAX = 254;
const ACCEPTED_STATUS = 202;
const BAD_REQUEST_STATUS = 400;
const TOO_MANY_STATUS = 429;
const UNAVAILABLE_STATUS = 503;
const INVALID_REQUEST = { error: 'invalid_request' };
const SIGN_IN_REFUSED = { error: 'sign_in_refused' };
const RETRY_AFTER_SECONDS = '60';
const SIGN_IN_UNAVAILABLE = { error: 'sign_in_unavailable' };
const OWNER_TABLES_PATTERN = /owners|owner_identities/;

async function totalLinks(): Promise<number> {
  const row = await env.DIRECTORY.prepare('SELECT count(*) AS total FROM sign_in_links').first<{ total: number }>();
  if (row === null) throw new Error('count always answers a row');
  return row.total;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('POST /owner/sign-in-links', () => {
  test('answers 202 with an empty object for a known and an unknown address alike', async () => {
    const output = consoleOutput();
    const knownAddress = 'known@example.com';
    await seedEmailIdentity({ ownerId: await seedOwner(), email: knownAddress });
    const known = await requestLink({ email: knownAddress });
    const unknown = await requestLink({ email: 'unknown@example.com' });
    expect([known.status, unknown.status]).toEqual([ACCEPTED_STATUS, ACCEPTED_STATUS]);
    expect(await known.json()).toEqual({});
    expect(await unknown.json()).toEqual({});
    expect(sentMail(output).map((mail) => mail.to)).toEqual([knownAddress, 'unknown@example.com']);
  });

  test('stores one row with the digest of the token, the lower-cased address, the challenge and an expiry 15 minutes ahead', async () => {
    const output = consoleOutput();
    const response = await requestLink({ email: '  Maria.Silva@Example.COM ' });
    expect(response.status).toBe(ACCEPTED_STATUS);
    const token = tokenOfMail(mailSent(output));
    const rows = await linkRows('maria.silva@example.com');
    expect(rows).toEqual([
      {
        digest: await digestCredential(token),
        email: 'maria.silva@example.com',
        challenge: LINK_CHALLENGE,
        created_at: CLOCK_NOW,
        expires_at: CLOCK_NOW + LINK_LIFETIME_MS,
        consumed_at: null,
      },
    ]);
    expect(rows.flatMap((row) => Object.values(row))).not.toContain(token);
  });

  test('mails the link on the configured origin with a short plain text that tells a stranger to ignore it', async () => {
    const output = consoleOutput();
    const email = freshAddress();
    await requestLink({ email, workerEnv: emailEnv({ PUBLIC_ORIGIN: 'http://127.0.0.1:9000' }) });
    const mail = mailSent(output);
    expect(mail.to).toBe(email);
    expect(mail.text).toContain(`http://127.0.0.1:9000/sign-in#token=${tokenOfMail(mail)}`);
    expect(mail.text).toContain("If you didn't ask for this, ignore this email.");
    expect(output).toHaveBeenCalledTimes(1);
  });

  test('every request makes a fresh token', async () => {
    const output = consoleOutput();
    const email = freshAddress();
    await requestLink({ email });
    await requestLink({ email });
    const [first, second] = sentMail(output).map(tokenOfMail);
    expect(first).not.toBe(second);
    expect(await linkRows(email)).toHaveLength(2);
  });

  test('accepts an address of exactly 254 characters', async () => {
    consoleOutput();
    const email = `${'a'.repeat(ADDRESS_LENGTH_MAX - '@example.com'.length)}@example.com`;
    expect(email).toHaveLength(ADDRESS_LENGTH_MAX);
    expect((await requestLink({ email })).status).toBe(ACCEPTED_STATUS);
  });

  test.each([
    [''],
    ['maria'],
    ['maria@'],
    ['@example.com'],
    ['maria@example'],
    ['a@b@example.com'],
    ['ma ria@example.com'],
    ['maria@exa mple.com'],
    ['maria@example.com\nbcc@example.com'],
    ['<maria@example.com'],
    ['maria@example.com>'],
    ['maria@example.com,bcc@example.com'],
    ['"maria"@example.com'],
    ['maria@exa"mple.com'],
    ['ma\tria@example.com'],
    ['mar\u0001ia@example.com'],
    ['maria@exam\u007fple.com'],
    ['mária@example.com'],
    ['maria@exámple.com'],
    [`${'a'.repeat(ADDRESS_LENGTH_MAX - '@example.com'.length + 1)}@example.com`],
    [5],
    [null],
  ])('the address %j answers 400 invalid_request and sends nothing', async (email) => {
    const output = consoleOutput();
    const before = await totalLinks();
    const response = await requestLink({ email });
    expect(response.status).toBe(BAD_REQUEST_STATUS);
    expect(await response.json()).toEqual(INVALID_REQUEST);
    expect(output).not.toHaveBeenCalled();
    expect(await totalLinks()).toBe(before);
  });

  test.each([
    [''],
    ['ab'.repeat(32).toUpperCase()],
    ['ab'.repeat(31)],
    ['ab'.repeat(33)],
    ['zz'.repeat(32)],
    [`${'ab'.repeat(31)}a\n`],
    [5],
    [null],
  ])('the challenge %j answers 400 invalid_request and sends nothing', async (challenge) => {
    const output = consoleOutput();
    const before = await totalLinks();
    const response = await requestLink({ challenge });
    expect(response.status).toBe(BAD_REQUEST_STATUS);
    expect(await response.json()).toEqual(INVALID_REQUEST);
    expect(output).not.toHaveBeenCalled();
    expect(await totalLinks()).toBe(before);
  });

  test.each([
    ['a body that is not JSON', { rawBody: 'not json' }],
    ['an empty body', { rawBody: '' }],
    ['a JSON array', { rawBody: '[]' }],
    ['a missing address', { body: { link_challenge: LINK_CHALLENGE } }],
    ['a missing challenge', { body: { email: 'missing@example.com' } }],
  ])('%s answers 400 invalid_request', async (_name, payload) => {
    const output = consoleOutput();
    const response = await serveOwnerCall({
      call: { method: 'POST', path: '/owner/sign-in-links', origin: PUBLIC_ORIGIN, ...payload },
      now: CLOCK_NOW,
      workerEnv: emailEnv(),
    });
    expect(response.status).toBe(BAD_REQUEST_STATUS);
    expect(await response.json()).toEqual(INVALID_REQUEST);
    expect(output).not.toHaveBeenCalled();
  });

  test.each([['text/plain'], ['application/x-www-form-urlencoded'], ['']])(
    'a body of content type %j answers 400 invalid_request and sends nothing',
    async (contentType) => {
      const output = consoleOutput();
      const before = await totalLinks();
      const response = await serveOwnerCall({
        call: {
          method: 'POST',
          path: '/owner/sign-in-links',
          origin: PUBLIC_ORIGIN,
          rawBody: JSON.stringify({ email: freshAddress(), link_challenge: LINK_CHALLENGE, turnstile_token: TURNSTILE_DUMMY_TOKEN }),
          headers: { 'Content-Type': contentType },
        },
        now: CLOCK_NOW,
        workerEnv: emailEnv(),
      });
      expect(response.status).toBe(BAD_REQUEST_STATUS);
      expect(await response.json()).toEqual(INVALID_REQUEST);
      expect(output).not.toHaveBeenCalled();
      expect(await totalLinks()).toBe(before);
    },
  );

  test('accepts the JSON content type with a charset and any letter case', async () => {
    consoleOutput();
    const response = await serveOwnerCall({
      call: {
        method: 'POST',
        path: '/owner/sign-in-links',
        origin: PUBLIC_ORIGIN,
        rawBody: JSON.stringify({ email: freshAddress(), link_challenge: LINK_CHALLENGE, turnstile_token: TURNSTILE_DUMMY_TOKEN }),
        headers: { 'Content-Type': 'Application/JSON; charset=utf-8' },
      },
      now: CLOCK_NOW,
      workerEnv: emailEnv(),
    });
    expect(response.status).toBe(ACCEPTED_STATUS);
  });

  test('a stray Authorization header does not matter', async () => {
    consoleOutput();
    const response = await serveOwnerCall({
      call: {
        method: 'POST',
        path: '/owner/sign-in-links',
        origin: PUBLIC_ORIGIN,
        body: { email: freshAddress(), link_challenge: LINK_CHALLENGE, turnstile_token: TURNSTILE_DUMMY_TOKEN },
        token: 'unknown',
      },
      now: CLOCK_NOW,
      workerEnv: emailEnv(),
    });
    expect(response.status).toBe(ACCEPTED_STATUS);
  });
});

describe('POST /owner/sign-in-links through the cloudflare sender', () => {
  const PUBLIC_REQUEST_ORIGIN = 'https://api.todz.test';
  const LINK_PATTERN = /https:\/\/todz\.app\/sign-in#token=[A-Za-z0-9_-]{43}/;
  const REQUEST_LINK_TOKEN = TURNSTILE_TOKEN_OF_ACTION[TurnstileAction.RequestLink];

  beforeEach(() => {
    acceptingSiteverify();
  });

  test('sends one mail from a public https origin whose html button and text both carry the link and whose header shows the lockup', async () => {
    const { binding, sent } = recordingBinding();
    const email = freshAddress();
    const response = await requestLink({
      email,
      origin: PUBLIC_REQUEST_ORIGIN,
      turnstileToken: REQUEST_LINK_TOKEN,
      workerEnv: emailEnv({ ...guardedSettings(), EMAIL: binding }),
    });
    expect(response.status).toBe(ACCEPTED_STATUS);
    const mail = messageSent(sent);
    expect(mail.to).toBe(email);
    expect(mail.subject).toBe('Your todz sign-in link');
    const link = LINK_PATTERN.exec(mail.text)?.[0];
    expect(link).toBeDefined();
    expect(mail.html).toContain(`href="${link}"`);
    expect(mail.html).toContain(`src="${PUBLIC_HTTPS_ORIGIN}/brand/todz-lockup.png"`);
    expect(mail.text).toContain("If you didn't ask for this, ignore this email.");
  });

  test('stores the digest of the token it mailed', async () => {
    const { binding, sent } = recordingBinding();
    const email = freshAddress();
    await requestLink({
      email,
      origin: PUBLIC_REQUEST_ORIGIN,
      turnstileToken: REQUEST_LINK_TOKEN,
      workerEnv: emailEnv({ ...guardedSettings(), EMAIL: binding }),
    });
    const [row] = await linkRows(email);
    expect(row?.digest).toBe(await digestCredential(tokenOfMail(messageSent(sent))));
  });

  test('a binding that throws leaves no row and answers 503 sign_in_unavailable', async () => {
    const email = freshAddress();
    const response = await requestLink({
      email,
      origin: PUBLIC_REQUEST_ORIGIN,
      turnstileToken: REQUEST_LINK_TOKEN,
      workerEnv: emailEnv({ ...guardedSettings(), EMAIL: bindingFailingWith(new Error('the binding is down')) }),
    });
    expect(response.status).toBe(UNAVAILABLE_STATUS);
    expect(await response.json()).toEqual(SIGN_IN_UNAVAILABLE);
    expect(await linkRows(email)).toEqual([]);
  });

  test('no binding answers 503 sign_in_unavailable and stores nothing', async () => {
    const before = await totalLinks();
    const response = await requestLink({
      origin: PUBLIC_REQUEST_ORIGIN,
      turnstileToken: REQUEST_LINK_TOKEN,
      workerEnv: emailEnv(guardedSettings()),
    });
    expect(response.status).toBe(UNAVAILABLE_STATUS);
    expect(await response.json()).toEqual(SIGN_IN_UNAVAILABLE);
    expect(await totalLinks()).toBe(before);
  });
});

describe('the limit of five links per address in 15 minutes', () => {
  test('the sixth request answers 429 sign_in_refused with Retry-After 60 and sends nothing, whatever the case and spaces of the address', async () => {
    const output = consoleOutput();
    const email = 'limit-sixth@example.com';
    const statuses = await Array.from({ length: LINKS_PER_WINDOW_MAX }).reduce<Promise<number[]>>(async (issued) => {
      const response = await requestLink({ email });
      return [...(await issued), response.status];
    }, Promise.resolve([]));
    expect(statuses).toEqual(Array.from({ length: LINKS_PER_WINDOW_MAX }, () => ACCEPTED_STATUS));
    const sixth = await requestLink({ email: '  LIMIT-Sixth@Example.com ' });
    expect(sixth.status).toBe(TOO_MANY_STATUS);
    expect(await sixth.json()).toEqual(SIGN_IN_REFUSED);
    expect(sixth.headers.get('Retry-After')).toBe(RETRY_AFTER_SECONDS);
    expect(output).toHaveBeenCalledTimes(LINKS_PER_WINDOW_MAX);
    expect(await linkRows(email)).toHaveLength(LINKS_PER_WINDOW_MAX);
  });

  test('another address is not limited', async () => {
    consoleOutput();
    const email = 'limit-other@example.com';
    await Array.from({ length: LINKS_PER_WINDOW_MAX }).reduce<Promise<void>>(async (issued) => {
      await issued;
      await requestLink({ email });
    }, Promise.resolve());
    expect((await requestLink({ email: 'limit-free@example.com' })).status).toBe(ACCEPTED_STATUS);
  });

  test('a request one millisecond before the first link is 15 minutes old answers 429, and at 15 minutes it answers 202', async () => {
    consoleOutput();
    const email = 'limit-window@example.com';
    await Array.from({ length: LINKS_PER_WINDOW_MAX }).reduce<Promise<void>>(async (issued) => {
      await issued;
      await requestLink({ email });
    }, Promise.resolve());
    const almost = await requestLink({ email, now: CLOCK_NOW + LINK_LIFETIME_MS - 1 });
    expect(almost.status).toBe(TOO_MANY_STATUS);
    const later = await requestLink({ email, now: CLOCK_NOW + LINK_LIFETIME_MS });
    expect(later.status).toBe(ACCEPTED_STATUS);
  });

  test('four parallel requests with three links already made give exactly two 202 and two 429', async () => {
    const output = consoleOutput();
    const email = 'limit-parallel@example.com';
    await Array.from({ length: LINKS_PER_WINDOW_MAX - 2 }).reduce<Promise<void>>(async (issued) => {
      await issued;
      await requestLink({ email });
    }, Promise.resolve());
    const responses = await Promise.all(Array.from({ length: 4 }, () => requestLink({ email })));
    expect(responses.map((response) => response.status).sort()).toEqual([
      ACCEPTED_STATUS,
      ACCEPTED_STATUS,
      TOO_MANY_STATUS,
      TOO_MANY_STATUS,
    ]);
    expect(await linkRows(email)).toHaveLength(LINKS_PER_WINDOW_MAX);
    expect(output).toHaveBeenCalledTimes(LINKS_PER_WINDOW_MAX);
  });
});

describe('a link that cannot be asked for', () => {
  test.each([
    ['no email provider', { SIGN_IN_PROVIDER: 'fake' }],
    ['no provider', { SIGN_IN_PROVIDER: undefined }],
    ['no origin', { PUBLIC_ORIGIN: undefined }],
    ['no sender', { EMAIL_SENDER: undefined }],
    ['an unknown sender', { EMAIL_SENDER: 'carrier-pigeon' }],
    ['an origin with a path', { PUBLIC_ORIGIN: 'http://localhost:8787/app' }],
    ['an origin with a trailing slash', { PUBLIC_ORIGIN: 'http://localhost:8787/' }],
    ['an origin that is not a URL', { PUBLIC_ORIGIN: 'todz' }],
    ['an http origin on a public host', { PUBLIC_ORIGIN: 'http://todz.app' }],
    ['the console sender on a public origin', { PUBLIC_ORIGIN: 'https://todz.app' }],
    ['the console sender on a look-alike host', { PUBLIC_ORIGIN: 'https://localhost.todz.app' }],
  ])('%s answers 503 sign_in_unavailable, stores nothing and sends nothing', async (_name, settings) => {
    const output = consoleOutput();
    const before = await totalLinks();
    const response = await requestLink({ workerEnv: emailEnv(settings) });
    expect(response.status).toBe(UNAVAILABLE_STATUS);
    expect(await response.json()).toEqual(SIGN_IN_UNAVAILABLE);
    expect(output).not.toHaveBeenCalled();
    expect(await totalLinks()).toBe(before);
  });

  test('the console sender is honoured on localhost and on 127.0.0.1', async () => {
    consoleOutput();
    const statuses = await Promise.all(
      ['http://localhost:8787', 'http://127.0.0.1:8787'].map(
        async (origin) =>
          (await requestLink({ email: `origin-${origin.length}@example.com`, origin, workerEnv: emailEnv({ PUBLIC_ORIGIN: origin }) }))
            .status,
      ),
    );
    expect(statuses).toEqual([ACCEPTED_STATUS, ACCEPTED_STATUS]);
  });

  test('the console sender is refused when the request itself arrives on a public host', async () => {
    const output = consoleOutput();
    const before = await totalLinks();
    const response = await requestLink({ origin: 'https://api.todz.test' });
    expect(response.status).toBe(UNAVAILABLE_STATUS);
    expect(await response.json()).toEqual(SIGN_IN_UNAVAILABLE);
    expect(output).not.toHaveBeenCalled();
    expect(await totalLinks()).toBe(before);
  });

  test('is checked before the body', async () => {
    const response = await serveOwnerCall({
      call: { method: 'POST', path: '/owner/sign-in-links', origin: PUBLIC_ORIGIN, rawBody: 'not json' },
      now: CLOCK_NOW,
      workerEnv: emailEnv({ PUBLIC_ORIGIN: undefined }),
    });
    expect(response.status).toBe(UNAVAILABLE_STATUS);
  });

  test('a sender that rejects leaves no row and answers 503 sign_in_unavailable', async () => {
    const output = consoleOutput();
    output.mockImplementation(() => {
      throw new Error('the sender is down');
    });
    const email = 'sender-down@example.com';
    const response = await requestLink({ email });
    expect(response.status).toBe(UNAVAILABLE_STATUS);
    expect(await response.json()).toEqual(SIGN_IN_UNAVAILABLE);
    expect(await linkRows(email)).toEqual([]);
  });
});

describe('the public origin', () => {
  test.each([
    ['https://todz.app', 'https://todz.app'],
    ['http://localhost:8787', 'http://localhost:8787'],
    ['http://127.0.0.1:9000', 'http://127.0.0.1:9000'],
    ['https://localhost:8787', 'https://localhost:8787'],
    ['http://todz.app', null],
    ['http://localhost.todz.app', null],
    ['ftp://todz.app', null],
    ['https://todz.app/', null],
    [undefined, null],
  ])('%j is kept as %j', (configured, expected) => {
    expect(publicOriginOf(configured)).toBe(expected);
  });
});

describe('what a request reveals', () => {
  test('a known and an unknown address run the same statements, none on owners or identities', async () => {
    consoleOutput();
    const knownAddress = 'statements-known@example.com';
    await seedEmailIdentity({ ownerId: await seedOwner(), email: knownAddress });
    const known = recordingEnv(EMAIL_SETTINGS);
    const unknown = recordingEnv(EMAIL_SETTINGS);
    await requestLink({ email: knownAddress, workerEnv: known.workerEnv });
    await requestLink({ email: 'statements-unknown@example.com', workerEnv: unknown.workerEnv });
    expect(known.statements.length).toBeGreaterThan(0);
    expect(known.statements).toEqual(unknown.statements);
    expect(known.statements.filter((statement) => OWNER_TABLES_PATTERN.test(statement))).toEqual([]);
  });

  test('the sweep by expiry reads the expiry index', async () => {
    const { results } = await env.DIRECTORY.prepare('EXPLAIN QUERY PLAN DELETE FROM sign_in_links WHERE expires_at <= ?')
      .bind(CLOCK_NOW)
      .all<{ detail: string }>();
    expect(results.map((step) => step.detail).join(' ')).toContain('sign_in_links_expiry');
  });

  test('expired links are swept whatever the address, and live ones stay', async () => {
    consoleOutput();
    const stale = 'sweep-stale@example.com';
    const live = 'sweep-live@example.com';
    await requestLink({ email: stale, now: CLOCK_NOW });
    await requestLink({ email: live, now: CLOCK_NOW + LINK_LIFETIME_MS });
    await requestLink({ email: 'sweep-trigger@example.com', now: CLOCK_NOW + LINK_LIFETIME_MS });
    expect(await linkRows(stale)).toEqual([]);
    expect(await linkRows(live)).toHaveLength(1);
  });
});
