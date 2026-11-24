import { DueWindow, MILLISECONDS_PER_DAY } from '@todz/types';
import { env, exports } from 'cloudflare:workers';
import { describe, expect, test } from 'vitest';
import { digestCredential } from '../src/credential-digest';
import type { Env } from '../src/env';
import { McpToolName } from '../src/mcp-copy';
import { calendarDateInTimeZone } from '../src/owner-today';
import { issueProjectKey } from '../src/project-keys';
import { seedIssuedKey, seedProject } from './directory-seed';
import { ClientEra, callTool, connectClient } from './mcp-client';
import { ownerCall, serveOwnerCall, signInCall, signInOwner } from './owner-client';
import { CLOCK_NOW } from './task-fixtures';

const SESSION_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const SAO_PAULO_TIME_ZONE = 'America/Sao_Paulo';
const KIRITIMATI_TIME_ZONE = 'Pacific/Kiritimati';
const PAGO_PAGO_TIME_ZONE = 'Pacific/Pago_Pago';
const SESSION_LIFETIME_MS = 90 * MILLISECONDS_PER_DAY;
const SESSIONS_PER_OWNER_MAX = 20;
const FAKE_PROVIDER = 'fake';
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
  return { DIRECTORY: env.DIRECTORY, PROJECT_STORE: env.PROJECT_STORE, SIGN_IN_PROVIDER: provider };
}

function directoryRunning({ beforeIdentityRead, failBatch }: { beforeIdentityRead?: () => Promise<void>; failBatch?: Error }): Env {
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
  return { DIRECTORY: directory, PROJECT_STORE: env.PROJECT_STORE, SIGN_IN_PROVIDER: FAKE_PROVIDER };
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
    expect(body.owner).toEqual({ id: await identityOwnerId(identityToken), time_zone: SAO_PAULO_TIME_ZONE });
    expect(await ownerTimeZone(body.owner.id)).toBe(SAO_PAULO_TIME_ZONE);
    const stored = await sessionRow(body.session_token);
    expect(stored.owner_id).toBe(body.owner.id);
    expect(Object.values(stored)).not.toContain(body.session_token);
  });

  test('the same identity again answers the same owner, a new token and the new zone', async () => {
    const identityToken = crypto.randomUUID();
    const first = await signInOwner({ identityToken, timeZone: 'UTC' });
    const response = await ownerCall(signInCall({ identityToken, timeZone: KIRITIMATI_TIME_ZONE }));
    expect(response.status).toBe(CREATED_STATUS);
    const body = await response.json<{ session_token: string; owner: { id: string; time_zone: string } }>();
    expect(body.owner).toEqual({ id: first.ownerId, time_zone: KIRITIMATI_TIME_ZONE });
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
      'identity before time zone',
      FAKE_PROVIDER,
      { body: { identity_token: 'a b', time_zone: 'Nope/Zone' } },
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
    expect(body.owner).toEqual({ id: rivalOwnerId, time_zone: KIRITIMATI_TIME_ZONE });
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

  test('an MCP key is not an owner session, and an owner session is not an MCP key', async () => {
    const { key } = await seedIssuedKey();
    await expectUnauthorized(await readOwner(key));
    const { token } = await signInOwner();
    const mcp = await exports.default.fetch('https://api.todz.test/mcp', { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
    await expectUnauthorized(mcp);
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
    expect(await response.json()).toEqual({ owner: { id: ownerId, time_zone: SAO_PAULO_TIME_ZONE } });
  });
});

describe('PATCH /owner', () => {
  test('stores the canonical zone and answers the owner', async () => {
    const { token, ownerId } = await signInOwner();
    const response = await updateOwner({ token, body: { time_zone: 'america/sao_paulo' } });
    expect(response.status).toBe(OK_STATUS);
    expect(await response.json()).toEqual({ owner: { id: ownerId, time_zone: SAO_PAULO_TIME_ZONE } });
    expect(await ownerTimeZone(ownerId)).toBe(SAO_PAULO_TIME_ZONE);
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
    ['a missing time zone', { body: {} }],
    ['a numeric time zone', { body: { time_zone: 5 } }],
  ])('%s answers 400 and the zone is unchanged', async (_name, payload) => {
    const { token, ownerId } = await signInOwner({ timeZone: SAO_PAULO_TIME_ZONE });
    const response = await ownerCall({ method: 'PATCH', path: '/owner', token, ...payload });
    expect(response.status).toBe(BAD_REQUEST_STATUS);
    expect(await response.json()).toEqual(INVALID_REQUEST);
    expect(await ownerTimeZone(ownerId)).toBe(SAO_PAULO_TIME_ZONE);
  });
});

describe('the owner time zone and the MCP today', () => {
  test('switching between Kiritimati and Pago Pago moves a task due on the Kiritimati date in and out of today', async () => {
    const { token, ownerId } = await signInOwner({ timeZone: KIRITIMATI_TIME_ZONE });
    const projectId = await seedProject({ ownerId });
    const { secret } = await issueProjectKey({ directory: env.DIRECTORY, projectId, now: CLOCK_NOW });
    const client = await connectClient({ era: ClientEra.Modern, key: secret });
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
