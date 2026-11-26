import { CLOUD_ADMISSION_LAPSE_DAYS, CLOUD_INACTIVE_DAYS, CLOUD_MAILS_PER_ADDRESS_DAY_MAX, MILLISECONDS_PER_DAY } from '@todz/types';
import { env } from 'cloudflare:workers';
import { describe, expect, test, vi } from 'vitest';
import { cloudAccountsMaxOf } from '../src/cloud-accounts-max';
import { cloudCapOf, cloudFullRefusalOf, isCloudFullFor } from '../src/cloud-admission';
import { CLOUD_COPY } from '../src/cloud-copy';
import { countMailsSince } from '../src/cloud-mail-meter';
import {
  admitAddress,
  admitNextAddresses,
  countActiveAccounts,
  countOutstandingAdmissions,
  enqueueAddress,
  isAdmittedAddress,
  waitingAddresses,
} from '../src/cloud-queue-store';
import type { Env } from '../src/env';
import { findIdentityOwner, insertOwnerWithIdentity } from '../src/directory-owners';
import { emailSenderOf } from '../src/email-sender';
import { stampOwnerSeen } from '../src/owner-last-seen';
import { SignInProviderKind } from '../src/sign-in-provider';
import { TURNSTILE_DUMMY_TOKEN } from '../src/turnstile';
import { seedEmailIdentity, seedOwner } from './directory-seed';
import {
  CLIENT_ADDRESS,
  CLIENT_ADDRESS_HEADER,
  PUBLIC_ORIGIN,
  askedLink,
  bindingFailingWith,
  emailEnv,
  freshAddress,
  recordingBinding,
  requestLink,
} from './email-sign-in-client';
import { serveOwnerCall, workerEnvWith } from './owner-client';
import { CLOCK_NOW } from './task-fixtures';

const FORBIDDEN_STATUS = 403;
const ACCEPTED_STATUS = 202;
const CREATED_STATUS = 201;
const TOO_MANY_STATUS = 429;
const UNAVAILABLE_STATUS = 503;
const DAY_AFTER = CLOCK_NOW + MILLISECONDS_PER_DAY;
const SITE_ORIGIN = 'https://todz.app';
const ADMIN_ADDRESS = 'admin@example.com';
const SIX_ASKS = 6;

async function activeAccounts(): Promise<number> {
  return countActiveAccounts({ directory: env.DIRECTORY, now: CLOCK_NOW });
}

async function seedActiveAddress(): Promise<string> {
  const email = freshAddress();
  await seedEmailIdentity({ ownerId: await seedOwner(), email });
  return email;
}

async function seedAdmittedAddress(): Promise<string> {
  const email = freshAddress();
  await enqueueAddress({ directory: env.DIRECTORY, email, now: CLOCK_NOW });
  await admitAddress({ directory: env.DIRECTORY, email, now: CLOCK_NOW });
  return email;
}

async function takenSpots(): Promise<number> {
  return (await activeAccounts()) + (await countOutstandingAdmissions({ directory: env.DIRECTORY, now: CLOCK_NOW }));
}

async function fullCloudEnv(settings: Parameters<typeof emailEnv>[0] = {}) {
  await seedOwner();
  return emailEnv({ CLOUD_ACCOUNTS_MAX: String(await takenSpots()), ...settings });
}

async function linkRowCount(email: string): Promise<number> {
  const row = await env.DIRECTORY.prepare('SELECT COUNT(*) AS links FROM sign_in_links WHERE email = ?')
    .bind(email)
    .first<{ links: number }>();
  if (row === null) throw new Error('a count always answers');
  return row.links;
}

