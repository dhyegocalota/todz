import {
  EMAIL_CODE_MISSES_PER_ADDRESS_MAX,
  EMAIL_CODE_MISSES_PER_REQUEST_MAX,
  MILLISECONDS_PER_DAY,
  MILLISECONDS_PER_MINUTE,
} from '@todz/types';
import { env } from 'cloudflare:workers';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { z } from 'zod';
import { generateCredentialSecret } from '../src/credential-secret';
import { CodeTable, CodeVerdict, spendEmailCode } from '../src/email-code';
import emailCodeSource from '../src/email-code.ts?raw';
import { digestCredential } from '../src/credential-digest';
import { seedEmailIdentity, seedOwner } from './directory-seed';
import {
  PUBLIC_HTTPS_ORIGIN,
  askedLink,
  consoleOutput,
  emailEnv,
  freshAddress,
  guardedSettings,
  mailSent,
  recordingLimiter,
  redeemCode,
  redeemLink,
  requestLink,
} from './email-sign-in-client';
import { serveOwnerCall } from './owner-client';
import { CLOCK_NOW } from './task-fixtures';

const LINK_LIFETIME_MS = 15 * MILLISECONDS_PER_MINUTE;
const CREATED_STATUS = 201;
const BAD_REQUEST_STATUS = 400;
const UNAUTHORIZED_STATUS = 401;
const TOO_MANY_STATUS = 429;
const UNAVAILABLE_STATUS = 503;
const IDENTITY_REJECTED = { error: 'identity_rejected' };
const CODE_LOCKED = { error: 'code_locked' };
const INVALID_REQUEST = { error: 'invalid_request' };
const SIGN_IN_UNAVAILABLE = { error: 'sign_in_unavailable' };
const RETRY_AFTER_HEADER = 'Retry-After';
const WRONG_CODE = '000000';
const SIX_DIGITS = /^[0-9]{6}$/;
const HEXADECIMAL_DIGEST_PATTERN = /^[0-9a-f]{64}$/;
const SessionSchema = z.object({ session_token: z.string(), owner: z.object({ id: z.string() }) });

type CodeRow = { code_digest: string; code_salt: string; consumed_at: number | null };

async function codeRow(email: string): Promise<CodeRow> {
  const row = await env.DIRECTORY.prepare('SELECT code_digest, code_salt, consumed_at FROM sign_in_links WHERE email = ?')
    .bind(email)
    .first<CodeRow>();
  if (row === null) throw new Error('the address should have a link row');
  return row;
}

