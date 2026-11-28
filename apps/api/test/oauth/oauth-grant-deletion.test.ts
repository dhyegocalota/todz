import { MILLISECONDS_PER_DAY, MILLISECONDS_PER_MINUTE } from '@todz/types';
import { env } from 'cloudflare:workers';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { digestCredential } from '../../src/credential-digest';
import { generateCredentialSecret } from '../../src/credential-secret';
import type { Env } from '../../src/env';
import { seedProject, seedSession, seedSiblingProject } from '../directory-seed';
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
  oauthEnv,
  pkcePair,
  projectChoiceOf,
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
const LINK_WINDOW_MS = 16 * MILLISECONDS_PER_MINUTE;
const TELEMETRY_SETTING = 'on';

type DeletionLine = { event: string; reason: string; client_name: string };

function telemetryOn(): Env {
  return oauthEnv({ TELEMETRY: TELEMETRY_SETTING });
}

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
    const code = await approvedCode({ browser, params, choice: projectChoiceOf(owner.projectId) });
    await tokensOf(await exchangeCode({ clientId, code, verifier }));
    const countBefore = await deletionCount('replayed_code');
    const lines = loggedLines();

    await exchangeCode({ clientId, code, verifier, workerEnv: telemetryOn() });

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

    await serveOAuthRequest({ request: refreshRequest({ clientId, refreshToken: tokens.refresh_token }), workerEnv: telemetryOn() });

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

    await serveOAuthRequest({ request: refreshRequest({ clientId, refreshToken: tokens.refresh_token }), workerEnv: telemetryOn() });

    await expectOneDeletion({ reason: 'cap', lines: lines(), countBefore, secrets: [tokens.refresh_token, owner.email, owner.ownerId] });
  });

  test('a revocation by the client', async () => {
    const owner = await seededOwner();
    const { clientId, tokens } = await connectedClient({ choiceOf: firstChoice, email: owner.email });
    const countBefore = await deletionCount('client_revoke');
    const lines = loggedLines();

    await serveOAuthRequest({
      request: formRequest({ path: '/oauth/revoke', fields: { token: tokens.refresh_token, client_id: clientId } }),
      workerEnv: telemetryOn(),
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
    const nextClientId = await registerClient();
    const { verifier, challenge } = await pkcePair();
    const params = authorizeParams({ clientId: nextClientId, challenge });
    const later = CLOCK_NOW + LINK_WINDOW_MS;
    const browser = await signedInBrowser({ params, email: owner.email, now: later });
    const code = await approvedCode({ browser, params, choice: projectChoiceOf(owner.projectId), now: later });
    const countBefore = await deletionCount('eviction');
    const lines = loggedLines();

    await tokensOf(await exchangeCode({ clientId: nextClientId, code, verifier, workerEnv: telemetryOn(), now: later }));

    await expectOneDeletion({ reason: 'eviction', lines: lines(), countBefore, secrets: [owner.email, owner.ownerId] });
  });

  test('the deletion of the project the grant belongs to', async () => {
    const owner = await seededOwner();
    const siblingId = await seedSiblingProject({ projectId: owner.projectId, name: 'Website' });
    await connectedClient({ choiceOf: () => projectChoiceOf(siblingId), email: owner.email });
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

describe('a project or workspace deletion logs a cascade only for the grants that lose their last scope', () => {
  async function grantCountOf(owner: SeededOwner): Promise<number> {
    const row = await env.DIRECTORY.prepare('SELECT count(*) AS total FROM oauth_grants WHERE owner_id = ?')
      .bind(owner.ownerId)
      .first<{ total: number }>();
    return row!.total;
  }

  async function workspaceOf(projectId: string): Promise<string> {
    const row = await env.DIRECTORY.prepare('SELECT workspace_id FROM projects WHERE id = ?')
      .bind(projectId)
      .first<{ workspace_id: string }>();
    return row!.workspace_id;
  }

  test('a grant that keeps another scope is not deleted and logs nothing when one of its projects goes', async () => {
    const owner = await seededOwner();
    const siblingId = await seedSiblingProject({ projectId: owner.projectId, name: 'Website' });
    const otherProjectId = await seedProject({ ownerId: owner.ownerId });
    await connectedClient({ choiceOf: () => [projectChoiceOf(siblingId), projectChoiceOf(otherProjectId)], email: owner.email });
    const session = await sessionOf(owner);
    const lines = loggedLines();

    await ownerCall({ method: 'DELETE', path: `/owner/projects/${siblingId}`, token: session });

    expect(deletionLinesOf(lines())).toEqual([]);
    expect(await grantCountOf(owner)).toBe(1);
  });

  test('a workspace deletion logs the grant it empties and keeps the one that holds a project elsewhere', async () => {
    const owner = await seededOwner();
    const siblingId = await seedSiblingProject({ projectId: owner.projectId, name: 'Website' });
    const otherProjectId = await seedProject({ ownerId: owner.ownerId });
    await connectedClient({ choiceOf: () => projectChoiceOf(owner.projectId), email: owner.email });
    await connectedClient({ choiceOf: () => [projectChoiceOf(siblingId), projectChoiceOf(otherProjectId)], email: owner.email });
    const session = await sessionOf(owner);
    const countBefore = await deletionCount('cascade');
    const lines = loggedLines();

    await ownerCall({ method: 'DELETE', path: `/owner/workspaces/${await workspaceOf(owner.projectId)}`, token: session });

    await expectOneDeletion({ reason: 'cascade', lines: lines(), countBefore, secrets: [session, owner.email, owner.ownerId] });
    expect(await grantCountOf(owner)).toBe(1);
  });
});
