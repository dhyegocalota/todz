import { MILLISECONDS_PER_DAY } from '@todz/types';
import { env } from 'cloudflare:workers';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { digestCredential } from '../../src/credential-digest';
import { generateCredentialSecret } from '../../src/credential-secret';
import { seedSession, seedSiblingProject } from '../directory-seed';
import { ownerCall } from '../owner-client';
import { CLOCK_NOW } from '../task-fixtures';
import {
  CLIENT_NAME,
  type SeededOwner,
  approvedCode,
  authorizeParams,
  connectedClient,
  exchangeCode,
  firstChoice,
  formRequest,
  pkcePair,
  refreshRequest,
  registerClient,
  seededOwner,
  serveOAuthRequest,
  signedInBrowser,
  tokensOf,
} from './oauth-client';

const DELETION_EVENT = 'oauth_grant_deleted';
const DELETION_METRIC = 'oauth_grants_deleted';
const GRANTS_PER_OWNER_MAX = 20;
const SPENT_REFRESH_TOKENS_MAX = 10_000;
const DIGEST_LENGTH = 64;

type DeletionLine = { event: string; reason: string; client_name: string };

afterEach(() => {
  vi.restoreAllMocks();
});

function loggedLines(): () => string[] {
  const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
  return () => log.mock.calls.map(([line]) => String(line));
}

function deletionLinesOf(lines: string[]): DeletionLine[] {
  return lines
    .filter((line) => line.includes(DELETION_EVENT))
    .map((line) => JSON.parse(line) as DeletionLine)
    .filter((line) => line.event === DELETION_EVENT);
}

async function deletionCount(reason: string): Promise<number> {
  const row = await env.DIRECTORY.prepare('SELECT coalesce(sum(count), 0) AS total FROM metrics_daily WHERE metric = ? AND dimension = ?')
    .bind(DELETION_METRIC, reason)
    .first<{ total: number }>();
  return row!.total;
}

async function sessionOf(owner: SeededOwner): Promise<string> {
  const secret = generateCredentialSecret();
  await seedSession({ ownerId: owner.ownerId, secret, expiresAt: Date.now() + MILLISECONDS_PER_DAY });
  return secret;
}

async function expectOneDeletion({
  reason,
  lines,
  countBefore,
  secrets,
}: {
  reason: string;
  lines: string[];
  countBefore: number;
  secrets: string[];
}): Promise<void> {
  expect(deletionLinesOf(lines)).toEqual([{ event: DELETION_EVENT, reason, client_name: CLIENT_NAME }]);
  expect(await deletionCount(reason)).toBe(countBefore + 1);
  const digests = await Promise.all(secrets.map(digestCredential));
  const deletionText = lines.filter((line) => line.includes(DELETION_EVENT)).join('\n');
  [...secrets, ...digests].forEach((secret) => expect(deletionText).not.toContain(secret));
}