function signInWith({ link, workerEnv }: { link: { token: string; verifier: string }; workerEnv: ReturnType<typeof emailEnv> }) {
  return serveOwnerCall({
    call: {
      method: 'POST',
      path: '/owner/sessions',
      body: { identity_token: link.token, link_verifier: link.verifier, time_zone: 'UTC', turnstile_token: TURNSTILE_DUMMY_TOKEN },
      headers: { [CLIENT_ADDRESS_HEADER]: CLIENT_ADDRESS },
      origin: PUBLIC_ORIGIN,
    },
    now: CLOCK_NOW,
    workerEnv,
  });
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

  test('the full copy names the self-host guide', () => {
    expect(CLOUD_COPY.full).toContain('run your own server');
    expect(CLOUD_COPY.full).toContain('https://docs.todz.app/self-host');
  });

  test('at the cap the sign-in itself is refused for a new address', async () => {
    const email = freshAddress();
    const link = await askedLink({ email });
    const response = await signInWith({ link, workerEnv: await fullCloudEnv() });
    expect(response.status).toBe(FORBIDDEN_STATUS);
    expect(await response.json()).toEqual({ error: 'cloud_full', message: CLOUD_COPY.full });
    expect(await findIdentityOwner({ directory: env.DIRECTORY, provider: SignInProviderKind.Email, subject: email })).toBeNull();
  });

  test('an idle account at the cap is refused and under the cap it is let in', async () => {
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
    expect(await isCloudFullFor({ env: await fullCloudEnv(), address: email, now: DAY_AFTER })).toBe(false);
  });

  test('an unredeemed admission lapses after 7 days and the address waits again when it comes back', async () => {
    const email = freshAddress();
    await enqueueAddress({ directory: env.DIRECTORY, email, now: CLOCK_NOW });
    await admitAddress({ directory: env.DIRECTORY, email, now: CLOCK_NOW });
    const lapsedNow = CLOCK_NOW + (CLOUD_ADMISSION_LAPSE_DAYS + 1) * MILLISECONDS_PER_DAY;
    expect(await isAdmittedAddress({ directory: env.DIRECTORY, email, now: CLOCK_NOW + MILLISECONDS_PER_DAY })).toBe(true);
    expect(await isAdmittedAddress({ directory: env.DIRECTORY, email, now: lapsedNow })).toBe(false);
    await enqueueAddress({ directory: env.DIRECTORY, email, now: lapsedNow });
    const waiting = await waitingAddresses({ directory: env.DIRECTORY, limit: 1000 });
    expect(waiting.filter((queued) => queued.email === email)).toEqual([{ email, createdAt: lapsedNow }]);
  });

  test('the owner of the admin address is never full', async () => {
    const workerEnv = await fullCloudEnv({ ADMIN_EMAIL: ADMIN_ADDRESS });
    expect(await isCloudFullFor({ env: workerEnv, address: ADMIN_ADDRESS, now: CLOCK_NOW })).toBe(false);
    expect(await isCloudFullFor({ env: workerEnv, address: freshAddress(), now: CLOCK_NOW })).toBe(true);
  });
});

describe('a full cloud answers a link request like any other', () => {
  function recordedFullEnv({ binding }: { binding: SendEmail }) {
    return fullCloudEnv({ EMAIL: binding, EMAIL_SENDER: 'cloudflare', SITE_ORIGIN });
  }

  test('a refused address gets the same 202 as an admitted one and a full mail with a signed queue link, never a sign-in link', async () => {
    const { binding, sent } = recordingBinding();
    const workerEnv = await recordedFullEnv({ binding });
    const admittedEmail = freshAddress();
    await seedEmailIdentity({ ownerId: await seedOwner(), email: admittedEmail });
    const refusedEmail = freshAddress();
    const admitted = await requestLink({ email: admittedEmail, workerEnv });
    const refused = await requestLink({ email: refusedEmail, workerEnv });
    expect([refused.status, await refused.json()]).toEqual([admitted.status, await admitted.json()]);
    expect(refused.status).toBe(ACCEPTED_STATUS);
    const fullMail = sent.find((message) => message.to === refusedEmail);
    expect(fullMail?.subject).toBe(CLOUD_COPY.fullMail.subject);
    expect(fullMail?.text).toMatch(new RegExp(`${SITE_ORIGIN}/cloud-queue\\?token=[0-9a-f]+\\.\\d+\\.[0-9a-f]{64}`));
    expect(fullMail?.text).not.toContain('sign-in#token');
    expect(fullMail?.text).toContain('https://docs.todz.app/self-host');
    expect(fullMail?.text).toContain('extremely limited');
  });

  test.each([
    ['an active account', seedActiveAddress],
    ['an admitted address', seedAdmittedAddress],
    ['the admin address', async () => ADMIN_ADDRESS],
    ['a new address while full', async () => freshAddress()],
  ])('%s gets the same sequence of answers over six requests in a window as a new address with room', async (_class, addressOf) => {
    const { binding } = recordingBinding();
    const fullEnv = await fullCloudEnv({ EMAIL: binding, EMAIL_SENDER: 'cloudflare', SITE_ORIGIN, ADMIN_EMAIL: ADMIN_ADDRESS });
    const roomyEnv = emailEnv({
      EMAIL: binding,
      EMAIL_SENDER: 'cloudflare',
      SITE_ORIGIN,
      ADMIN_EMAIL: ADMIN_ADDRESS,
      CLOUD_ACCOUNTS_MAX: '100000',
    });
    const statusesOf = ({ email, workerEnv }: { email: string; workerEnv: Env }): Promise<number[]> =>
      Array.from({ length: SIX_ASKS }).reduce<Promise<number[]>>(
        async (statuses) => [...(await statuses), (await requestLink({ email, workerEnv })).status],
        Promise.resolve([]),
      );
    const subject = await addressOf();
    expect(await statusesOf({ email: subject, workerEnv: fullEnv })).toEqual(
      await statusesOf({ email: freshAddress(), workerEnv: roomyEnv }),
    );
  });

  test('an address that was refused is not told apart by the mail it gets either', async () => {
    const { binding, sent } = recordingBinding();
    const workerEnv = await recordedFullEnv({ binding });
    const admittedEmail = freshAddress();
    await seedEmailIdentity({ ownerId: await seedOwner(), email: admittedEmail });
    await requestLink({ email: admittedEmail, workerEnv });
    expect(sent.filter((message) => message.to === admittedEmail)).toHaveLength(1);
    expect(sent.find((message) => message.to === admittedEmail)?.subject).not.toBe(CLOUD_COPY.fullMail.subject);
  });

  test('a full mail that cannot be sent answers like a link that cannot be sent', async () => {
    const workerEnv = await fullCloudEnv({
      EMAIL: bindingFailingWith(new Error('mail down')),
      EMAIL_SENDER: 'cloudflare',
      SITE_ORIGIN,
    });
    const response = await requestLink({ workerEnv });
    expect(response.status).toBe(UNAVAILABLE_STATUS);
  });
});