async function wrongCodes({
  email,
  verifier,
  count,
  now = CLOCK_NOW,
}: {
  email: string;
  verifier: string;
  count: number;
  now?: number;
}): Promise<Response[]> {
  return Array.from({ length: count }).reduce<Promise<Response[]>>(
    async (answers) => [...(await answers), await redeemCode({ email, code: WRONG_CODE, verifier, now })],
    Promise.resolve([]),
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('the code in the sign-in mail', () => {
  test('the mail that carries the link carries a six digit code too', async () => {
    const output = consoleOutput();
    await requestLink({ email: freshAddress() });
    const mail = mailSent(output);
    expect(mail.text).toMatch(/sign-in#token=/);
    expect(mail.text).toMatch(/(?:^|\s)[0-9]{6}(?:\s|$)/);
  });

  test('two requests for one address carry two different codes', async () => {
    const email = freshAddress();
    const first = await askedLink({ email });
    const second = await askedLink({ email });
    expect(first.code).toMatch(SIX_DIGITS);
    expect(second.code).toMatch(SIX_DIGITS);
    expect(first.code === second.code && first.token === second.token).toBe(false);
  });

  test('the row keeps the code as a salted keyed digest, never the code', async () => {
    const { email, code } = await askedLink();
    const row = await codeRow(email);
    expect(row.code_digest).toMatch(HEXADECIMAL_DIGEST_PATTERN);
    expect(row.code_salt.length).toBeGreaterThanOrEqual(32);
    expect(JSON.stringify(row)).not.toContain(code);
  });

  test('two rows with the same code would still carry different digests because each row has its own salt', async () => {
    const first = await askedLink();
    const second = await askedLink();
    const [firstRow, secondRow] = [await codeRow(first.email), await codeRow(second.email)];
    expect(firstRow.code_salt).not.toBe(secondRow.code_salt);
  });

  test('compares the stored digest with the shared timing-safe signature helper', () => {
    expect(emailCodeSource).toContain('isSameSignature');
    expect(emailCodeSource).toContain('keyedDigest');
    expect(emailCodeSource).not.toMatch(/code_digest\s*===|===\s*row\.code_digest/);
  });
});

describe('POST /owner/sessions with an email code', () => {
  test('signs in with the code and answers a session, exactly as the link does', async () => {
    const { email, code, verifier } = await askedLink();
    const response = await redeemCode({ email, code, verifier });
    expect(response.status).toBe(CREATED_STATUS);
    const answer = SessionSchema.parse(await response.json());
    expect(answer.session_token.length).toBeGreaterThan(0);
  });

  test('normalizes the address the way the link request does', async () => {
    const { email, code, verifier } = await askedLink({ email: freshAddress() });
    const response = await redeemCode({ email: `  ${email.toUpperCase()} `, code, verifier });
    expect(response.status).toBe(CREATED_STATUS);
  });

  test('admits a known address to its own owner', async () => {
    const ownerId = await seedOwner();
    const email = freshAddress();
    await seedEmailIdentity({ ownerId, email });
    const { code, verifier } = await askedLink({ email });
    const answer = SessionSchema.parse(await (await redeemCode({ email, code, verifier })).json());
    expect(answer.owner.id).toBe(ownerId);
  });

  test('the code works once', async () => {
    const { email, code, verifier } = await askedLink();
    expect((await redeemCode({ email, code, verifier })).status).toBe(CREATED_STATUS);
    const again = await redeemCode({ email, code, verifier });
    expect([again.status, await again.json()]).toEqual([UNAUTHORIZED_STATUS, IDENTITY_REJECTED]);
  });

  test('spending the code spends the link', async () => {
    const { email, code, verifier, token } = await askedLink();
    expect((await redeemCode({ email, code, verifier })).status).toBe(CREATED_STATUS);
    const link = await redeemLink({ token, verifier });
    expect([link.status, await link.json()]).toEqual([UNAUTHORIZED_STATUS, IDENTITY_REJECTED]);
  });

  test('spending the link spends the code', async () => {
    const { email, code, verifier, token } = await askedLink();
    expect((await redeemLink({ token, verifier })).status).toBe(CREATED_STATUS);
    const answer = await redeemCode({ email, code, verifier });
    expect([answer.status, await answer.json()]).toEqual([UNAUTHORIZED_STATUS, IDENTITY_REJECTED]);
  });

  test('a wrong code answers identity_rejected and leaves the link and the code usable', async () => {
    const { email, code, verifier, token } = await askedLink();
    const [wrong] = await wrongCodes({ email, verifier, count: 1 });
    expect([wrong?.status, await wrong?.json()]).toEqual([UNAUTHORIZED_STATUS, IDENTITY_REJECTED]);
    expect((await redeemCode({ email, code, verifier })).status).toBe(CREATED_STATUS);
    expect(token).toHaveLength(43);
  });

  test('the code works only with the verifier of the request that asked for it', async () => {
    const { email, code } = await askedLink();
    const answer = await redeemCode({ email, code, verifier: generateCredentialSecret() });
    expect([answer.status, await answer.json()]).toEqual([UNAUTHORIZED_STATUS, IDENTITY_REJECTED]);
  });

  test('the code of one address does not sign in another address', async () => {
    const first = await askedLink();
    const second = await askedLink();
    const answer = await redeemCode({ email: second.email, code: first.code, verifier: first.verifier });
    expect(answer.status).toBe(UNAUTHORIZED_STATUS);
  });

  test('a code expires with the link, 15 minutes after it was asked for', async () => {
    const { email, code, verifier } = await askedLink();
    const late = await redeemCode({ email, code, verifier, now: CLOCK_NOW + LINK_LIFETIME_MS });
    expect([late.status, await late.json()]).toEqual([UNAUTHORIZED_STATUS, IDENTITY_REJECTED]);
  });

  test('a code just before expiry still signs in', async () => {
    const { email, code, verifier } = await askedLink();
    const answer = await redeemCode({ email, code, verifier, now: CLOCK_NOW + LINK_LIFETIME_MS - 1 });
    expect(answer.status).toBe(CREATED_STATUS);
  });

  test.each([['12345'], ['1234567'], ['12a456'], [' 123456'], [''], [123456]])('a code of %j is an invalid request', async (code) => {
    const { email, verifier } = await askedLink();
    const answer = await redeemCode({ email, code, verifier });
    expect([answer.status, await answer.json()]).toEqual([BAD_REQUEST_STATUS, INVALID_REQUEST]);
  });

  test('a body with both an identity token and a code is an invalid request', async () => {
    const { email, code, verifier, token } = await askedLink();
    const response = await serveOwnerCall({
      call: {
        method: 'POST',
        path: '/owner/sessions',
        body: { email, email_code: code, identity_token: token, link_verifier: verifier, time_zone: 'UTC', turnstile_token: 'x' },
      },
      now: CLOCK_NOW,
      workerEnv: emailEnv(),
    });
    expect([response.status, await response.json()]).toEqual([BAD_REQUEST_STATUS, INVALID_REQUEST]);
  });

  test('a code without a verifier is an invalid request', async () => {
    const { email, code } = await askedLink();
    const answer = await redeemCode({ email, code, verifier: undefined });
    expect(answer.status).toBe(BAD_REQUEST_STATUS);
  });
});

describe('code lockouts', () => {
  test('five wrong codes on one request lock it: the fifth answers 429 code_locked with Retry-After', async () => {
    const { email, verifier } = await askedLink();
    const answers = await wrongCodes({ email, verifier, count: EMAIL_CODE_MISSES_PER_REQUEST_MAX });
    const statuses = answers.map((answer) => answer.status);
    expect(statuses).toEqual([401, 401, 401, 401, TOO_MANY_STATUS]);
    const last = answers.at(-1);
    expect(await last?.json()).toEqual(CODE_LOCKED);
    expect(Number(last?.headers.get(RETRY_AFTER_HEADER))).toBeGreaterThan(0);
  });

  test('after the lock the right code no longer signs in and the emailed link is spent too', async () => {
    const { email, code, verifier, token } = await askedLink();
    await wrongCodes({ email, verifier, count: EMAIL_CODE_MISSES_PER_REQUEST_MAX });
    const rightCode = await redeemCode({ email, code, verifier });
    expect([rightCode.status, await rightCode.json()]).toEqual([TOO_MANY_STATUS, CODE_LOCKED]);
    const link = await redeemLink({ token, verifier });
    expect(link.status).toBe(UNAUTHORIZED_STATUS);
  });

  test('four wrong codes leave the right code working', async () => {
    const { email, code, verifier } = await askedLink();
    await wrongCodes({ email, verifier, count: EMAIL_CODE_MISSES_PER_REQUEST_MAX - 1 });
    expect((await redeemCode({ email, code, verifier })).status).toBe(CREATED_STATUS);
  });

  test('a request lock does not lock a fresh request of the same address', async () => {
    const email = freshAddress();
    const locked = await askedLink({ email });
    await wrongCodes({ email, verifier: locked.verifier, count: EMAIL_CODE_MISSES_PER_REQUEST_MAX });
    const fresh = await askedLink({ email });
    expect((await redeemCode({ email, code: fresh.code, verifier: fresh.verifier })).status).toBe(CREATED_STATUS);
  });

  test('ten wrong codes for one address in a day lock code sign-in for that address, whatever the request', async () => {
    const email = freshAddress();
    const first = await askedLink({ email });
    const second = await askedLink({ email });
    await wrongCodes({ email, verifier: first.verifier, count: EMAIL_CODE_MISSES_PER_REQUEST_MAX - 1 });
    await wrongCodes({ email, verifier: second.verifier, count: EMAIL_CODE_MISSES_PER_REQUEST_MAX - 1 });
    const third = await askedLink({ email });
    const tenth = await wrongCodes({
      email,
      verifier: third.verifier,
      count: EMAIL_CODE_MISSES_PER_ADDRESS_MAX - 2 * (EMAIL_CODE_MISSES_PER_REQUEST_MAX - 1),
    });
    expect([tenth.at(-1)?.status, await tenth.at(-1)?.json()]).toEqual([TOO_MANY_STATUS, CODE_LOCKED]);
    const fourth = await askedLink({ email });
    const right = await redeemCode({ email, code: fourth.code, verifier: fourth.verifier });
    expect([right.status, await right.json()]).toEqual([TOO_MANY_STATUS, CODE_LOCKED]);
  });

  test('the address lock does not stop the link from signing in', async () => {
    const email = freshAddress();
    const first = await askedLink({ email });
    const second = await askedLink({ email });
    await wrongCodes({ email, verifier: first.verifier, count: EMAIL_CODE_MISSES_PER_REQUEST_MAX - 1 });
    await wrongCodes({ email, verifier: second.verifier, count: EMAIL_CODE_MISSES_PER_REQUEST_MAX - 1 });
    const third = await askedLink({ email });
    await wrongCodes({ email, verifier: third.verifier, count: 2 });
    const fourth = await askedLink({ email });
    expect((await redeemLink({ token: fourth.token, verifier: fourth.verifier })).status).toBe(CREATED_STATUS);
  });

  test('the address lock lifts after 24 hours', async () => {
    const email = freshAddress();
    const first = await askedLink({ email });
    const second = await askedLink({ email });
    await wrongCodes({ email, verifier: first.verifier, count: EMAIL_CODE_MISSES_PER_REQUEST_MAX - 1 });
    await wrongCodes({ email, verifier: second.verifier, count: EMAIL_CODE_MISSES_PER_REQUEST_MAX - 1 });
    const third = await askedLink({ email });
    await wrongCodes({ email, verifier: third.verifier, count: 2 });
    const later = CLOCK_NOW + MILLISECONDS_PER_DAY + 1;
    const fresh = await askedLink({ email, now: later });
    expect((await redeemCode({ email, code: fresh.code, verifier: fresh.verifier, now: later })).status).toBe(CREATED_STATUS);
  });

  test('an address that never asked for a code answers exactly as one that did, and locks at the same count', async () => {
    const known = await askedLink();
    const unknownEmail = freshAddress();
    const unknownVerifier = generateCredentialSecret();
    const knownAnswers = await wrongCodes({ email: known.email, verifier: known.verifier, count: EMAIL_CODE_MISSES_PER_REQUEST_MAX + 1 });
    const unknownAnswers = await wrongCodes({
      email: unknownEmail,
      verifier: unknownVerifier,
      count: EMAIL_CODE_MISSES_PER_REQUEST_MAX + 1,
    });
    const describeAnswers = async (answers: Response[]) =>
      Promise.all(answers.map(async (answer) => [answer.status, await answer.json(), answer.headers.has(RETRY_AFTER_HEADER)]));
    expect(await describeAnswers(unknownAnswers)).toEqual(await describeAnswers(knownAnswers));
  });

  test('a wrong code for an address with no link is counted against that address like any other', async () => {
    const unknownEmail = freshAddress();
    await redeemCode({ email: unknownEmail, code: WRONG_CODE, verifier: generateCredentialSecret() });
    const { results } = await env.DIRECTORY.prepare('SELECT address_digest FROM sign_in_code_misses').all<{ address_digest: string }>();
    expect(results.map((row) => row.address_digest)).toContain(await digestCredential(unknownEmail));
  });
});

describe('the code limiter per client address', () => {
  const REFUSED_CLIENT = '198.51.100.77';

  test('a refusing code limiter answers 429 code_locked with Retry-After 60 before any code is looked at', async () => {
    const { limiter, keys } = recordingLimiter({ isAllowed: false });
    const workerEnv = emailEnv({ ...guardedSettings(), SIGN_IN_CODE_LIMITER: limiter });
    const answer = await redeemCode({
      email: freshAddress(),
      code: WRONG_CODE,
      verifier: generateCredentialSecret(),
      workerEnv,
      origin: PUBLIC_HTTPS_ORIGIN,
      headers: { 'CF-Connecting-IP': REFUSED_CLIENT },
    });
    expect([answer.status, await answer.json(), answer.headers.get(RETRY_AFTER_HEADER)]).toEqual([TOO_MANY_STATUS, CODE_LOCKED, '60']);
    expect(keys).toHaveLength(1);
  });

  test('a public host without the code limiter fails closed', async () => {
    const workerEnv = emailEnv({ ...guardedSettings(), SIGN_IN_CODE_LIMITER: undefined });
    const answer = await redeemCode({
      email: freshAddress(),
      code: WRONG_CODE,
      verifier: generateCredentialSecret(),
      workerEnv,
      origin: PUBLIC_HTTPS_ORIGIN,
      headers: { 'CF-Connecting-IP': REFUSED_CLIENT },
    });
    expect([answer.status, await answer.json()]).toEqual([UNAVAILABLE_STATUS, SIGN_IN_UNAVAILABLE]);
  });

  test('a link sign-in does not touch the code limiter', async () => {
    const { limiter, keys } = recordingLimiter({ isAllowed: true });
    const workerEnv = emailEnv({ ...guardedSettings(), SIGN_IN_CODE_LIMITER: limiter });
    await redeemLink({ token: generateCredentialSecret(), verifier: generateCredentialSecret(), workerEnv, origin: PUBLIC_HTTPS_ORIGIN });
    expect(keys).toEqual([]);
  });
});

describe('spendEmailCode', () => {
  test('answers Spent with the address for the right code and Wrong for a wrong one', async () => {
    const { email, code, verifier } = await askedLink();
    const challenge = await digestCredential(verifier);
    const base = { directory: env.DIRECTORY, table: CodeTable.SignInLinks, email, challenge, now: CLOCK_NOW };
    expect(await spendEmailCode({ ...base, code: WRONG_CODE })).toEqual({ verdict: CodeVerdict.Wrong });
    expect(await spendEmailCode({ ...base, code })).toEqual({ verdict: CodeVerdict.Spent, email });
  });
});