describe('every grant deletion logs its reason and the client name, and counts the reason', () => {
  test('a replayed code', async () => {
    const owner = await seededOwner();
    const clientId = await registerClient();
    const { verifier, challenge } = await pkcePair();
    const params = authorizeParams({ clientId, challenge });
    const browser = await signedInBrowser({ params, email: owner.email });
    const code = await approvedCode({ browser, params, choice: owner.projectId });
    await tokensOf(await exchangeCode({ clientId, code, verifier }));
    const countBefore = await deletionCount('replayed_code');
    const lines = loggedLines();

    await exchangeCode({ clientId, code, verifier });

    await expectOneDeletion({ reason: 'replayed_code', lines: lines(), countBefore, secrets: [code, owner.email, owner.ownerId] });
  });

  test('a spent refresh token presented after its successor was used', async () => {
    const owner = await seededOwner();
    const { clientId, tokens } = await connectedClient({ choiceOf: firstChoice, email: owner.email });
    const refreshed = await tokensOf(
      await serveOAuthRequest({ request: refreshRequest({ clientId, refreshToken: tokens.refresh_token }) }),
    );
    await tokensOf(await serveOAuthRequest({ request: refreshRequest({ clientId, refreshToken: refreshed.refresh_token }) }));
    const countBefore = await deletionCount('reuse_after_rotation');
    const lines = loggedLines();

    await serveOAuthRequest({ request: refreshRequest({ clientId, refreshToken: tokens.refresh_token }) });

    await expectOneDeletion({
      reason: 'reuse_after_rotation',
      lines: lines(),
      countBefore,
      secrets: [tokens.refresh_token, tokens.access_token, owner.email, owner.ownerId],
    });
  });

  test('the refresh token cap', async () => {
    const owner = await seededOwner();
    const { clientId, tokens } = await connectedClient({ choiceOf: firstChoice, email: owner.email });
    await env.DIRECTORY.prepare(
      "WITH RECURSIVE seeds(position) AS (SELECT 1 UNION ALL SELECT position + 1 FROM seeds WHERE position < ?) INSERT INTO oauth_tokens (digest, grant_id, kind, created_at, expires_at, spent_at) SELECT printf('%0' || ? || 'd', position), grant_id, 'refresh', ?, ?, ? FROM seeds, (SELECT grant_id FROM oauth_tokens WHERE digest = ?)",
    )
      .bind(
        SPENT_REFRESH_TOKENS_MAX,
        DIGEST_LENGTH,
        CLOCK_NOW - 1,
        CLOCK_NOW + MILLISECONDS_PER_DAY,
        CLOCK_NOW - 1,
        await digestCredential(tokens.refresh_token),
      )
      .run();
    const countBefore = await deletionCount('cap');
    const lines = loggedLines();

    await serveOAuthRequest({ request: refreshRequest({ clientId, refreshToken: tokens.refresh_token }) });

    await expectOneDeletion({ reason: 'cap', lines: lines(), countBefore, secrets: [tokens.refresh_token, owner.email, owner.ownerId] });
  });

  test('a revocation by the client', async () => {
    const owner = await seededOwner();
    const { clientId, tokens } = await connectedClient({ choiceOf: firstChoice, email: owner.email });
    const countBefore = await deletionCount('client_revoke');
    const lines = loggedLines();

    await serveOAuthRequest({
      request: formRequest({ path: '/oauth/revoke', fields: { token: tokens.refresh_token, client_id: clientId } }),
    });

    await expectOneDeletion({
      reason: 'client_revoke',
      lines: lines(),
      countBefore,
      secrets: [tokens.refresh_token, owner.email, owner.ownerId],
    });
  });

  test('a disconnect in Settings', async () => {
    const owner = await seededOwner();
    await connectedClient({ choiceOf: firstChoice, email: owner.email });
    const session = await sessionOf(owner);
    const listed = await ownerCall({ method: 'GET', path: '/owner/connected-apps', token: session });
    const [app] = ((await listed.json()) as { connected_apps: { id: string }[] }).connected_apps;
    const countBefore = await deletionCount('settings_disconnect');
    const lines = loggedLines();

    await ownerCall({ method: 'DELETE', path: `/owner/connected-apps/${app!.id}`, token: session });

    await expectOneDeletion({ reason: 'settings_disconnect', lines: lines(), countBefore, secrets: [session, owner.email, owner.ownerId] });
  });

  test('the eviction of the least recently used grant past the per-owner maximum', async () => {
    const owner = await seededOwner();
    const { clientId } = await connectedClient({ choiceOf: firstChoice, email: owner.email });
    await env.DIRECTORY.prepare(
      "WITH RECURSIVE seeds(position) AS (SELECT 1 UNION ALL SELECT position + 1 FROM seeds WHERE position < ?) INSERT INTO oauth_grants (id, client_id, owner_id, project_id, redirect_uri, created_at, last_used_at) SELECT 'seeded-' || position, ?, ?, NULL, 'http://127.0.0.1:33418/callback', ?, ? FROM seeds",
    )
      .bind(GRANTS_PER_OWNER_MAX - 1, clientId, owner.ownerId, CLOCK_NOW - 1, CLOCK_NOW - 1)
      .run();
    const countBefore = await deletionCount('eviction');
    const lines = loggedLines();

    await connectedClient({ choiceOf: firstChoice, email: owner.email });

    await expectOneDeletion({ reason: 'eviction', lines: lines(), countBefore, secrets: [owner.email, owner.ownerId] });
  });

  test('the deletion of the project the grant belongs to', async () => {
    const owner = await seededOwner();
    const siblingId = await seedSiblingProject({ projectId: owner.projectId, name: 'Website' });
    await connectedClient({ choiceOf: () => siblingId, email: owner.email });
    const session = await sessionOf(owner);
    const countBefore = await deletionCount('cascade');
    const lines = loggedLines();

    await ownerCall({ method: 'DELETE', path: `/owner/projects/${siblingId}`, token: session });

    await expectOneDeletion({ reason: 'cascade', lines: lines(), countBefore, secrets: [session, owner.email, owner.ownerId] });
  });

  test('the deletion of the workspace the grant belongs to', async () => {
    const owner = await seededOwner();
    await connectedClient({ choiceOf: firstChoice, email: owner.email });
    const session = await sessionOf(owner);
    const workspace = await env.DIRECTORY.prepare('SELECT workspace_id FROM projects WHERE id = ?')
      .bind(owner.projectId)
      .first<{ workspace_id: string }>();
    const countBefore = await deletionCount('cascade');
    const lines = loggedLines();

    await ownerCall({ method: 'DELETE', path: `/owner/workspaces/${workspace!.workspace_id}`, token: session });

    await expectOneDeletion({ reason: 'cascade', lines: lines(), countBefore, secrets: [session, owner.email, owner.ownerId] });
  });
});