describe('admissions reserve their spots', () => {
  test('with 49 active and one admitted a stranger is refused and the invitee signs in to the 50th', async () => {
    await env.DIRECTORY.prepare('DELETE FROM cloud_queue').run();
    const workerEnv = await fullCloudEnv();
    const accountsMax = Number(workerEnv.CLOUD_ACCOUNTS_MAX);
    const invitee = freshAddress();
    const room = emailEnv({ CLOUD_ACCOUNTS_MAX: String(accountsMax + 1) });
    await enqueueAddress({ directory: env.DIRECTORY, email: invitee, now: CLOCK_NOW });
    await admitAddress({ directory: env.DIRECTORY, email: invitee, now: CLOCK_NOW });
    expect(await isCloudFullFor({ env: room, address: freshAddress(), now: CLOCK_NOW })).toBe(true);
    const strangerCap = await cloudCapOf({ env: room, address: freshAddress(), now: CLOCK_NOW });
    expect(
      await insertOwnerWithIdentity({
        directory: env.DIRECTORY,
        ownerId: crypto.randomUUID(),
        provider: SignInProviderKind.Email,
        subject: freshAddress(),
        timeZone: 'UTC',
        now: CLOCK_NOW,
        cap: strangerCap,
      }),
    ).toBe(false);
    const inviteeCap = await cloudCapOf({ env: room, address: invitee, now: CLOCK_NOW });
    expect(
      await insertOwnerWithIdentity({
        directory: env.DIRECTORY,
        ownerId: crypto.randomUUID(),
        provider: SignInProviderKind.Email,
        subject: invitee,
        timeZone: 'UTC',
        now: CLOCK_NOW,
        cap: inviteeCap,
      }),
    ).toBe(true);
    expect(await takenSpots()).toBe(accountsMax + 1);
  });
});

