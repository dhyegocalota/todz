import { FairUseLimit, OWNER_LIVE_KEYS_MAX, OWNER_WRITES_PER_DAY_MAX } from '@todz/types';
import { env } from 'cloudflare:workers';
import { describe, expect, test } from 'vitest';
import { digestCredential } from '../src/credential-digest';
import { utcDayOf } from '../src/telemetry/telemetry-day';
import { ownerCall, signInOwner } from './owner-client';

const OWNER_KEY_PATTERN = /^todz-owner_[A-Za-z0-9_-]{43}$/;
const KEY_HINT_LENGTH = 4;
const OK_STATUS = 200;
const CREATED_STATUS = 201;
const NO_CONTENT_STATUS = 204;
const UNAUTHORIZED_STATUS = 401;
const NOT_FOUND_STATUS = 404;
const CONFLICT_STATUS = 409;
const NOT_FOUND = { error: 'not_found' };
const LIMIT_REACHED = { error: 'limit_reached' };
const KEYS_PATH = '/owner/keys';
const TOO_MANY_REQUESTS_STATUS = 429;

type KeyBody = { id: string; hint: string; created_at: number };
type IssuedBody = { key: KeyBody; secret: string };
type DigestRow = { digest: string };

function writesOf(ownerId: string): Promise<{ writes: number } | null> {
  return env.DIRECTORY.prepare('SELECT writes FROM owner_usage WHERE owner_id = ?').bind(ownerId).first<{ writes: number }>();
}

async function exhaustToday(ownerId: string): Promise<void> {
  await env.DIRECTORY.prepare(
    'INSERT INTO owner_usage (owner_id, day, writes, bytes) VALUES (?, ?, ?, 0) ON CONFLICT (owner_id, day) DO UPDATE SET writes = excluded.writes',
  )
    .bind(ownerId, utcDayOf(Date.now()), OWNER_WRITES_PER_DAY_MAX)
    .run();
}

async function issueOwnerKey(token: string): Promise<IssuedBody> {
  const response = await ownerCall({ method: 'POST', path: KEYS_PATH, token });
  if (response.status !== CREATED_STATUS) throw new Error(`issue owner key answered ${response.status}`);
  return response.json<IssuedBody>();
}

async function listOwnerKeys(token: string): Promise<KeyBody[]> {
  const response = await ownerCall({ method: 'GET', path: KEYS_PATH, token });
  expect(response.status).toBe(OK_STATUS);
  return (await response.json<{ keys: KeyBody[] }>()).keys;
}

function revokeOwnerKey({ token, keyId }: { token: string; keyId: string }): Promise<Response> {
  return ownerCall({ method: 'DELETE', path: `${KEYS_PATH}/${keyId}`, token });
}

describe('GET /owner/keys', () => {
  test('a new owner has no owner key: the scope is off until the owner creates one', async () => {
    const { token } = await signInOwner();
    expect(await listOwnerKeys(token)).toEqual([]);
  });

  test('lists the live keys oldest first as id, hint and creation time, and never a secret or a digest', async () => {
    const { token } = await signInOwner();
    const first = await issueOwnerKey(token);
    const second = await issueOwnerKey(token);
    const third = await issueOwnerKey(token);
    await revokeOwnerKey({ token, keyId: second.key.id });
    const response = await ownerCall({ method: 'GET', path: KEYS_PATH, token });
    const body = await response.text();
    expect(JSON.parse(body)).toEqual({ keys: [first.key, third.key] });
    expect(body).not.toContain(first.secret);
    expect(body).not.toContain(await digestCredential(first.secret));
  });

  test('lists only the keys of its own owner', async () => {
    const { token } = await signInOwner();
    const other = await signInOwner();
    const mine = await issueOwnerKey(token);
    await issueOwnerKey(other.token);
    expect(await listOwnerKeys(token)).toEqual([mine.key]);
  });
});

describe('POST /owner/keys', () => {
  test('answers 201 with the key row and the secret once, under the todz-owner_ prefix', async () => {
    const { token } = await signInOwner();
    const response = await ownerCall({ method: 'POST', path: KEYS_PATH, token });
    expect(response.status).toBe(CREATED_STATUS);
    const issued = await response.json<IssuedBody>();
    expect(Object.keys(issued).sort()).toEqual(['key', 'secret']);
    expect(issued.secret).toMatch(OWNER_KEY_PATTERN);
    expect(issued.key).toEqual({ id: issued.key.id, hint: issued.secret.slice(-KEY_HINT_LENGTH), created_at: issued.key.created_at });
  });

  test('stores only the digest of the secret', async () => {
    const { token, ownerId } = await signInOwner();
    const { secret } = await issueOwnerKey(token);
    const { results } = await env.DIRECTORY.prepare('SELECT digest FROM owner_keys WHERE owner_id = ?').bind(ownerId).all<DigestRow>();
    expect(results).toEqual([{ digest: await digestCredential(secret) }]);
  });

  test(`the ${OWNER_LIVE_KEYS_MAX + 1}th live key answers 409 limit_reached, and revoking one makes room`, async () => {
    const { token } = await signInOwner();
    const issued = await Promise.all(Array.from({ length: OWNER_LIVE_KEYS_MAX }, () => issueOwnerKey(token)));
    const refused = await ownerCall({ method: 'POST', path: KEYS_PATH, token });
    expect(refused.status).toBe(CONFLICT_STATUS);
    expect(await refused.json()).toEqual(LIMIT_REACHED);
    const [first] = issued;
    if (first === undefined) throw new Error('keys were issued');
    await revokeOwnerKey({ token, keyId: first.key.id });
    expect((await ownerCall({ method: 'POST', path: KEYS_PATH, token })).status).toBe(CREATED_STATUS);
  });
});

