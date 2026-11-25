import { DAY_EMAIL_MINUTES_DEFAULT, MILLISECONDS_PER_DAY } from '@todz/types';
import { env } from 'cloudflare:workers';
import { describe, expect, test } from 'vitest';
import { enableDayEmail, seedOwner } from '../directory-seed';
import { ownerCall, signInCall, signInOwner } from '../owner-client';
import { CLOCK_NOW } from '../task-fixtures';

const OK_STATUS = 200;
const CREATED_STATUS = 201;
const BAD_REQUEST_STATUS = 400;
const INVALID_REQUEST = { error: 'invalid_request' };
const CHECK_FAILURE = /CHECK constraint failed/;
const SAO_PAULO_TIME_ZONE = 'America/Sao_Paulo';
const CHOSEN_MINUTES = 450;
const DIGEST_LENGTH = 64;

type StoredDayEmail = { day_email: number; day_email_minutes: number };
type OwnerAnswer = { owner: { id: string; time_zone: string; agent_nudge: boolean; day_email: boolean; day_email_minutes: number } };

function updateOwner({ token, body }: { token: string; body: unknown }): Promise<Response> {
  return ownerCall({ method: 'PATCH', path: '/owner', token, body });
}

async function storedDayEmail(ownerId: string): Promise<StoredDayEmail> {
  const row = await env.DIRECTORY.prepare('SELECT day_email, day_email_minutes FROM owners WHERE id = ?')
    .bind(ownerId)
    .first<StoredDayEmail>();
  if (row === null) throw new Error('the owner should exist');
  return row;
}

async function seedReplyAddress(ownerId: string): Promise<string> {
  const digest = crypto.randomUUID().replaceAll('-', '').padEnd(DIGEST_LENGTH, '0');
  await env.DIRECTORY.prepare('INSERT INTO day_email_reply_addresses (digest, owner_id, created_at, expires_at) VALUES (?, ?, ?, ?)')
    .bind(digest, ownerId, CLOCK_NOW, CLOCK_NOW + MILLISECONDS_PER_DAY)
    .run();
  return digest;
}

async function replyAddressDigests(ownerId: string): Promise<string[]> {
  const { results } = await env.DIRECTORY.prepare('SELECT digest FROM day_email_reply_addresses WHERE owner_id = ?')
    .bind(ownerId)
    .all<{ digest: string }>();
  return results.map((row) => row.digest);
}

describe('migration 0008 on the owner row', () => {
  test('a seeded owner reads the mail off at 07:00', async () => {
    const ownerId = await seedOwner();
    expect(await storedDayEmail(ownerId)).toEqual({ day_email: 0, day_email_minutes: DAY_EMAIL_MINUTES_DEFAULT });
  });

  test.each([['day_email = 2'], ['day_email = -1'], ['day_email_minutes = 1440'], ['day_email_minutes = -1']])(
    'the columns refuse %s',
    async (assignment) => {
      const ownerId = await seedOwner();
      const update = env.DIRECTORY.prepare(`UPDATE owners SET ${assignment} WHERE id = ?`).bind(ownerId).run();
      await expect(update).rejects.toThrow(CHECK_FAILURE);
    },
  );

  test.each([[0], [1439]])('the minute %i is accepted', async (minutes) => {
    const ownerId = await seedOwner();
    await enableDayEmail({ directory: env.DIRECTORY, ownerId, minutes });
    expect(await storedDayEmail(ownerId)).toEqual({ day_email: 1, day_email_minutes: minutes });
  });
});

describe('GET /owner and the sign-in answer', () => {
  test('answer the id, the zone, the nudge and the day email with its default for a new owner', async () => {
    const { token, ownerId } = await signInOwner({ timeZone: SAO_PAULO_TIME_ZONE });
    const response = await ownerCall({ method: 'GET', path: '/owner', token });
    expect(response.status).toBe(OK_STATUS);
    expect(await response.json()).toEqual({
      owner: {
        id: ownerId,
        time_zone: SAO_PAULO_TIME_ZONE,
        agent_nudge: false,
        day_email: false,
        day_email_minutes: DAY_EMAIL_MINUTES_DEFAULT,
      },
    });
  });

  test('a sign-in of an existing owner answers the stored values, not the defaults', async () => {
    const identityToken = crypto.randomUUID();
    const { ownerId } = await signInOwner({ identityToken });
    await enableDayEmail({ directory: env.DIRECTORY, ownerId, minutes: CHOSEN_MINUTES });
    const response = await ownerCall(signInCall({ identityToken, timeZone: 'UTC' }));
    expect(response.status).toBe(CREATED_STATUS);
    const answer = await response.json<OwnerAnswer>();
    expect(answer.owner).toEqual({ id: ownerId, time_zone: 'UTC', agent_nudge: false, day_email: true, day_email_minutes: CHOSEN_MINUTES });
  });
});