describe('the mail meter', () => {
  test('every mail the cloudflare sender sends is recorded for its address', async () => {
    const { binding } = recordingBinding();
    const address = freshAddress();
    const sender = emailSenderOf({
      configured: 'cloudflare',
      publicOrigin: SITE_ORIGIN,
      requestUrl: SITE_ORIGIN,
      binding,
      meter: env.DIRECTORY,
    });
    const before = await countMailsSince({ directory: env.DIRECTORY, since: 0 });
    await sender?.send({ to: address, subject: 'Hello', html: '<p>Hello</p>', text: 'Hello', replyTo: 'hello@todz.app' });
    expect(await countMailsSince({ directory: env.DIRECTORY, since: 0 })).toBe(before + 1);
    const row = await env.DIRECTORY.prepare('SELECT COUNT(*) AS mails FROM mail_meter WHERE address = ?')
      .bind(address)
      .first<{ mails: number }>();
    expect(row?.mails).toBe(1);
  });

  test('a mail that went out stays sent when the meter cannot record it, and the failure is logged', async () => {
    const { binding, sent } = recordingBinding();
    const failure = new Error('d1 down');
    const brokenMeter = {
      prepare() {
        throw failure;
      },
    } as unknown as D1Database;
    const logged = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const sender = emailSenderOf({
      configured: 'cloudflare',
      publicOrigin: SITE_ORIGIN,
      requestUrl: SITE_ORIGIN,
      binding,
      meter: brokenMeter,
    });
    await expect(
      sender?.send({ to: freshAddress(), subject: 'Hello', html: '<p>Hello</p>', text: 'Hello', replyTo: 'hello@todz.app' }),
    ).resolves.toBeUndefined();
    expect(sent).toHaveLength(1);
    expect(logged).toHaveBeenCalledWith(expect.stringContaining('d1 down'));
  });

  test('a self-hosted server records nothing and bounds nothing', async () => {
    const { binding } = recordingBinding();
    const email = freshAddress();
    const workerEnv = emailEnv({ EMAIL: binding, EMAIL_SENDER: 'cloudflare', SITE_ORIGIN });
    const statement = env.DIRECTORY.prepare('INSERT INTO mail_meter (address, sent_at) VALUES (?, ?)');
    await env.DIRECTORY.batch(
      Array.from({ length: CLOUD_MAILS_PER_ADDRESS_DAY_MAX }, () => statement.bind(email, CLOCK_NOW - MILLISECONDS_PER_DAY / 2)),
    );
    const before = await countMailsSince({ directory: env.DIRECTORY, since: 0 });
    expect((await requestLink({ email, workerEnv })).status).toBe(ACCEPTED_STATUS);
    expect(await countMailsSince({ directory: env.DIRECTORY, since: 0 })).toBe(before);
  });

  test('a link request records its mail and the address is refused once its mail budget for the day is spent', async () => {
    const { binding, sent } = recordingBinding();
    const email = freshAddress();
    const workerEnv = emailEnv({ EMAIL: binding, EMAIL_SENDER: 'cloudflare', SITE_ORIGIN, CLOUD_ACCOUNTS_MAX: '100000' });
    const statement = env.DIRECTORY.prepare('INSERT INTO mail_meter (address, sent_at) VALUES (?, ?)');
    await env.DIRECTORY.batch(
      Array.from({ length: CLOUD_MAILS_PER_ADDRESS_DAY_MAX }, () => statement.bind(email, CLOCK_NOW - MILLISECONDS_PER_DAY / 2)),
    );
    const refused = await requestLink({ email, workerEnv });
    expect(refused.status).toBe(TOO_MANY_STATUS);
    expect(sent).toEqual([]);
    expect(await linkRowCount(email)).toBe(0);
    const other = await requestLink({ email: freshAddress(), workerEnv });
    expect(other.status).toBe(ACCEPTED_STATUS);
    expect(sent).toHaveLength(1);
  });

  test('mail older than a day no longer counts against the address', async () => {
    const { binding } = recordingBinding();
    const email = freshAddress();
    const workerEnv = emailEnv({ EMAIL: binding, EMAIL_SENDER: 'cloudflare', SITE_ORIGIN, CLOUD_ACCOUNTS_MAX: '100000' });
    const statement = env.DIRECTORY.prepare('INSERT INTO mail_meter (address, sent_at) VALUES (?, ?)');
    await env.DIRECTORY.batch(
      Array.from({ length: CLOUD_MAILS_PER_ADDRESS_DAY_MAX }, () => statement.bind(email, CLOCK_NOW - MILLISECONDS_PER_DAY - 1)),
    );
    expect((await requestLink({ email, workerEnv })).status).toBe(ACCEPTED_STATUS);
  });
});

