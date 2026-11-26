import { CLOUD_INACTIVE_DAYS, MILLISECONDS_PER_DAY } from '@todz/types';
import { env } from 'cloudflare:workers';
import { describe, expect, test } from 'vitest';
import { cloudAccountsMaxOf } from '../src/cloud-accounts-max';
import { cloudFullRefusalOf } from '../src/cloud-admission';
import { CLOUD_COPY } from '../src/cloud-copy';
import {
  admitAddress,
  admitNextAddresses,
  countActiveAccounts,
  enqueueAddress,
  takeQueueDigest,
  waitingAddresses,
} from '../src/cloud-queue-store';
import { workerEnvWith } from './owner-client';
import { emailEnv, freshAddress, requestLink } from './email-sign-in-client';
import { seedEmailIdentity, seedOwner } from './directory-seed';
import { CLOCK_NOW } from './task-fixtures';

const FORBIDDEN_STATUS = 403;
const ACCEPTED_STATUS = 202;
const DAY_AFTER = CLOCK_NOW + MILLISECONDS_PER_DAY;

async function fullCloudEnv() {
  await seedOwner();
  const accounts = await countActiveAccounts({ directory: env.DIRECTORY, now: CLOCK_NOW });
  return emailEnv({ CLOUD_ACCOUNTS_MAX: String(accounts) });
}

async function linkRowCount(email: string): Promise<number> {
  const row = await env.DIRECTORY.prepare('SELECT COUNT(*) AS links FROM sign_in_links WHERE email = ?')
    .bind(email)
    .first<{ links: number }>();
  if (row === null) throw new Error('a count always answers');
  return row.links;
}

describe('the cloud account cap', () => {
  test('without the var the cap is off and a new address gets its link', async () => {
    const response = await requestLink({ email: freshAddress() });
    expect(response.status).toBe(ACCEPTED_STATUS);
  });

  test('an empty var turns the cap off, as the test bindings need', () => {
    expect(cloudAccountsMaxOf(workerEnvWith({ CLOUD_ACCOUNTS_MAX: '' }))).toBeNull();
  });

  test('a malformed var throws instead of falling back', () => {
    expect(() => cloudAccountsMaxOf(workerEnvWith({ CLOUD_ACCOUNTS_MAX: 'many' }))).toThrow(
      'CLOUD_ACCOUNTS_MAX must be a positive whole number',
    );
  });

  test('at the cap a new address is refused with the full copy and no link row', async () => {
    const email = freshAddress();
    const response = await requestLink({ email, workerEnv: await fullCloudEnv() });
    expect(response.status).toBe(FORBIDDEN_STATUS);
    expect(await response.json()).toEqual({ error: 'cloud_full', message: CLOUD_COPY.full });
    expect(await linkRowCount(email)).toBe(0);
  });

  test('the full copy names the self-host guide', () => {
    expect(CLOUD_COPY.full).toContain('run your own server');
    expect(CLOUD_COPY.full).toContain('https://docs.todz.app/self-host');
  });

  test('at the cap an active account still gets its link', async () => {
    const email = freshAddress();
    await seedEmailIdentity({ ownerId: await seedOwner(), email });
    const response = await requestLink({ email, workerEnv: await fullCloudEnv() });
    expect(response.status).toBe(ACCEPTED_STATUS);
  });

  test('an account idle for 90 days at the cap is refused, and under the cap it is let in', async () => {
    const email = freshAddress();
    await seedEmailIdentity({ ownerId: await seedOwner(), email });
    const idleNow = CLOCK_NOW + CLOUD_INACTIVE_DAYS * MILLISECONDS_PER_DAY + MILLISECONDS_PER_DAY;
    await env.DIRECTORY.prepare('INSERT INTO owners (id, time_zone, created_at) VALUES (?, ?, ?)')
      .bind(crypto.randomUUID(), 'UTC', idleNow)
      .run();
    const accounts = await countActiveAccounts({ directory: env.DIRECTORY, now: idleNow });
    const refusal = await cloudFullRefusalOf({ env: emailEnv({ CLOUD_ACCOUNTS_MAX: String(accounts) }), address: email, now: idleNow });
    expect(refusal?.status).toBe(FORBIDDEN_STATUS);
    const roomy = await cloudFullRefusalOf({ env: emailEnv({ CLOUD_ACCOUNTS_MAX: String(accounts + 1) }), address: email, now: idleNow });
    expect(roomy).toBeNull();
  });

  test('an admitted address passes the cap', async () => {
    const email = freshAddress();
    await enqueueAddress({ directory: env.DIRECTORY, email, now: CLOCK_NOW });
    await admitAddress({ directory: env.DIRECTORY, email, now: DAY_AFTER });
    const response = await requestLink({ email, workerEnv: await fullCloudEnv() });
    expect(response.status).toBe(ACCEPTED_STATUS);
  });
});

describe('the cloud queue', () => {
  test('an address is stored once however often it is left', async () => {
    const email = freshAddress();
    await enqueueAddress({ directory: env.DIRECTORY, email, now: CLOCK_NOW });
    await enqueueAddress({ directory: env.DIRECTORY, email, now: DAY_AFTER });
    const waiting = await waitingAddresses({ directory: env.DIRECTORY, limit: 1000 });
    expect(waiting.filter((queued) => queued.email === email)).toEqual([{ email, createdAt: CLOCK_NOW }]);
  });

  test('admit next N admits the oldest N and only once', async () => {
    await env.DIRECTORY.prepare('DELETE FROM cloud_queue').run();
    const [first, second, third] = [freshAddress(), freshAddress(), freshAddress()];
    await enqueueAddress({ directory: env.DIRECTORY, email: second, now: CLOCK_NOW + 1 });
    await enqueueAddress({ directory: env.DIRECTORY, email: first, now: CLOCK_NOW });
    await enqueueAddress({ directory: env.DIRECTORY, email: third, now: CLOCK_NOW + 2 });
    const admitted = await admitNextAddresses({ directory: env.DIRECTORY, count: 2, now: DAY_AFTER });
    expect([...admitted].sort()).toEqual([first, second].sort());
    expect(await admitNextAddresses({ directory: env.DIRECTORY, count: 2, now: DAY_AFTER })).toEqual([third]);
  });

  test('the digest reports the count and the newest once, and stays silent until the queue grows', async () => {
    await env.DIRECTORY.prepare('DELETE FROM cloud_queue').run();
    const [older, newer] = [freshAddress(), freshAddress()];
    await enqueueAddress({ directory: env.DIRECTORY, email: older, now: CLOCK_NOW });
    await enqueueAddress({ directory: env.DIRECTORY, email: newer, now: CLOCK_NOW + 1 });
    expect(await takeQueueDigest({ directory: env.DIRECTORY, now: DAY_AFTER })).toEqual({ waiting: 2, newest: newer });
    expect(await takeQueueDigest({ directory: env.DIRECTORY, now: DAY_AFTER })).toBeNull();
    const latest = freshAddress();
    await enqueueAddress({ directory: env.DIRECTORY, email: latest, now: DAY_AFTER });
    expect(await takeQueueDigest({ directory: env.DIRECTORY, now: DAY_AFTER })).toEqual({ waiting: 3, newest: latest });
  });
});
