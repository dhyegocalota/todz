import { DueWindow, MILLISECONDS_PER_DAY, MILLISECONDS_PER_MINUTE } from '@todz/types';
import { createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { env, exports } from 'cloudflare:workers';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { digestCredential } from '../src/credential-digest';
import { generateCredentialSecret } from '../src/credential-secret';
import type { Env } from '../src/env';
import { McpToolName } from '../src/mcp-copy';
import { calendarDateInTimeZone } from '../src/owner-today';
import { TurnstileAction } from '../src/turnstile';
import { seedProject, seedProjectToken, seedProjectWithToken } from './directory-seed';
import {
  PUBLIC_HTTPS_ORIGIN,
  PUBLIC_ORIGIN,
  TURNSTILE_TOKEN_OF_ACTION,
  acceptingSiteverify,
  askedLink,
  emailEnv,
  freshAddress,
  guardedSettings,
  linkRows,
  messageSent,
  recordingBinding,
  redeemLink,
} from './email-sign-in-client';
import { ClientEra, callTool, connectClient } from './mcp-client';
import { ownerCall, serveOwnerCall, signInCall, signInOwner, workerEnvWith } from './owner-client';
import { CLOCK_NOW } from './task-fixtures';

const SESSION_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const WELCOME_SIGN_UPS_PER_CLIENT = '1000';
const SAO_PAULO_TIME_ZONE = 'America/Sao_Paulo';
const KIRITIMATI_TIME_ZONE = 'Pacific/Kiritimati';
const PAGO_PAGO_TIME_ZONE = 'Pacific/Pago_Pago';
const SESSION_LIFETIME_MS = 90 * MILLISECONDS_PER_DAY;
const SESSIONS_PER_OWNER_MAX = 20;
const LINK_LIFETIME_MS = 15 * MILLISECONDS_PER_MINUTE;
const FAKE_PROVIDER = 'fake';
const DEFAULT_DAY_EMAIL_MINUTES = 420;
const OK_STATUS = 200;
const CREATED_STATUS = 201;
const NO_CONTENT_STATUS = 204;
const BAD_REQUEST_STATUS = 400;
const UNAUTHORIZED_STATUS = 401;
const NOT_FOUND_STATUS = 404;
const UNPROCESSABLE_STATUS = 422;
const UNAVAILABLE_STATUS = 503;
const BEARER_CHALLENGE = 'Bearer';
const INVALID_REQUEST = { error: 'invalid_request' };
const TIME_ZONE_INVALID = { error: 'time_zone_invalid' };
const IDENTITY_REJECTED = { error: 'identity_rejected' };
const SIGN_IN_UNAVAILABLE = { error: 'sign_in_unavailable' };

type CountRow = { total: number };
type IdentityRow = { owner_id: string };
type SessionRow = { digest: string; owner_id: string; created_at: number; expires_at: number };
type OwnerRow = { time_zone: string };
type AgentNudgeRow = { agent_nudge: number };

async function total({ statement, parameters }: { statement: string; parameters: string[] }): Promise<number> {
  const row = await env.DIRECTORY.prepare(statement)
    .bind(...parameters)
    .first<CountRow>();
  if (row === null) throw new Error('count always answers a row');
  return row.total;
}

function ownerCount(): Promise<number> {
  return total({ statement: 'SELECT count(*) AS total FROM owners', parameters: [] });
}

function identityCount(subject: string): Promise<number> {
  return total({
    statement: 'SELECT count(*) AS total FROM owner_identities WHERE provider = ? AND subject = ?',
    parameters: [FAKE_PROVIDER, subject],
  });
}

function sessionCount(ownerId: string): Promise<number> {
  return total({ statement: 'SELECT count(*) AS total FROM sessions WHERE owner_id = ?', parameters: [ownerId] });
}

async function identityOwnerId(subject: string): Promise<string> {
  const row = await env.DIRECTORY.prepare('SELECT owner_id FROM owner_identities WHERE provider = ? AND subject = ?')
    .bind(FAKE_PROVIDER, subject)
    .first<IdentityRow>();
  if (row === null) throw new Error('the identity should exist');
  return row.owner_id;
}

async function ownerTimeZone(ownerId: string): Promise<string> {
  const row = await env.DIRECTORY.prepare('SELECT time_zone FROM owners WHERE id = ?').bind(ownerId).first<OwnerRow>();
  if (row === null) throw new Error('the owner should exist');
  return row.time_zone;
}

async function ownerAgentNudge(ownerId: string): Promise<boolean> {
  const row = await env.DIRECTORY.prepare('SELECT agent_nudge FROM owners WHERE id = ?').bind(ownerId).first<AgentNudgeRow>();
  if (row === null) throw new Error('the owner should exist');
  return row.agent_nudge === 1;
}

async function sessionRow(token: string): Promise<SessionRow> {
  const row = await env.DIRECTORY.prepare('SELECT digest, owner_id, created_at, expires_at FROM sessions WHERE digest = ?')
    .bind(await digestCredential(token))
    .first<SessionRow>();
  if (row === null) throw new Error('the session should exist');
  return row;
}

function readOwner(token: string): Promise<Response> {
  return ownerCall({ method: 'GET', path: '/owner', token });
}

function updateOwner({ token, body }: { token: string; body: unknown }): Promise<Response> {
  return ownerCall({ method: 'PATCH', path: '/owner', token, body });
}

async function expectUnauthorized(response: Response): Promise<void> {
  expect(response.status).toBe(UNAUTHORIZED_STATUS);
  expect(response.headers.get('WWW-Authenticate')).toBe(BEARER_CHALLENGE);
  expect(await response.text()).toBe('');
}

function envWithProvider(provider: string | undefined): Env {
  return { DIRECTORY: env.DIRECTORY, PROJECT_STORE: env.PROJECT_STORE, SIGN_IN_PROVIDER: provider, PUBLIC_ORIGIN };
}

function directoryRunning({
  beforeIdentityRead,
  failBatch,
  settings = { SIGN_IN_PROVIDER: FAKE_PROVIDER, PUBLIC_ORIGIN },
}: {
  beforeIdentityRead?: () => Promise<void>;
  failBatch?: Error;
  settings?: Partial<Env>;
}): Env {
  let hasRaced = false;
  const directory = new Proxy(env.DIRECTORY, {
    get(target, property) {
      const member = Reflect.get(target, property);
      if (property === 'batch' && failBatch !== undefined) return () => Promise.reject(failBatch);
      if (property !== 'prepare') return typeof member === 'function' ? member.bind(target) : member;
      return (statement: string) => {
        const isFirstIdentityRead = beforeIdentityRead !== undefined && !hasRaced && statement.includes('FROM owner_identities');
        if (!isFirstIdentityRead) return target.prepare(statement);
        hasRaced = true;
        return {
          bind: () => ({
            first: async () => {
              await beforeIdentityRead();
              return null;
            },
          }),
        };
      };
    },
  }) as D1Database;
  return { DIRECTORY: directory, PROJECT_STORE: env.PROJECT_STORE, ...settings };
}

describe('POST /owner/sessions', () => {
  test('answers 201 with a 43-character token, the canonical zone and a stored digest only', async () => {
    const identityToken = crypto.randomUUID();
    const response = await ownerCall(signInCall({ identityToken, timeZone: 'america/sao_paulo' }));
    expect(response.status).toBe(CREATED_STATUS);
    expect(response.headers.get('Content-Type')).toContain('application/json');
    const body = await response.json<{ session_token: string; owner: { id: string; time_zone: string } }>();
    expect(Object.keys(body).sort()).toEqual(['owner', 'session_token']);
    expect(body.session_token).toMatch(SESSION_TOKEN_PATTERN);
    expect(body.owner).toEqual({
      id: await identityOwnerId(identityToken),
      time_zone: SAO_PAULO_TIME_ZONE,
      agent_nudge: true,
      day_email: true,
      day_email_minutes: DEFAULT_DAY_EMAIL_MINUTES,
    });
    expect(await ownerTimeZone(body.owner.id)).toBe(SAO_PAULO_TIME_ZONE);
    const stored = await sessionRow(body.session_token);
    expect(stored.owner_id).toBe(body.owner.id);
    expect(Object.values(stored)).not.toContain(body.session_token);
  });

  test('a new owner starts with the agent nudge and the day email on', async () => {
    const { token, ownerId } = await signInOwner();
    expect(await (await readOwner(token)).json()).toEqual({
      owner: { id: ownerId, time_zone: 'UTC', agent_nudge: true, day_email: true, day_email_minutes: DEFAULT_DAY_EMAIL_MINUTES },
    });
  });

  test('the same identity again answers the same owner, a new token and the new zone', async () => {
    const identityToken = crypto.randomUUID();
    const first = await signInOwner({ identityToken, timeZone: 'UTC' });
    const response = await ownerCall(signInCall({ identityToken, timeZone: KIRITIMATI_TIME_ZONE }));
    expect(response.status).toBe(CREATED_STATUS);
    const body = await response.json<{ session_token: string; owner: { id: string; time_zone: string } }>();
    expect(body.owner).toEqual({
      id: first.ownerId,
      time_zone: KIRITIMATI_TIME_ZONE,
      agent_nudge: true,
      day_email: true,
      day_email_minutes: DEFAULT_DAY_EMAIL_MINUTES,
    });
    expect(body.session_token).not.toBe(first.token);
    expect(await ownerTimeZone(first.ownerId)).toBe(KIRITIMATI_TIME_ZONE);
    expect((await readOwner(first.token)).status).toBe(OK_STATUS);
    expect((await readOwner(body.session_token)).status).toBe(OK_STATUS);
  });

  test('two identities are two owners', async () => {
    const first = await signInOwner();
    const second = await signInOwner();
    expect(first.ownerId).not.toBe(second.ownerId);
  });

  test('a time zone no zone database knows answers 422 and creates no owner', async () => {
    const identityToken = crypto.randomUUID();
    const owners = await ownerCount();
    const response = await ownerCall(signInCall({ identityToken, timeZone: 'Nope/Zone' }));
    expect(response.status).toBe(UNPROCESSABLE_STATUS);
    expect(await response.json()).toEqual(TIME_ZONE_INVALID);
    expect(await identityCount(identityToken)).toBe(0);
    expect(await ownerCount()).toBe(owners);
  });

  test('an offset zone answers 422 and an existing owner keeps its zone', async () => {
    const identityToken = crypto.randomUUID();
    const { ownerId } = await signInOwner({ identityToken, timeZone: SAO_PAULO_TIME_ZONE });
    const response = await ownerCall(signInCall({ identityToken, timeZone: '+01:00' }));
    expect(response.status).toBe(UNPROCESSABLE_STATUS);
    expect(await response.json()).toEqual(TIME_ZONE_INVALID);
    expect(await ownerTimeZone(ownerId)).toBe(SAO_PAULO_TIME_ZONE);
    expect(await sessionCount(ownerId)).toBe(1);
  });

  test('an identity token the provider refuses answers 401 identity_rejected and echoes nothing', async () => {
    const owners = await ownerCount();
    const response = await ownerCall(signInCall({ identityToken: 'a b', timeZone: 'UTC' }));
    expect(response.status).toBe(UNAUTHORIZED_STATUS);
    expect(await response.text()).toBe(JSON.stringify(IDENTITY_REJECTED));
    expect(await ownerCount()).toBe(owners);
  });

  test.each([
    ['a body that is not JSON', { rawBody: 'not json' }],
    ['an empty body', { rawBody: '' }],
    ['a JSON null', { rawBody: 'null' }],
    ['a JSON array', { rawBody: '[]' }],
    ['a missing identity token', { body: { time_zone: 'UTC' } }],
    ['a missing time zone', { body: { identity_token: 'maria' } }],
    ['a numeric time zone', { body: { identity_token: 'maria', time_zone: 5 } }],
    ['a numeric identity token', { body: { identity_token: 5, time_zone: 'UTC' } }],
  ])('%s answers 400 invalid_request and creates no owner', async (_name, payload) => {
    const owners = await ownerCount();
    const response = await ownerCall({ method: 'POST', path: '/owner/sessions', ...payload });
    expect(response.status).toBe(BAD_REQUEST_STATUS);
    expect(await response.json()).toEqual(INVALID_REQUEST);
    expect(await ownerCount()).toBe(owners);
  });

  test.each([['text/plain'], ['application/x-www-form-urlencoded']])(
    'a body of content type %j answers 400 invalid_request and creates no owner',
    async (contentType) => {
      const owners = await ownerCount();
      const response = await ownerCall({
        method: 'POST',
        path: '/owner/sessions',
        rawBody: JSON.stringify({ identity_token: 'maria', time_zone: 'UTC' }),
        headers: { 'Content-Type': contentType },
      });
      expect(response.status).toBe(BAD_REQUEST_STATUS);
      expect(await response.json()).toEqual(INVALID_REQUEST);
      expect(await ownerCount()).toBe(owners);
    },
  );

  test('a stray or invalid Authorization header does not matter to sign-in', async () => {
    const response = await ownerCall({ ...signInCall({ identityToken: crypto.randomUUID(), timeZone: 'UTC' }), token: 'unknown' });
    expect(response.status).toBe(CREATED_STATUS);
  });

  test.each([
    ['no provider configured', undefined],
    ['the provider apple', 'apple'],
  ])('%s answers 503 sign_in_unavailable and creates nothing', async (_name, provider) => {
    const identityToken = crypto.randomUUID();
    const owners = await ownerCount();
    const response = await serveOwnerCall({
      call: signInCall({ identityToken, timeZone: 'UTC' }),
      now: CLOCK_NOW,
      workerEnv: envWithProvider(provider),
    });
    expect(response.status).toBe(UNAVAILABLE_STATUS);
    expect(await response.json()).toEqual(SIGN_IN_UNAVAILABLE);
    expect(await identityCount(identityToken)).toBe(0);
    expect(await ownerCount()).toBe(owners);
  });

  test.each([
    ['a public PUBLIC_ORIGIN', { SIGN_IN_PROVIDER: FAKE_PROVIDER, PUBLIC_ORIGIN: PUBLIC_HTTPS_ORIGIN }],
    ['no PUBLIC_ORIGIN', { SIGN_IN_PROVIDER: FAKE_PROVIDER }],
  ])('the fake provider with %s answers 503 sign_in_unavailable and creates nothing', async (_name, settings) => {
    const identityToken = crypto.randomUUID();
    const response = await serveOwnerCall({
      call: signInCall({ identityToken, timeZone: 'UTC' }),
      now: CLOCK_NOW,
      workerEnv: workerEnvWith(settings),
    });
    expect(response.status).toBe(UNAVAILABLE_STATUS);
    expect(await response.json()).toEqual(SIGN_IN_UNAVAILABLE);
    expect(await identityCount(identityToken)).toBe(0);
  });

  test('the fake provider on a public request host answers 503 sign_in_unavailable', async () => {
    const response = await serveOwnerCall({
      call: { ...signInCall({ identityToken: crypto.randomUUID(), timeZone: 'UTC' }), origin: PUBLIC_HTTPS_ORIGIN },
      now: CLOCK_NOW,
      workerEnv: envWithProvider(FAKE_PROVIDER),
    });
    expect(response.status).toBe(UNAVAILABLE_STATUS);
    expect(await response.json()).toEqual(SIGN_IN_UNAVAILABLE);
  });

  test.each([
    ['provider before body', undefined, { rawBody: 'not json' }, UNAVAILABLE_STATUS, SIGN_IN_UNAVAILABLE],
    ['provider before identity', undefined, { body: { identity_token: 'a b', time_zone: 'UTC' } }, UNAVAILABLE_STATUS, SIGN_IN_UNAVAILABLE],
    [
      'provider before time zone',
      'apple',
      { body: { identity_token: 'maria', time_zone: 'Nope/Zone' } },
      UNAVAILABLE_STATUS,
      SIGN_IN_UNAVAILABLE,
    ],
    ['body before identity', FAKE_PROVIDER, { body: { identity_token: 'a b' } }, BAD_REQUEST_STATUS, INVALID_REQUEST],
    ['body before time zone', FAKE_PROVIDER, { body: { identity_token: 'maria', time_zone: 5 } }, BAD_REQUEST_STATUS, INVALID_REQUEST],
    [
      'time zone before identity',
      FAKE_PROVIDER,
      { body: { identity_token: 'a b', time_zone: 'Nope/Zone' } },
      UNPROCESSABLE_STATUS,
      TIME_ZONE_INVALID,
    ],
    [
      'link verifier shape before identity',
      FAKE_PROVIDER,
      { body: { identity_token: 'maria', link_verifier: 'a b', time_zone: 'UTC' } },
      UNAUTHORIZED_STATUS,
      IDENTITY_REJECTED,
    ],
  ])('checks %s', async (_name, provider, payload, status, expected) => {
    const response = await serveOwnerCall({
      call: { method: 'POST', path: '/owner/sessions', ...payload },
      now: CLOCK_NOW,
      workerEnv: envWithProvider(provider),
    });
    expect(response.status).toBe(status);
    expect(await response.json()).toEqual(expected);
  });

  test('two concurrent first sign-ins of one identity make one owner and one identity row (smoke test, not the race)', async () => {
    const identityToken = crypto.randomUUID();
    const owners = await ownerCount();
    const [first, second] = await Promise.all([
      ownerCall(signInCall({ identityToken, timeZone: 'UTC' })),
      ownerCall(signInCall({ identityToken, timeZone: SAO_PAULO_TIME_ZONE })),
    ]);
    expect([first.status, second.status]).toEqual([CREATED_STATUS, CREATED_STATUS]);
    const firstBody = await first.json<{ owner: { id: string } }>();
    const secondBody = await second.json<{ owner: { id: string } }>();
    expect(firstBody.owner.id).toBe(secondBody.owner.id);
    expect(await identityCount(identityToken)).toBe(1);
    expect(await ownerCount()).toBe(owners + 1);
  });

  test('a first sign-in that loses the insert to a rival proceeds as the rival owner and leaves no orphan owner', async () => {
    const identityToken = crypto.randomUUID();
    const rivalOwnerId = crypto.randomUUID();
    const owners = await ownerCount();
    const racingEnv = directoryRunning({
      beforeIdentityRead: async () => {
        await env.DIRECTORY.batch([
          env.DIRECTORY.prepare('INSERT INTO owners (id, time_zone, created_at) VALUES (?, ?, ?)').bind(rivalOwnerId, 'UTC', CLOCK_NOW),
          env.DIRECTORY.prepare('INSERT INTO owner_identities (provider, subject, owner_id, created_at) VALUES (?, ?, ?, ?)').bind(
            FAKE_PROVIDER,
            identityToken,
            rivalOwnerId,
            CLOCK_NOW,
          ),
        ]);
      },
    });
    const response = await serveOwnerCall({
      call: signInCall({ identityToken, timeZone: KIRITIMATI_TIME_ZONE }),
      now: CLOCK_NOW,
      workerEnv: racingEnv,
    });
    expect(response.status).toBe(CREATED_STATUS);
    const body = await response.json<{ session_token: string; owner: { id: string; time_zone: string } }>();
    expect(body.owner).toEqual({
      id: rivalOwnerId,
      time_zone: KIRITIMATI_TIME_ZONE,
      agent_nudge: false,
      day_email: false,
      day_email_minutes: DEFAULT_DAY_EMAIL_MINUTES,
    });
    expect(await ownerCount()).toBe(owners + 1);
    expect(await identityCount(identityToken)).toBe(1);
    expect((await sessionRow(body.session_token)).owner_id).toBe(rivalOwnerId);
  });

  test('a first sign-in whose insert fails with no identity to find rethrows the failure and creates nothing', async () => {
    const identityToken = crypto.randomUUID();
    const failure = new Error('the directory is unavailable');
    const owners = await ownerCount();
    const answer = serveOwnerCall({
      call: signInCall({ identityToken, timeZone: 'UTC' }),
      now: CLOCK_NOW,
      workerEnv: directoryRunning({ failBatch: failure }),
    });
    await expect(answer).rejects.toThrow(failure.message);
    expect(await identityCount(identityToken)).toBe(0);
    expect(await ownerCount()).toBe(owners);
  });
});

describe('POST /owner/sessions with a sign-in link', () => {
  async function emailIdentityOwnerId(address: string): Promise<string> {
    const row = await env.DIRECTORY.prepare('SELECT owner_id FROM owner_identities WHERE provider = ? AND subject = ?')
      .bind('email', address)
      .first<IdentityRow>();
    if (row === null) throw new Error('the identity should exist');
    return row.owner_id;
  }

  async function redeemedStatus(link: { token: string; verifier?: string; now?: number }): Promise<number> {
    return (await redeemLink(link)).status;
  }

  test('a link answers 201 and an owner keyed by the address, with a session that reads the owner', async () => {
    const { token, verifier, email } = await askedLink({ email: `Maria.${crypto.randomUUID()}@Example.com` });
    const response = await redeemLink({ token, verifier, timeZone: SAO_PAULO_TIME_ZONE });
    expect(response.status).toBe(CREATED_STATUS);
    const body = await response.json<{ session_token: string; owner: { id: string; time_zone: string } }>();
    expect(body.session_token).toMatch(SESSION_TOKEN_PATTERN);
    expect(body.owner.time_zone).toBe(SAO_PAULO_TIME_ZONE);
    expect(await emailIdentityOwnerId(email.toLowerCase())).toBe(body.owner.id);
    expect((await readOwner(body.session_token)).status).toBe(OK_STATUS);
  });

  test('marks the link spent at the moment of redeeming', async () => {
    const { token, verifier, email } = await askedLink();
    await redeemLink({ token, verifier, now: CLOCK_NOW + 1 });
    expect((await linkRows(email)).map((row) => row.consumed_at)).toEqual([CLOCK_NOW + 1]);
  });

  test('a second link for the same address finds the same owner', async () => {
    const email = freshAddress();
    const first = await askedLink({ email });
    const second = await askedLink({ email });
    const firstBody = await (await redeemLink(first)).json<{ owner: { id: string } }>();
    const secondBody = await (await redeemLink(second)).json<{ owner: { id: string } }>();
    expect(secondBody.owner.id).toBe(firstBody.owner.id);
  });

  test('a spent link answers 401 identity_rejected and opens no second session', async () => {
    const link = await askedLink();
    expect(await redeemedStatus(link)).toBe(CREATED_STATUS);
    const response = await redeemLink(link);
    expect(response.status).toBe(UNAUTHORIZED_STATUS);
    expect(await response.json()).toEqual(IDENTITY_REJECTED);
    expect(await sessionCount(await emailIdentityOwnerId(link.email))).toBe(1);
  });

  test('a link redeems one millisecond before it expires and answers 401 at the moment it expires', async () => {
    const early = await askedLink();
    const late = await askedLink();
    expect(await redeemedStatus({ ...early, now: CLOCK_NOW + LINK_LIFETIME_MS - 1 })).toBe(CREATED_STATUS);
    expect(await redeemedStatus({ ...late, now: CLOCK_NOW + LINK_LIFETIME_MS })).toBe(UNAUTHORIZED_STATUS);
  });

  test.each([
    ['an unknown token', async () => ({ token: generateCredentialSecret(), verifier: generateCredentialSecret() })],
    ['a wrong verifier', async () => ({ ...(await askedLink()), verifier: generateCredentialSecret() })],
    ['no verifier', async () => ({ ...(await askedLink()), verifier: undefined })],
    ['a token that is not 43 characters', async () => ({ ...(await askedLink()), token: 'short' })],
    ['a malformed verifier', async () => ({ ...(await askedLink()), verifier: 'a b' })],
    ['an empty verifier', async () => ({ ...(await askedLink()), verifier: '' })],
  ])('%s answers 401 identity_rejected and creates no owner', async (_name, makeLink) => {
    const link = await makeLink();
    const owners = await ownerCount();
    const response = await redeemLink(link);
    expect(response.status).toBe(UNAUTHORIZED_STATUS);
    expect(await response.json()).toEqual(IDENTITY_REJECTED);
    expect(await ownerCount()).toBe(owners);
  });

  test('a wrong verifier does not spend the link', async () => {
    const link = await askedLink();
    expect(await redeemedStatus({ ...link, verifier: generateCredentialSecret() })).toBe(UNAUTHORIZED_STATUS);
    expect(await redeemedStatus(link)).toBe(CREATED_STATUS);
  });

  test('two concurrent redeems of one link give one 201 and one 401', async () => {
    const link = await askedLink();
    const statuses = await Promise.all([redeemedStatus(link), redeemedStatus(link)]);
    expect(statuses.sort()).toEqual([CREATED_STATUS, UNAUTHORIZED_STATUS]);
  });

  test('a bad time zone answers 422 and the same link then signs in', async () => {
    const link = await askedLink();
    const owners = await ownerCount();
    const rejected = await redeemLink({ ...link, timeZone: 'Nope/Zone' });
    expect(rejected.status).toBe(UNPROCESSABLE_STATUS);
    expect(await rejected.json()).toEqual(TIME_ZONE_INVALID);
    expect(await ownerCount()).toBe(owners);
    expect(await redeemedStatus(link)).toBe(CREATED_STATUS);
  });

  test('the email provider refuses a fake identity token', async () => {
    expect(await redeemedStatus({ token: crypto.randomUUID(), verifier: generateCredentialSecret() })).toBe(UNAUTHORIZED_STATUS);
  });

  test('the fake provider ignores a verifier', async () => {
    const response = await ownerCall({
      method: 'POST',
      path: '/owner/sessions',
      body: { identity_token: crypto.randomUUID(), link_verifier: generateCredentialSecret(), time_zone: 'UTC' },
    });
    expect(response.status).toBe(CREATED_STATUS);
  });
});

describe('owner sessions', () => {
  test('a session expires 90 days after sign-in, and a request at exactly that moment answers 401', async () => {
    const identityToken = crypto.randomUUID();
    const signIn = await serveOwnerCall({ call: signInCall({ identityToken, timeZone: 'UTC' }), now: CLOCK_NOW });
    const { session_token: token } = await signIn.json<{ session_token: string }>();
    const stored = await sessionRow(token);
    expect(stored.created_at).toBe(CLOCK_NOW);
    expect(stored.expires_at).toBe(CLOCK_NOW + SESSION_LIFETIME_MS);
    const almost = await serveOwnerCall({ call: { method: 'GET', path: '/owner', token }, now: stored.expires_at - 1 });
    expect(almost.status).toBe(OK_STATUS);
    await expectUnauthorized(await serveOwnerCall({ call: { method: 'GET', path: '/owner', token }, now: stored.expires_at }));
  });

  test('the twenty-first session of an owner at one instant removes the first and keeps the other twenty', async () => {
    const identityToken = crypto.randomUUID();
    const tokens = await Array.from({ length: SESSIONS_PER_OWNER_MAX + 1 }).reduce<Promise<string[]>>(async (issuedTokens) => {
      const response = await serveOwnerCall({ call: signInCall({ identityToken, timeZone: 'UTC' }), now: CLOCK_NOW });
      const { session_token: token } = await response.json<{ session_token: string }>();
      return [...(await issuedTokens), token];
    }, Promise.resolve([]));
    const statuses = await Promise.all(
      tokens.map(async (token) => (await serveOwnerCall({ call: { method: 'GET', path: '/owner', token }, now: CLOCK_NOW })).status),
    );
    expect(statuses).toEqual([UNAUTHORIZED_STATUS, ...Array.from({ length: SESSIONS_PER_OWNER_MAX }, () => OK_STATUS)]);
    expect(await sessionCount(await identityOwnerId(identityToken))).toBe(SESSIONS_PER_OWNER_MAX);
  });

  test('signing in drops the owner expired sessions and leaves another owner sessions alone', async () => {
    const identityToken = crypto.randomUUID();
    const other = await signInOwner();
    const first = await serveOwnerCall({ call: signInCall({ identityToken, timeZone: 'UTC' }), now: CLOCK_NOW });
    const { session_token: oldToken } = await first.json<{ session_token: string }>();
    const later = CLOCK_NOW + SESSION_LIFETIME_MS;
    const second = await serveOwnerCall({ call: signInCall({ identityToken, timeZone: 'UTC' }), now: later });
    const { session_token: newToken } = await second.json<{ session_token: string }>();
    expect(await sessionCount(await identityOwnerId(identityToken))).toBe(1);
    expect((await serveOwnerCall({ call: { method: 'GET', path: '/owner', token: newToken }, now: later })).status).toBe(OK_STATUS);
    expect((await serveOwnerCall({ call: { method: 'GET', path: '/owner', token: oldToken }, now: later })).status).toBe(
      UNAUTHORIZED_STATUS,
    );
    expect((await readOwner(other.token)).status).toBe(OK_STATUS);
  });

  test.each([
    ['no Authorization header', undefined],
    ['a Basic scheme', 'Basic abc'],
    ['an empty bearer', 'Bearer '],
    ['a blank bearer', 'Bearer    '],
    ['an unknown bearer', 'Bearer unknown-session'],
  ])('%s answers 401 with an empty body and the Bearer challenge', async (_name, authorization) => {
    const headers: Record<string, string> = authorization === undefined ? {} : { Authorization: authorization };
    await expectUnauthorized(await ownerCall({ method: 'GET', path: '/owner', headers }));
  });

  test('a session route answers 401 before it looks at the body', async () => {
    await expectUnauthorized(await ownerCall({ method: 'PATCH', path: '/owner', rawBody: 'not json' }));
  });

  test('an MCP access token is not an owner session, and an owner session is not an MCP access token', async () => {
    const { token: accessToken } = await seedProjectWithToken();
    await expectUnauthorized(await readOwner(accessToken));
    const { token } = await signInOwner();
    const mcp = await exports.default.fetch(`${PUBLIC_ORIGIN}/mcp`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
    expect(mcp.status).toBe(UNAUTHORIZED_STATUS);
    expect(mcp.headers.get('WWW-Authenticate')).toBe(
      `Bearer error="invalid_token", resource_metadata="${PUBLIC_ORIGIN}/.well-known/oauth-protected-resource/mcp"`,
    );
    expect(await mcp.json()).toMatchObject({ error: 'invalid_token' });
  });
});

describe('DELETE /owner/sessions/current', () => {
  test('answers 204, the same token then answers 401 and another session of the owner still works', async () => {
    const identityToken = crypto.randomUUID();
    const first = await signInOwner({ identityToken });
    const second = await signInOwner({ identityToken });
    const response = await ownerCall({ method: 'DELETE', path: '/owner/sessions/current', token: first.token });
    expect(response.status).toBe(NO_CONTENT_STATUS);
    expect(await response.text()).toBe('');
    await expectUnauthorized(await readOwner(first.token));
    expect((await readOwner(second.token)).status).toBe(OK_STATUS);
    expect(await sessionCount(first.ownerId)).toBe(1);
  });

  test('without a session answers 401', async () => {
    await expectUnauthorized(await ownerCall({ method: 'DELETE', path: '/owner/sessions/current' }));
  });

  test('signing out twice answers 204 then 401', async () => {
    const { token } = await signInOwner();
    expect((await ownerCall({ method: 'DELETE', path: '/owner/sessions/current', token })).status).toBe(NO_CONTENT_STATUS);
    await expectUnauthorized(await ownerCall({ method: 'DELETE', path: '/owner/sessions/current', token }));
  });
});

describe('GET /owner', () => {
  test('answers the owner id and zone', async () => {
    const { token, ownerId } = await signInOwner({ timeZone: SAO_PAULO_TIME_ZONE });
    const response = await readOwner(token);
    expect(response.status).toBe(OK_STATUS);
    expect(await response.json()).toEqual({
      owner: {
        id: ownerId,
        time_zone: SAO_PAULO_TIME_ZONE,
        agent_nudge: true,
        day_email: true,
        day_email_minutes: DEFAULT_DAY_EMAIL_MINUTES,
      },
    });
  });

  test('answers the flag the owner stored, and only the key owner sees it', async () => {
    const { token } = await signInOwner();
    const other = await signInOwner();
    await updateOwner({ token, body: { agent_nudge: false } });
    expect(await (await readOwner(token)).json()).toMatchObject({ owner: { agent_nudge: false } });
    expect(await (await readOwner(other.token)).json()).toMatchObject({ owner: { agent_nudge: true } });
  });
});

describe('PATCH /owner', () => {
  test('stores the canonical zone and answers the owner', async () => {
    const { token, ownerId } = await signInOwner();
    const response = await updateOwner({ token, body: { time_zone: 'america/sao_paulo' } });
    expect(response.status).toBe(OK_STATUS);
    expect(await response.json()).toEqual({
      owner: {
        id: ownerId,
        time_zone: SAO_PAULO_TIME_ZONE,
        agent_nudge: true,
        day_email: true,
        day_email_minutes: DEFAULT_DAY_EMAIL_MINUTES,
      },
    });
    expect(await ownerTimeZone(ownerId)).toBe(SAO_PAULO_TIME_ZONE);
  });

  test('stores the flag, answers it, leaves the zone alone and a later read agrees', async () => {
    const { token, ownerId } = await signInOwner({ timeZone: SAO_PAULO_TIME_ZONE });
    const response = await updateOwner({ token, body: { agent_nudge: false } });
    expect(response.status).toBe(OK_STATUS);
    expect(await response.json()).toEqual({
      owner: {
        id: ownerId,
        time_zone: SAO_PAULO_TIME_ZONE,
        agent_nudge: false,
        day_email: true,
        day_email_minutes: DEFAULT_DAY_EMAIL_MINUTES,
      },
    });
    expect(await ownerTimeZone(ownerId)).toBe(SAO_PAULO_TIME_ZONE);
    expect(await (await readOwner(token)).json()).toEqual({
      owner: {
        id: ownerId,
        time_zone: SAO_PAULO_TIME_ZONE,
        agent_nudge: false,
        day_email: true,
        day_email_minutes: DEFAULT_DAY_EMAIL_MINUTES,
      },
    });
  });

  test('turns the flag on again', async () => {
    const { token, ownerId } = await signInOwner();
    await updateOwner({ token, body: { agent_nudge: false } });
    const response = await updateOwner({ token, body: { agent_nudge: true } });
    expect(await response.json()).toEqual({
      owner: { id: ownerId, time_zone: 'UTC', agent_nudge: true, day_email: true, day_email_minutes: DEFAULT_DAY_EMAIL_MINUTES },
    });
  });

  test('a zone alone leaves a false flag alone and answers it', async () => {
    const { token, ownerId } = await signInOwner();
    await updateOwner({ token, body: { agent_nudge: false } });
    const response = await updateOwner({ token, body: { time_zone: 'Europe/Lisbon' } });
    expect(response.status).toBe(OK_STATUS);
    expect(await response.json()).toEqual({
      owner: { id: ownerId, time_zone: 'Europe/Lisbon', agent_nudge: false, day_email: true, day_email_minutes: DEFAULT_DAY_EMAIL_MINUTES },
    });
  });

  test('a zone and a flag together store both', async () => {
    const { token, ownerId } = await signInOwner();
    const response = await updateOwner({ token, body: { time_zone: 'Europe/Lisbon', agent_nudge: false } });
    expect(await response.json()).toEqual({
      owner: { id: ownerId, time_zone: 'Europe/Lisbon', agent_nudge: false, day_email: true, day_email_minutes: DEFAULT_DAY_EMAIL_MINUTES },
    });
  });

  test('a key the schema does not name is ignored', async () => {
    const { token, ownerId } = await signInOwner();
    const response = await updateOwner({ token, body: { time_zone: 'UTC', foo: 1 } });
    expect(response.status).toBe(OK_STATUS);
    expect(await response.json()).toEqual({
      owner: { id: ownerId, time_zone: 'UTC', agent_nudge: true, day_email: true, day_email_minutes: DEFAULT_DAY_EMAIL_MINUTES },
    });
  });

  test('an invalid zone with a valid flag answers 422 and stores neither', async () => {
    const { token, ownerId } = await signInOwner({ timeZone: SAO_PAULO_TIME_ZONE });
    const response = await updateOwner({ token, body: { time_zone: 'Mars/Base', agent_nudge: false } });
    expect(response.status).toBe(UNPROCESSABLE_STATUS);
    expect(await response.json()).toEqual(TIME_ZONE_INVALID);
    expect(await ownerTimeZone(ownerId)).toBe(SAO_PAULO_TIME_ZONE);
    expect(await ownerAgentNudge(ownerId)).toBe(true);
  });

  test("one owner's flag never changes another owner's", async () => {
    const first = await signInOwner();
    const second = await signInOwner();
    await updateOwner({ token: first.token, body: { agent_nudge: false } });
    expect(await ownerAgentNudge(first.ownerId)).toBe(false);
    expect(await ownerAgentNudge(second.ownerId)).toBe(true);
  });

  test('signing in again keeps a false flag and answers it', async () => {
    const identityToken = crypto.randomUUID();
    const { token, ownerId } = await signInOwner({ identityToken });
    await updateOwner({ token, body: { agent_nudge: false } });
    const response = await ownerCall(signInCall({ identityToken, timeZone: SAO_PAULO_TIME_ZONE }));
    expect(response.status).toBe(CREATED_STATUS);
    const body = await response.json<{ owner: unknown }>();
    expect(body.owner).toEqual({
      id: ownerId,
      time_zone: SAO_PAULO_TIME_ZONE,
      agent_nudge: false,
      day_email: true,
      day_email_minutes: DEFAULT_DAY_EMAIL_MINUTES,
    });
  });

  test.each([['+01:00'], ['Nope/Zone'], ['']])('the zone %j answers 422 and the zone is unchanged', async (timeZone) => {
    const { token, ownerId } = await signInOwner({ timeZone: SAO_PAULO_TIME_ZONE });
    const response = await updateOwner({ token, body: { time_zone: timeZone } });
    expect(response.status).toBe(UNPROCESSABLE_STATUS);
    expect(await response.json()).toEqual(TIME_ZONE_INVALID);
    expect(await ownerTimeZone(ownerId)).toBe(SAO_PAULO_TIME_ZONE);
  });

  test.each([
    ['a body that is not JSON', { rawBody: 'not json' }],
    ['an empty body', { body: {} }],
    ['a numeric time zone', { body: { time_zone: 5 } }],
    ['a text flag', { body: { agent_nudge: 'yes' } }],
    ['a numeric flag', { body: { agent_nudge: 1 } }],
    ['a null flag', { body: { agent_nudge: null } }],
  ])('%s answers 400 and nothing is stored', async (_name, payload) => {
    const { token, ownerId } = await signInOwner({ timeZone: SAO_PAULO_TIME_ZONE });
    const response = await ownerCall({ method: 'PATCH', path: '/owner', token, ...payload });
    expect(response.status).toBe(BAD_REQUEST_STATUS);
    expect(await response.json()).toEqual(INVALID_REQUEST);
    expect(await ownerTimeZone(ownerId)).toBe(SAO_PAULO_TIME_ZONE);
    expect(await ownerAgentNudge(ownerId)).toBe(true);
  });
});

describe('the owner time zone and the MCP today', () => {
  test('switching between Kiritimati and Pago Pago moves a task due on the Kiritimati date in and out of today', async () => {
    const { token, ownerId } = await signInOwner({ timeZone: KIRITIMATI_TIME_ZONE });
    const projectId = await seedProject({ ownerId });
    const client = await connectClient({ era: ClientEra.Modern, token: await seedProjectToken({ projectId }) });
    const dueDate = calendarDateInTimeZone({ timeZone: KIRITIMATI_TIME_ZONE, now: Date.now() });
    await callTool({ client, name: McpToolName.Add, args: { tasks: [{ title: 'Due on the Kiritimati date', due_date: dueDate }] } });
    const listToday = (): Promise<{ text: string }> => callTool({ client, name: McpToolName.List, args: { due: [DueWindow.Today] } });
    expect((await listToday()).text).toContain('Due on the Kiritimati date');
    await updateOwner({ token, body: { time_zone: PAGO_PAGO_TIME_ZONE } });
    expect((await listToday()).text).not.toContain('Due on the Kiritimati date');
    await updateOwner({ token, body: { time_zone: KIRITIMATI_TIME_ZONE } });
    expect((await listToday()).text).toContain('Due on the Kiritimati date');
  });
});

describe('the welcome mail', () => {
  const WELCOME_SUBJECT = 'Welcome to todz';
  const SIGN_IN_TOKEN = TURNSTILE_TOKEN_OF_ACTION[TurnstileAction.SignIn];

  beforeEach(() => {
    acceptingSiteverify();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function welcomeEnv({ binding, settings = {} }: { binding: SendEmail; settings?: Partial<Env> }): Env {
    return emailEnv({
      ...guardedSettings(),
      EMAIL: binding,
      FAIR_USE_SIGN_UPS_PER_CLIENT_DAY_MAX: WELCOME_SIGN_UPS_PER_CLIENT,
      ...settings,
    });
  }

  test('a new owner by link gets exactly one welcome to the address, with the lockup of the public origin', async () => {
    const { binding, sent } = recordingBinding();
    const link = await askedLink({ email: `Maria.${crypto.randomUUID()}@Example.com` });
    const response = await redeemLink({ ...link, turnstileToken: SIGN_IN_TOKEN, workerEnv: welcomeEnv({ binding }) });
    expect(response.status).toBe(CREATED_STATUS);
    const welcome = messageSent(sent);
    expect(welcome.to).toBe(link.email.toLowerCase());
    expect(welcome.subject).toBe(WELCOME_SUBJECT);
    expect(welcome.html).toContain(link.email.toLowerCase());
    expect(welcome.html).toContain(`src="${PUBLIC_HTTPS_ORIGIN}/brand/todz-lockup.png"`);
    expect(welcome.text).toContain(link.email.toLowerCase());
    expect(welcome.text).not.toMatch(/sign-in#token=/);
  });

  test('a returning owner by link gets none', async () => {
    const { binding, sent } = recordingBinding();
    const email = freshAddress();
    const first = await askedLink({ email });
    const second = await askedLink({ email });
    await redeemLink({ ...first, turnstileToken: SIGN_IN_TOKEN, workerEnv: welcomeEnv({ binding }) });
    await redeemLink({ ...second, turnstileToken: SIGN_IN_TOKEN, workerEnv: welcomeEnv({ binding }) });
    expect(sent).toHaveLength(1);
  });

  test('the fake provider gets none, because a fake subject is not an address', async () => {
    const { binding, sent } = recordingBinding();
    const response = await serveOwnerCall({
      call: signInCall({ identityToken: crypto.randomUUID(), timeZone: 'UTC' }),
      now: CLOCK_NOW,
      workerEnv: welcomeEnv({ binding, settings: { SIGN_IN_PROVIDER: FAKE_PROVIDER, PUBLIC_ORIGIN } }),
    });
    expect(response.status).toBe(CREATED_STATUS);
    expect(sent).toEqual([]);
  });

  test('a first sign-in that loses the insert to a rival gets none', async () => {
    const { binding, sent } = recordingBinding();
    const link = await askedLink();
    const rivalOwnerId = crypto.randomUUID();
    const racingEnv = directoryRunning({
      settings: { ...guardedSettings(), EMAIL: binding },
      beforeIdentityRead: async () => {
        await env.DIRECTORY.batch([
          env.DIRECTORY.prepare('INSERT INTO owners (id, time_zone, created_at) VALUES (?, ?, ?)').bind(rivalOwnerId, 'UTC', CLOCK_NOW),
          env.DIRECTORY.prepare('INSERT INTO owner_identities (provider, subject, owner_id, created_at) VALUES (?, ?, ?, ?)').bind(
            'email',
            link.email,
            rivalOwnerId,
            CLOCK_NOW,
          ),
        ]);
      },
    });
    const response = await redeemLink({ ...link, turnstileToken: SIGN_IN_TOKEN, workerEnv: racingEnv });
    expect(response.status).toBe(CREATED_STATUS);
    expect(sent).toEqual([]);
  });

  test('a welcome that throws after the session opened still answers 201 with a session that reads the owner', async () => {
    const send = vi.fn(async () => {
      throw new Error('the binding is down');
    });
    const link = await askedLink();
    const response = await redeemLink({ ...link, turnstileToken: SIGN_IN_TOKEN, workerEnv: welcomeEnv({ binding: { send } }) });
    expect(response.status).toBe(CREATED_STATUS);
    expect(send).toHaveBeenCalledTimes(1);
    const body = await response.json<{ session_token: string }>();
    expect((await readOwner(body.session_token)).status).toBe(OK_STATUS);
  });

  test.each([
    ['no sender kind', { EMAIL_SENDER: undefined }],
    ['an unknown sender kind', { EMAIL_SENDER: 'carrier-pigeon' }],
  ])('%s skips the welcome and still answers 201', async (_name, settings) => {
    const { binding, sent } = recordingBinding();
    const link = await askedLink();
    const response = await redeemLink({ ...link, turnstileToken: SIGN_IN_TOKEN, workerEnv: welcomeEnv({ binding, settings }) });
    expect(response.status).toBe(CREATED_STATUS);
    expect(sent).toEqual([]);
  });

  test('the cloudflare kind without the binding skips the welcome and still answers 201', async () => {
    const link = await askedLink();
    const response = await redeemLink({
      ...link,
      turnstileToken: SIGN_IN_TOKEN,
      workerEnv: emailEnv({ ...guardedSettings(), EMAIL: undefined, FAIR_USE_SIGN_UPS_PER_CLIENT_DAY_MAX: WELCOME_SIGN_UPS_PER_CLIENT }),
    });
    expect(response.status).toBe(CREATED_STATUS);
  });

  test('the sign-in answers while the welcome is still being sent, and the welcome settles through waitUntil', async () => {
    let release = (): void => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const send = vi.fn(async () => {
      await gate;
      return { messageId: crypto.randomUUID() };
    });
    const link = await askedLink();
    const executionContext = createExecutionContext();
    const response = await redeemLink({
      ...link,
      turnstileToken: SIGN_IN_TOKEN,
      workerEnv: welcomeEnv({ binding: { send } }),
      executionContext,
    });
    expect(response.status).toBe(CREATED_STATUS);
    expect(send).toHaveBeenCalledTimes(1);
    release();
    await waitOnExecutionContext(executionContext);
  });
});

describe('the worker paths', () => {
  test.each([[false], [true]])(
    '/ownerx and /owner/ and an unknown owner path answer 404 with an empty body (signed in: %s)',
    async (isSignedIn) => {
      const token = isSignedIn ? (await signInOwner()).token : undefined;
      await Promise.all(
        ['/ownerx', '/owner/', '/owner/nothing', '/owner/sessions'].map(async (path) => {
          const response = await ownerCall({ method: 'GET', path, token });
          expect(response.status).toBe(NOT_FOUND_STATUS);
          expect(await response.text()).toBe('');
        }),
      );
    },
  );

  test('a method no owner route has answers 404 with an empty body', async () => {
    const { token } = await signInOwner();
    const response = await ownerCall({ method: 'PUT', path: '/owner', token });
    expect(response.status).toBe(NOT_FOUND_STATUS);
    expect(await response.text()).toBe('');
  });
});
