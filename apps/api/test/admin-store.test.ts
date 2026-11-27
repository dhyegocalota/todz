import { MILLISECONDS_PER_DAY, MILLISECONDS_PER_HOUR, MILLISECONDS_PER_MINUTE } from '@todz/types';
import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, test } from 'vitest';
import { digestCredential } from '../src/credential-digest';
import {
  adminSessionEmail,
  deleteAdminLink,
  deleteAdminSession,
  insertAdminLinkWithinLimit,
  openAdminSession,
  spendAdminLink,
} from '../src/site/admin-store';
import { adminLinkRows, adminSessionRows } from './admin-client';
import { CLOCK_NOW } from './task-fixtures';

const ADMIN_ADDRESS = 'hello@todz.app';
const OTHER_ADDRESS = 'someone@example.com';
const OTHER_DIGEST = 'f'.repeat(64);
const LINK_LIFETIME = 15 * MILLISECONDS_PER_MINUTE;
const SESSION_LIFETIME = 12 * MILLISECONDS_PER_HOUR;
const LINKS_PER_WINDOW_MAX = 5;

type LinkOverrides = { digest?: string; email?: string; challenge?: string; now?: number; windowStart?: number };

function randomDigest(): string {
  return crypto.randomUUID().replaceAll('-', '').repeat(2);
}

function insertLink({
  digest = randomDigest(),
  email = ADMIN_ADDRESS,
  challenge = randomDigest(),
  now = CLOCK_NOW,
  windowStart = now - LINK_LIFETIME,
}: LinkOverrides = {}): Promise<boolean> {
  return insertAdminLinkWithinLimit({
    database: env.DIRECTORY,
    digest,
    codeDigest: randomDigest(),
    codeSalt: randomDigest(),
    email,
    challenge,
    now,
    expiresAt: now + LINK_LIFETIME,
    windowStart,
    linksPerWindowMax: LINKS_PER_WINDOW_MAX,
  });
}

beforeEach(async () => {
  await env.DIRECTORY.batch([
    env.DIRECTORY.prepare('DELETE FROM admin_sign_in_links'),
    env.DIRECTORY.prepare('DELETE FROM admin_sessions'),
  ]);
});

describe('the admin sign-in links', () => {
  test('a link is stored as digests with its created and expiry times, unspent', async () => {
    const digest = await digestCredential('token');
    const challenge = await digestCredential('challenge');
    expect(await insertLink({ digest, challenge })).toBe(true);
    expect(await adminLinkRows(ADMIN_ADDRESS)).toEqual([
      { digest, email: ADMIN_ADDRESS, challenge, created_at: CLOCK_NOW, expires_at: CLOCK_NOW + LINK_LIFETIME, consumed_at: null },
    ]);
  });

  test('the sixth link of the address within the window is not stored', async () => {
    const stored = await Promise.all(Array.from({ length: LINKS_PER_WINDOW_MAX }, () => insertLink()));
    expect(stored).toEqual(Array(LINKS_PER_WINDOW_MAX).fill(true));
    expect(await insertLink()).toBe(false);
    expect(await adminLinkRows(ADMIN_ADDRESS)).toHaveLength(LINKS_PER_WINDOW_MAX);
  });

  test('links created before the window do not count toward the cap', async () => {
    const earlier = CLOCK_NOW - MILLISECONDS_PER_MINUTE;
    await Promise.all(
      Array.from({ length: LINKS_PER_WINDOW_MAX }, () => insertLink({ now: earlier, windowStart: earlier - LINK_LIFETIME })),
    );
    expect(await insertLink({ windowStart: CLOCK_NOW - MILLISECONDS_PER_MINUTE / 2 })).toBe(true);
  });

  test('the cap counts the address alone', async () => {
    await Promise.all(Array.from({ length: LINKS_PER_WINDOW_MAX }, () => insertLink()));
    expect(await insertLink({ email: OTHER_ADDRESS })).toBe(true);
  });

  test('expired links are deleted when another is inserted', async () => {
    const expiredDigest = await digestCredential('expired');
    await insertLink({ digest: expiredDigest, now: CLOCK_NOW - 2 * LINK_LIFETIME });
    await insertLink();
    const digests = (await adminLinkRows(ADMIN_ADDRESS)).map(({ digest }) => digest);
    expect(digests).not.toContain(expiredDigest);
    expect(digests).toHaveLength(1);
  });

  test('a link is spent once, by its own digest, challenge and address, and stays marked with the time', async () => {
    const digest = await digestCredential('token');
    const challenge = await digestCredential('challenge');
    await insertLink({ digest, challenge });
    const spending = { database: env.DIRECTORY, digest, challenge, email: ADMIN_ADDRESS, now: CLOCK_NOW + MILLISECONDS_PER_MINUTE };
    expect(await spendAdminLink(spending)).toBe(true);
    expect(await spendAdminLink(spending)).toBe(false);
    const [row] = await adminLinkRows(ADMIN_ADDRESS);
    expect(row?.consumed_at).toBe(spending.now);
  });

  test.each([
    ['another digest', { digest: OTHER_DIGEST }],
    ['another challenge', { challenge: OTHER_DIGEST }],
    ['another address', { email: OTHER_ADDRESS }],
  ])('a link is not spent with %s and stays unspent', async (_name, override) => {
    const digest = await digestCredential('token');
    const challenge = await digestCredential('challenge');
    await insertLink({ digest, challenge });
    const wrongSpending = { database: env.DIRECTORY, digest, challenge, email: ADMIN_ADDRESS, now: CLOCK_NOW, ...override };
    expect(await spendAdminLink(wrongSpending)).toBe(false);
    const [row] = await adminLinkRows(ADMIN_ADDRESS);
    expect(row?.consumed_at).toBeNull();
  });

  test('an expired link is not spent', async () => {
    const digest = await digestCredential('token');
    const challenge = await digestCredential('challenge');
    await insertLink({ digest, challenge });
    const spending = { database: env.DIRECTORY, digest, challenge, email: ADMIN_ADDRESS, now: CLOCK_NOW + LINK_LIFETIME };
    expect(await spendAdminLink(spending)).toBe(false);
  });

  test('two concurrent spends of one link let exactly one through', async () => {
    const digest = await digestCredential('token');
    const challenge = await digestCredential('challenge');
    await insertLink({ digest, challenge });
    const spending = { database: env.DIRECTORY, digest, challenge, email: ADMIN_ADDRESS, now: CLOCK_NOW };
    const outcomes = await Promise.all([spendAdminLink(spending), spendAdminLink(spending)]);
    expect(outcomes.filter((isSpent) => isSpent)).toHaveLength(1);
  });

  test('a deleted link is gone', async () => {
    const digest = await digestCredential('token');
    await insertLink({ digest });
    await deleteAdminLink({ database: env.DIRECTORY, digest });
    expect(await adminLinkRows(ADMIN_ADDRESS)).toEqual([]);
  });
});