describe('DELETE /owner/keys/:keyId', () => {
  test('answers 204, drops the key from the list and stores no row', async () => {
    const { token } = await signInOwner();
    const { key } = await issueOwnerKey(token);
    const response = await revokeOwnerKey({ token, keyId: key.id });
    expect(response.status).toBe(NO_CONTENT_STATUS);
    expect(await response.text()).toBe('');
    expect(await listOwnerKeys(token)).toEqual([]);
    const row = await env.DIRECTORY.prepare('SELECT count(*) AS total FROM owner_keys WHERE id = ?')
      .bind(key.id)
      .first<{ total: number }>();
    expect(row).toEqual({ total: 0 });
  });

  test('revoking twice, an unknown id and the key of another owner answer 404 and revoke nothing', async () => {
    const { token } = await signInOwner();
    const other = await signInOwner();
    const { key } = await issueOwnerKey(token);
    const foreign = await issueOwnerKey(other.token);
    await revokeOwnerKey({ token, keyId: key.id });
    const answers = await Promise.all([
      revokeOwnerKey({ token, keyId: key.id }),
      revokeOwnerKey({ token, keyId: crypto.randomUUID() }),
      revokeOwnerKey({ token, keyId: foreign.key.id }),
    ]);
    expect(answers.map((answer) => answer.status)).toEqual([NOT_FOUND_STATUS, NOT_FOUND_STATUS, NOT_FOUND_STATUS]);
    expect(await answers[0]?.json()).toEqual(NOT_FOUND);
    expect(await listOwnerKeys(other.token)).toEqual([foreign.key]);
  });
});

describe('the owner key routes without a session', () => {
  test.each([
    ['GET', KEYS_PATH],
    ['POST', KEYS_PATH],
    ['DELETE', `${KEYS_PATH}/any`],
  ])('%s %s answers 401 with an empty body', async (method, path) => {
    const response = await ownerCall({ method, path });
    expect(response.status).toBe(UNAUTHORIZED_STATUS);
    expect(await response.text()).toBe('');
  });

  test('an owner key is not a session: it opens none of the owner routes', async () => {
    const { token } = await signInOwner();
    const { secret } = await issueOwnerKey(token);
    const answers = await Promise.all([
      ownerCall({ method: 'GET', path: KEYS_PATH, token: secret }),
      ownerCall({ method: 'GET', path: '/owner/workspaces', token: secret }),
      ownerCall({ method: 'POST', path: KEYS_PATH, token: secret }),
    ]);
    expect(answers.map((answer) => answer.status)).toEqual([UNAUTHORIZED_STATUS, UNAUTHORIZED_STATUS, UNAUTHORIZED_STATUS]);
  });
});

describe('owner keys and the daily write cap', () => {
  test('issuing a key at the cap is refused and stores nothing', async () => {
    const { token, ownerId } = await signInOwner();
    await exhaustToday(ownerId);
    const refused = await ownerCall({ method: 'POST', path: KEYS_PATH, token });
    expect(refused.status).toBe(TOO_MANY_REQUESTS_STATUS);
    expect((await refused.json<{ limit: string }>()).limit).toBe(FairUseLimit.DailyWrites);
    expect(await listOwnerKeys(token)).toEqual([]);
  });

  test('revoking a key is never gated by the cap and spends no write', async () => {
    const { token, ownerId } = await signInOwner();
    const { key } = await issueOwnerKey(token);
    await exhaustToday(ownerId);
    const revoked = await revokeOwnerKey({ token, keyId: key.id });
    expect(revoked.status).toBe(NO_CONTENT_STATUS);
    expect(await listOwnerKeys(token)).toEqual([]);
    expect(await writesOf(ownerId)).toEqual({ writes: OWNER_WRITES_PER_DAY_MAX });
  });

  test('an issue spends one write and a refused issue at the key limit spends none', async () => {
    const { token, ownerId } = await signInOwner();
    await Promise.all(Array.from({ length: OWNER_LIVE_KEYS_MAX }, () => issueOwnerKey(token)));
    expect(await writesOf(ownerId)).toEqual({ writes: OWNER_LIVE_KEYS_MAX });
    const refused = await ownerCall({ method: 'POST', path: KEYS_PATH, token });
    expect(refused.status).toBe(CONFLICT_STATUS);
    expect(await writesOf(ownerId)).toEqual({ writes: OWNER_LIVE_KEYS_MAX });
  });
});