describe('admission is a count-guarded insert', () => {
  async function insertAt({ email, cap }: { email: string; cap: Awaited<ReturnType<typeof cloudCapOf>> }): Promise<boolean> {
    return insertOwnerWithIdentity({
      directory: env.DIRECTORY,
      ownerId: crypto.randomUUID(),
      provider: SignInProviderKind.Email,
      subject: email,
      timeZone: 'UTC',
      now: CLOCK_NOW,
      cap,
    });
  }

  test('two sign-ins with one spot left end at the cap, not above it', async () => {
    await seedOwner();
    const workerEnv = emailEnv({ CLOUD_ACCOUNTS_MAX: String((await takenSpots()) + 1) });
    const [firstEmail, secondEmail] = [freshAddress(), freshAddress()];
    const firstCap = await cloudCapOf({ env: workerEnv, address: firstEmail, now: CLOCK_NOW });
    const secondCap = await cloudCapOf({ env: workerEnv, address: secondEmail, now: CLOCK_NOW });
    expect(await insertAt({ email: firstEmail, cap: firstCap })).toBe(true);
    expect(await insertAt({ email: secondEmail, cap: secondCap })).toBe(false);
    expect(await findIdentityOwner({ directory: env.DIRECTORY, provider: SignInProviderKind.Email, subject: secondEmail })).toBeNull();
    expect(await takenSpots()).toBe(Number(workerEnv.CLOUD_ACCOUNTS_MAX));
  });

  test('concurrent sign-ins at one spot admit exactly one', async () => {
    const [first, second] = [await askedLink(), await askedLink()];
    await seedOwner();
    const workerEnv = emailEnv({ CLOUD_ACCOUNTS_MAX: String((await takenSpots()) + 1) });
    const answers = await Promise.all([signInWith({ link: first, workerEnv }), signInWith({ link: second, workerEnv })]);
    expect(answers.map((answer) => answer.status).sort()).toEqual([CREATED_STATUS, FORBIDDEN_STATUS]);
  });

  test('an exempt address is inserted at the cap and without a cap everyone is', async () => {
    const workerEnv = await fullCloudEnv({ ADMIN_EMAIL: ADMIN_ADDRESS });
    const adminCap = await cloudCapOf({ env: workerEnv, address: ADMIN_ADDRESS, now: CLOCK_NOW });
    expect(await insertAt({ email: ADMIN_ADDRESS, cap: adminCap })).toBe(true);
    expect(await insertAt({ email: freshAddress(), cap: null })).toBe(true);
  });
});

describe('seeing an owner counts as activity', () => {
  async function idleOwner(): Promise<string> {
    const ownerId = crypto.randomUUID();
    const longAgo = CLOCK_NOW - (CLOUD_INACTIVE_DAYS + 30) * MILLISECONDS_PER_DAY;
    await env.DIRECTORY.prepare('INSERT INTO owners (id, time_zone, created_at) VALUES (?, ?, ?)').bind(ownerId, 'UTC', longAgo).run();
    return ownerId;
  }

  async function lastSeenDayOf(ownerId: string): Promise<string | null> {
    const row = await env.DIRECTORY.prepare('SELECT last_seen_day FROM owners WHERE id = ?')
      .bind(ownerId)
      .first<{ last_seen_day: string | null }>();
    if (row === null) throw new Error('the owner exists');
    return row.last_seen_day;
  }

  test('an owner seen today keeps its spot and one never seen frees it', async () => {
    const seenOwnerId = await idleOwner();
    const unseenOwnerId = await idleOwner();
    const before = await activeAccounts();
    await stampOwnerSeen({ env: emailEnv({ CLOUD_ACCOUNTS_MAX: '5' }), ownerId: seenOwnerId, now: CLOCK_NOW });
    expect(await activeAccounts()).toBe(before + 1);
    expect(await lastSeenDayOf(unseenOwnerId)).toBeNull();
  });

  test('the stamp writes once a day and only on the cloud', async () => {
    const ownerId = await idleOwner();
    await stampOwnerSeen({ env: workerEnvWith({}), ownerId, now: CLOCK_NOW });
    expect(await lastSeenDayOf(ownerId)).toBeNull();
    const cloud = emailEnv({ CLOUD_ACCOUNTS_MAX: '5' });
    await stampOwnerSeen({ env: cloud, ownerId, now: CLOCK_NOW });
    const firstDay = await lastSeenDayOf(ownerId);
    await stampOwnerSeen({ env: cloud, ownerId, now: CLOCK_NOW + 1000 });
    expect(await lastSeenDayOf(ownerId)).toBe(firstDay);
    await stampOwnerSeen({ env: cloud, ownerId, now: DAY_AFTER });
    expect(await lastSeenDayOf(ownerId)).not.toBe(firstDay);
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
});