describe('PATCH /owner with the day email', () => {
  test('stores the switch, answers it and leaves the other three alone', async () => {
    const { token, ownerId } = await signInOwner({ timeZone: SAO_PAULO_TIME_ZONE });
    const response = await updateOwner({ token, body: { day_email: true } });
    expect(response.status).toBe(OK_STATUS);
    expect(await response.json()).toEqual({
      owner: {
        id: ownerId,
        time_zone: SAO_PAULO_TIME_ZONE,
        agent_nudge: false,
        day_email: true,
        day_email_minutes: DAY_EMAIL_MINUTES_DEFAULT,
      },
    });
    expect(await storedDayEmail(ownerId)).toEqual({ day_email: 1, day_email_minutes: DAY_EMAIL_MINUTES_DEFAULT });
  });

  test.each([[0], [CHOSEN_MINUTES], [1439]])('stores the minute %i and leaves the switch alone', async (minutes) => {
    const { token, ownerId } = await signInOwner();
    const response = await updateOwner({ token, body: { day_email_minutes: minutes } });
    expect(response.status).toBe(OK_STATUS);
    expect(await response.json()).toMatchObject({ owner: { day_email: false, day_email_minutes: minutes } });
    expect(await storedDayEmail(ownerId)).toEqual({ day_email: 0, day_email_minutes: minutes });
  });

  test('stores both fields sent together', async () => {
    const { token, ownerId } = await signInOwner();
    await updateOwner({ token, body: { day_email: true, day_email_minutes: CHOSEN_MINUTES } });
    expect(await storedDayEmail(ownerId)).toEqual({ day_email: 1, day_email_minutes: CHOSEN_MINUTES });
  });

  test('a zone alone leaves both day email fields alone', async () => {
    const { token, ownerId } = await signInOwner();
    await enableDayEmail({ directory: env.DIRECTORY, ownerId, minutes: CHOSEN_MINUTES });
    const response = await updateOwner({ token, body: { time_zone: 'Europe/Lisbon' } });
    expect(await response.json()).toMatchObject({ owner: { day_email: true, day_email_minutes: CHOSEN_MINUTES } });
    expect(await storedDayEmail(ownerId)).toEqual({ day_email: 1, day_email_minutes: CHOSEN_MINUTES });
  });

  test("one owner's patch never changes another owner's", async () => {
    const first = await signInOwner();
    const second = await signInOwner();
    await updateOwner({ token: first.token, body: { day_email: true, day_email_minutes: CHOSEN_MINUTES } });
    expect(await storedDayEmail(second.ownerId)).toEqual({ day_email: 0, day_email_minutes: DAY_EMAIL_MINUTES_DEFAULT });
  });

  test.each([
    ['minute 1440', { day_email_minutes: 1440 }],
    ['minute -1', { day_email_minutes: -1 }],
    ['minute 7.5', { day_email_minutes: 7.5 }],
    ['a time as text', { day_email_minutes: '07:00' }],
    ['a null minute', { day_email_minutes: null }],
    ['a text switch', { day_email: 'yes' }],
    ['a numeric switch', { day_email: 1 }],
    ['a null switch', { day_email: null }],
    ['a valid switch beside an invalid minute', { day_email: true, day_email_minutes: 1440 }],
  ])('%s answers 400 invalid_request and stores nothing', async (_name, body) => {
    const { token, ownerId } = await signInOwner();
    const response = await updateOwner({ token, body });
    expect(response.status).toBe(BAD_REQUEST_STATUS);
    expect(await response.json()).toEqual(INVALID_REQUEST);
    expect(await storedDayEmail(ownerId)).toEqual({ day_email: 0, day_email_minutes: DAY_EMAIL_MINUTES_DEFAULT });
  });

  test("turning the switch off deletes that owner's reply addresses and leaves another owner's", async () => {
    const { token, ownerId } = await signInOwner();
    const other = await signInOwner();
    await updateOwner({ token, body: { day_email: true } });
    await seedReplyAddress(ownerId);
    await seedReplyAddress(ownerId);
    const otherDigest = await seedReplyAddress(other.ownerId);
    await updateOwner({ token, body: { day_email: false } });
    expect(await replyAddressDigests(ownerId)).toEqual([]);
    expect(await replyAddressDigests(other.ownerId)).toEqual([otherDigest]);
  });

  test('turning the switch on or changing the minute keeps the reply addresses', async () => {
    const { token, ownerId } = await signInOwner();
    const digest = await seedReplyAddress(ownerId);
    await updateOwner({ token, body: { day_email: true } });
    await updateOwner({ token, body: { day_email_minutes: CHOSEN_MINUTES } });
    expect(await replyAddressDigests(ownerId)).toEqual([digest]);
  });
});
