import { MILLISECONDS_PER_MINUTE } from '@todz/types';
import { env } from 'cloudflare:workers';
import { describe, expect, test } from 'vitest';
import { serveOwnerCall, signInCall, signInOwner } from './owner-client';
import { CLOCK_NOW } from './task-fixtures';

const SAO_PAULO_TIME_ZONE = 'America/Sao_Paulo';
const OK_STATUS = 200;
const CREATED_STATUS = 201;
const LATER = CLOCK_NOW + MILLISECONDS_PER_MINUTE;

type ChoiceRow = { agent_nudge_chosen_at: number | null; day_email_chosen_at: number | null };

async function choiceTimes(ownerId: string): Promise<ChoiceRow> {
  const row = await env.DIRECTORY.prepare('SELECT agent_nudge_chosen_at, day_email_chosen_at FROM owners WHERE id = ?')
    .bind(ownerId)
    .first<ChoiceRow>();
  if (row === null) throw new Error('the owner should exist');
  return row;
}

async function patchAt({ token, body, now }: { token: string; body: unknown; now: number }): Promise<void> {
  const response = await serveOwnerCall({ call: { method: 'PATCH', path: '/owner', token, body }, now });
  expect(response.status).toBe(OK_STATUS);
}

describe('the time a setting was chosen', () => {
  test('a new owner has chosen nothing', async () => {
    const { ownerId } = await signInOwner();
    expect(await choiceTimes(ownerId)).toEqual({ agent_nudge_chosen_at: null, day_email_chosen_at: null });
  });

  test('turning the agent nudge off stamps its time with the request time and leaves the day email unstamped', async () => {
    const { token, ownerId } = await signInOwner();
    await patchAt({ token, body: { agent_nudge: false }, now: CLOCK_NOW });
    expect(await choiceTimes(ownerId)).toEqual({ agent_nudge_chosen_at: CLOCK_NOW, day_email_chosen_at: null });
  });

  test('turning the day email on while it is already on still stamps it', async () => {
    const { token, ownerId } = await signInOwner();
    await patchAt({ token, body: { day_email: true }, now: CLOCK_NOW });
    expect(await choiceTimes(ownerId)).toEqual({ agent_nudge_chosen_at: null, day_email_chosen_at: CLOCK_NOW });
  });

  test('a later choice moves the stamp of its own flag only', async () => {
    const { token, ownerId } = await signInOwner();
    await patchAt({ token, body: { agent_nudge: false }, now: CLOCK_NOW });
    await patchAt({ token, body: { day_email: false }, now: LATER });
    expect(await choiceTimes(ownerId)).toEqual({ agent_nudge_chosen_at: CLOCK_NOW, day_email_chosen_at: LATER });
  });

  test('a time zone alone stamps nothing', async () => {
    const { token, ownerId } = await signInOwner();
    await patchAt({ token, body: { time_zone: SAO_PAULO_TIME_ZONE }, now: CLOCK_NOW });
    expect(await choiceTimes(ownerId)).toEqual({ agent_nudge_chosen_at: null, day_email_chosen_at: null });
  });

  test('the day email minute alone stamps nothing', async () => {
    const { token, ownerId } = await signInOwner();
    await patchAt({ token, body: { day_email_minutes: 450 }, now: CLOCK_NOW });
    expect(await choiceTimes(ownerId)).toEqual({ agent_nudge_chosen_at: null, day_email_chosen_at: null });
  });

  test('a repeat sign-in stamps nothing', async () => {
    const { identityToken, ownerId } = await signInOwner();
    const response = await serveOwnerCall({ call: signInCall({ identityToken, timeZone: SAO_PAULO_TIME_ZONE }), now: CLOCK_NOW });
    expect(response.status).toBe(CREATED_STATUS);
    expect(await choiceTimes(ownerId)).toEqual({ agent_nudge_chosen_at: null, day_email_chosen_at: null });
  });

  test("one owner's choice stamps no other owner", async () => {
    const first = await signInOwner();
    const second = await signInOwner();
    await patchAt({ token: first.token, body: { agent_nudge: false, day_email: false }, now: CLOCK_NOW });
    expect(await choiceTimes(second.ownerId)).toEqual({ agent_nudge_chosen_at: null, day_email_chosen_at: null });
  });
});
