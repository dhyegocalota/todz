import { SIGN_UPS_PER_CLIENT_DAY_MAX } from '@todz/types';
import { env } from 'cloudflare:workers';
import { describe, expect, test } from 'vitest';
import { digestCredential } from '../src/credential-digest';
import { findIdentityOwner, insertOwnerWithIdentity } from '../src/directory-owners';
import { isDisposableEmailAddress } from '../src/disposable-email-domains';
import { SignInProviderKind } from '../src/sign-in-provider';
import { signUpRefusalOf } from '../src/sign-up-limiter';

const FORBIDDEN_STATUS = 403;
const TOO_MANY_STATUS = 429;
const NOW = Date.parse('2026-11-26T12:00:00Z');
const FAIR_USE_URL = 'https://docs.todz.app/fair-use';
const SERVICE_ORIGIN = 'https://api.todz.app/owner/sessions';

function randomClientAddress(): string {
  const octet = () => String(Math.floor(Math.random() * 250) + 1);
  return `203.0.${octet()}.${octet()}`;
}

async function signUpKeyCount(): Promise<number> {
  const row = await env.DIRECTORY.prepare('SELECT COUNT(*) AS keys FROM sign_up_usage').first<{ keys: number }>();
  if (row === null) throw new Error('a count always answers');
  return row.keys;
}

function signUpRequest(clientAddress: string): Request {
  return new Request(SERVICE_ORIGIN, { method: 'POST', headers: { 'CF-Connecting-IP': clientAddress } });
}

function attemptNewAccount({ clientAddress, subject }: { clientAddress: string; subject: string }): Promise<Response | null> {
  return signUpRefusalOf({ request: signUpRequest(clientAddress), env, kind: SignInProviderKind.Email, subject, now: NOW });
}

describe('the daily sign-up cap per client', () => {
  test('the sign-up past the cap is refused with the daily limit and a retry time, and creates no owner', async () => {
    const clientAddress = randomClientAddress();
    const subjects = Array.from({ length: SIGN_UPS_PER_CLIENT_DAY_MAX + 1 }, () => `maria.${crypto.randomUUID()}@example.com`);
    const outcomes = [];
    for (const subject of subjects) outcomes.push(await attemptNewAccount({ clientAddress, subject }));
    expect(outcomes.slice(0, SIGN_UPS_PER_CLIENT_DAY_MAX)).toEqual(Array(SIGN_UPS_PER_CLIENT_DAY_MAX).fill(null));
    const refused = outcomes[SIGN_UPS_PER_CLIENT_DAY_MAX];
    if (refused === null || refused === undefined) throw new Error('the sign-up past the cap is refused');
    expect(refused.status).toBe(TOO_MANY_STATUS);
    expect(refused.headers.get('Retry-After')).not.toBeNull();
    expect(await refused.json()).toMatchObject({
      error: 'limit_reached',
      limit: 'daily_sign_ups',
      message: expect.stringContaining(FAIR_USE_URL),
    });
    const refusedSubject = subjects[SIGN_UPS_PER_CLIENT_DAY_MAX];
    if (refusedSubject === undefined) throw new Error('a subject was tried');
    expect(await findIdentityOwner({ directory: env.DIRECTORY, provider: SignInProviderKind.Email, subject: refusedSubject })).toBeNull();
  });

  test('an existing owner signs in past the cap', async () => {
    const clientAddress = randomClientAddress();
    const knownSubject = `known.${crypto.randomUUID()}@example.com`;
    await insertOwnerWithIdentity({
      directory: env.DIRECTORY,
      ownerId: crypto.randomUUID(),
      provider: SignInProviderKind.Email,
      subject: knownSubject,
      timeZone: 'UTC',
      now: NOW,
      cap: null,
    });
    for (let index = 0; index < SIGN_UPS_PER_CLIENT_DAY_MAX; index += 1) {
      await attemptNewAccount({ clientAddress, subject: `fill.${crypto.randomUUID()}@example.com` });
    }
    expect(await attemptNewAccount({ clientAddress, subject: knownSubject })).toBeNull();
  });

  test('the stored client key is a keyed digest: not the digest of the address, and another secret makes another key', async () => {
    const clientAddress = randomClientAddress();
    const keysBefore = await signUpKeyCount();
    await attemptNewAccount({ clientAddress, subject: `first.${crypto.randomUUID()}@example.com` });
    await signUpRefusalOf({
      request: signUpRequest(clientAddress),
      env: { ...env, SIGN_UP_KEY_SECRET: 'another-secret' },
      kind: SignInProviderKind.Email,
      subject: `second.${crypto.randomUUID()}@example.com`,
      now: NOW,
    });
    expect(await signUpKeyCount()).toBe(keysBefore + 2);
    const unkeyed = await env.DIRECTORY.prepare('SELECT client_key FROM sign_up_usage WHERE client_key = ?')
      .bind(await digestCredential(clientAddress))
      .first();
    expect(unkeyed).toBeNull();
  });

  test('a sign-up with no keying secret is refused as unavailable and counts nothing', async () => {
    const keysBefore = await signUpKeyCount();
    const response = await signUpRefusalOf({
      request: signUpRequest(randomClientAddress()),
      env: { ...env, SIGN_UP_KEY_SECRET: undefined },
      kind: SignInProviderKind.Email,
      subject: `nobody.${crypto.randomUUID()}@example.com`,
      now: NOW,
    });
    expect(response?.status).toBe(503);
    expect(await signUpKeyCount()).toBe(keysBefore);
  });

  test('a sign-up with no client address is refused as unavailable', async () => {
    const response = await signUpRefusalOf({
      request: new Request(SERVICE_ORIGIN, { method: 'POST' }),
      env,
      kind: SignInProviderKind.Email,
      subject: `nobody.${crypto.randomUUID()}@example.com`,
      now: NOW,
    });
    expect(response?.status).toBe(503);
  });
});

describe('the disposable email domains', () => {
  test('a new owner on a disposable domain is refused as a sign-up and creates nothing', async () => {
    const subject = `throwaway.${crypto.randomUUID()}@mailinator.com`;
    const response = await attemptNewAccount({ clientAddress: randomClientAddress(), subject });
    expect(response?.status).toBe(FORBIDDEN_STATUS);
    expect(await response?.json()).toMatchObject({ error: 'sign_up_refused', message: expect.stringContaining(FAIR_USE_URL) });
    expect(await findIdentityOwner({ directory: env.DIRECTORY, provider: SignInProviderKind.Email, subject })).toBeNull();
  });

  test('the domain match ignores case and needs the whole domain', () => {
    expect(isDisposableEmailAddress('x@MAILINATOR.com')).toBe(true);
    expect(isDisposableEmailAddress('x@notmailinator.com')).toBe(false);
  });

  test('a subdomain of a listed domain and a trailing dot are listed too', () => {
    expect(isDisposableEmailAddress('x@mail.mailinator.com')).toBe(true);
    expect(isDisposableEmailAddress('x@mailinator.com.')).toBe(true);
    expect(isDisposableEmailAddress('x@mail.Mailinator.COM.')).toBe(true);
    expect(isDisposableEmailAddress('x@mailinator.com.example.org')).toBe(false);
  });
});