describe('the admin sessions', () => {
  test('a session is found by its digest, with its address, until it expires', async () => {
    const digest = await digestCredential('secret');
    await openAdminSession({
      database: env.DIRECTORY,
      digest,
      email: ADMIN_ADDRESS,
      now: CLOCK_NOW,
      expiresAt: CLOCK_NOW + SESSION_LIFETIME,
    });
    expect(await adminSessionRows()).toEqual([
      { digest, email: ADMIN_ADDRESS, created_at: CLOCK_NOW, expires_at: CLOCK_NOW + SESSION_LIFETIME },
    ]);
    expect(await adminSessionEmail({ database: env.DIRECTORY, digest, now: CLOCK_NOW + SESSION_LIFETIME - 1 })).toBe(ADMIN_ADDRESS);
    expect(await adminSessionEmail({ database: env.DIRECTORY, digest, now: CLOCK_NOW + SESSION_LIFETIME })).toBeNull();
  });

  test('an unknown digest finds no session', async () => {
    expect(await adminSessionEmail({ database: env.DIRECTORY, digest: await digestCredential('unknown'), now: CLOCK_NOW })).toBeNull();
  });

  test('expired sessions are deleted when another is opened', async () => {
    const expiredDigest = await digestCredential('expired');
    await openAdminSession({
      database: env.DIRECTORY,
      digest: expiredDigest,
      email: ADMIN_ADDRESS,
      now: CLOCK_NOW - 2 * SESSION_LIFETIME,
      expiresAt: CLOCK_NOW - SESSION_LIFETIME,
    });
    const digest = await digestCredential('fresh');
    await openAdminSession({
      database: env.DIRECTORY,
      digest,
      email: ADMIN_ADDRESS,
      now: CLOCK_NOW,
      expiresAt: CLOCK_NOW + SESSION_LIFETIME,
    });
    expect((await adminSessionRows()).map((row) => row.digest)).toEqual([digest]);
  });

  test('a deleted session is gone and the others stay', async () => {
    const first = await digestCredential('first');
    const second = await digestCredential('second');
    const lifetime = { now: CLOCK_NOW, expiresAt: CLOCK_NOW + SESSION_LIFETIME };
    await openAdminSession({ database: env.DIRECTORY, digest: first, email: ADMIN_ADDRESS, ...lifetime });
    await openAdminSession({ database: env.DIRECTORY, digest: second, email: ADMIN_ADDRESS, ...lifetime });
    await deleteAdminSession({ database: env.DIRECTORY, digest: first });
    expect((await adminSessionRows()).map((row) => row.digest)).toEqual([second]);
  });
});
