import { env, exports } from 'cloudflare:workers';
import { describe, expect, test } from 'vitest';
import { digestCredential } from '../src/credential-digest';
import { McpToolName } from '../src/mcp-copy';
import { openMcpSession } from '../src/mcp-sessions';
import { countingEnv } from './counting-namespace';
import { ClientEra, callTool, connectClient } from './mcp-client';
import { ownerCall, serveOwnerCall, signInOwner } from './owner-client';
import { CLOCK_NOW } from './task-fixtures';

const KEY_PATTERN = /^todz_[A-Za-z0-9_-]{43}$/;
const KEY_HINT_LENGTH = 4;
const OK_STATUS = 200;
const CREATED_STATUS = 201;
const NO_CONTENT_STATUS = 204;
const UNAUTHORIZED_STATUS = 401;
const NOT_FOUND_STATUS = 404;
const NOT_FOUND = { error: 'not_found' };
const CLIENT_NAME = 'Claude Code';
const MCP_URL = 'http://localhost:8787/mcp';

type KeyBody = { id: string; hint: string; created_at: number };
type IssuedBody = { key: KeyBody; secret: string };
type CountRow = { total: number };

async function ownedProject(): Promise<{ token: string; ownerId: string; projectId: string }> {
  const { token, ownerId } = await signInOwner();
  const response = await ownerCall({ method: 'POST', path: '/owner/workspaces', token, body: { name: 'Work' } });
  const { workspace } = await response.json<{ workspace: { projects: { id: string }[] } }>();
  const [inbox] = workspace.projects;
  if (inbox === undefined) throw new Error('a workspace has an Inbox');
  return { token, ownerId, projectId: inbox.id };
}

async function issueKey({ token, projectId }: { token: string; projectId: string }): Promise<IssuedBody> {
  const response = await ownerCall({ method: 'POST', path: `/owner/projects/${projectId}/keys`, token });
  if (response.status !== CREATED_STATUS) throw new Error(`issue key answered ${response.status}`);
  return response.json<IssuedBody>();
}

async function listKeys({ token, projectId }: { token: string; projectId: string }): Promise<KeyBody[]> {
  const response = await ownerCall({ method: 'GET', path: `/owner/projects/${projectId}/keys`, token });
  expect(response.status).toBe(OK_STATUS);
  return (await response.json<{ keys: KeyBody[] }>()).keys;
}

function revokeKey({ token, projectId, keyId }: { token: string; projectId: string; keyId: string }): Promise<Response> {
  return ownerCall({ method: 'DELETE', path: `/owner/projects/${projectId}/keys/${keyId}`, token });
}

function mcpCall(secret: string): Promise<Response> {
  return exports.default.fetch(MCP_URL, { method: 'POST', headers: { Authorization: `Bearer ${secret}` } });
}

async function mcpSessionCount(secret: string): Promise<number> {
  const row = await env.DIRECTORY.prepare('SELECT count(*) AS total FROM mcp_sessions WHERE key_digest = ?')
    .bind(await digestCredential(secret))
    .first<CountRow>();
  if (row === null) throw new Error('count always answers a row');
  return row.total;
}

async function openSession(secret: string): Promise<string> {
  return openMcpSession({ directory: env.DIRECTORY, keyDigest: await digestCredential(secret), clientName: CLIENT_NAME, now: CLOCK_NOW });
}

async function storedKeyRows(keyId: string): Promise<number> {
  const row = await env.DIRECTORY.prepare('SELECT count(*) AS total FROM project_keys WHERE id = ?').bind(keyId).first<CountRow>();
  if (row === null) throw new Error('count always answers a row');
  return row.total;
}

describe('POST /owner/projects/:projectId/keys', () => {
  test('answers 201 with the key row and the secret once, and the secret opens the project over MCP', async () => {
    const { token, projectId } = await ownedProject();
    const response = await ownerCall({ method: 'POST', path: `/owner/projects/${projectId}/keys`, token });
    expect(response.status).toBe(CREATED_STATUS);
    const issued = await response.json<IssuedBody>();
    expect(Object.keys(issued).sort()).toEqual(['key', 'secret']);
    expect(issued.secret).toMatch(KEY_PATTERN);
    expect(issued.key).toEqual({ id: issued.key.id, hint: issued.secret.slice(-KEY_HINT_LENGTH), created_at: issued.key.created_at });
    const client = await connectClient({ era: ClientEra.Modern, key: issued.secret });
    expect((await callTool({ client, name: McpToolName.List, args: {} })).text).toBe('Open tasks: 0 of 0');
  });

  test('two issues are two different keys and secrets', async () => {
    const { token, projectId } = await ownedProject();
    const first = await issueKey({ token, projectId });
    const second = await issueKey({ token, projectId });
    expect(first.key.id).not.toBe(second.key.id);
    expect(first.secret).not.toBe(second.secret);
  });

  test('an unknown project answers 404 not_found and issues nothing', async () => {
    const { token } = await signInOwner();
    const response = await ownerCall({ method: 'POST', path: `/owner/projects/${crypto.randomUUID()}/keys`, token });
    expect(response.status).toBe(NOT_FOUND_STATUS);
    expect(await response.json()).toEqual(NOT_FOUND);
  });
});

describe('GET /owner/projects/:projectId/keys', () => {
  test('a project with no key lists none', async () => {
    const { token, projectId } = await ownedProject();
    expect(await listKeys({ token, projectId })).toEqual([]);
  });

  test('lists the unrevoked keys oldest first as id, hint and creation time and never a secret', async () => {
    const { token, projectId } = await ownedProject();
    const first = await issueKey({ token, projectId });
    const second = await issueKey({ token, projectId });
    const third = await issueKey({ token, projectId });
    await revokeKey({ token, projectId, keyId: second.key.id });
    const response = await ownerCall({ method: 'GET', path: `/owner/projects/${projectId}/keys`, token });
    const body = await response.text();
    expect(JSON.parse(body)).toEqual({ keys: [first.key, third.key] });
    expect(body).not.toContain(first.secret);
    expect(body).not.toContain(third.secret);
    expect(body).not.toContain(await digestCredential(first.secret));
  });

  test('lists only the keys of its own project', async () => {
    const { token, projectId } = await ownedProject();
    const other = await ownedProject();
    const mine = await issueKey({ token, projectId });
    await issueKey({ token: other.token, projectId: other.projectId });
    expect(await listKeys({ token, projectId })).toEqual([mine.key]);
  });

  test('an unknown project answers 404 not_found', async () => {
    const { token } = await signInOwner();
    const response = await ownerCall({ method: 'GET', path: `/owner/projects/${crypto.randomUUID()}/keys`, token });
    expect(response.status).toBe(NOT_FOUND_STATUS);
    expect(await response.json()).toEqual(NOT_FOUND);
  });
});

describe('DELETE /owner/projects/:projectId/keys/:keyId', () => {
  test('answers 204, drops the key from the list, refuses it on MCP and deletes it with its MCP sessions', async () => {
    const { token, projectId } = await ownedProject();
    const { key, secret } = await issueKey({ token, projectId });
    await openSession(secret);
    await openSession(secret);
    expect(await mcpSessionCount(secret)).toBe(2);
    expect((await mcpCall(secret)).status).not.toBe(UNAUTHORIZED_STATUS);
    const response = await revokeKey({ token, projectId, keyId: key.id });
    expect(response.status).toBe(NO_CONTENT_STATUS);
    expect(await response.text()).toBe('');
    expect(await listKeys({ token, projectId })).toEqual([]);
    const refused = await mcpCall(secret);
    expect(refused.status).toBe(UNAUTHORIZED_STATUS);
    expect(await refused.text()).toBe('');
    expect(await mcpSessionCount(secret)).toBe(0);
    expect(await storedKeyRows(key.id)).toBe(0);
  });

  test('leaves the other keys of the project and their MCP sessions working', async () => {
    const { token, projectId } = await ownedProject();
    const revoked = await issueKey({ token, projectId });
    const kept = await issueKey({ token, projectId });
    await openSession(kept.secret);
    await revokeKey({ token, projectId, keyId: revoked.key.id });
    expect(await mcpSessionCount(kept.secret)).toBe(1);
    expect((await mcpCall(kept.secret)).status).not.toBe(UNAUTHORIZED_STATUS);
    expect(await listKeys({ token, projectId })).toEqual([kept.key]);
  });

  test('revoking a key twice answers 204 then 404 not_found and keeps no row', async () => {
    const { token, projectId } = await ownedProject();
    const { key } = await issueKey({ token, projectId });
    const first = await serveOwnerCall({
      call: { method: 'DELETE', path: `/owner/projects/${projectId}/keys/${key.id}`, token },
      now: CLOCK_NOW,
    });
    expect(first.status).toBe(NO_CONTENT_STATUS);
    const second = await serveOwnerCall({
      call: { method: 'DELETE', path: `/owner/projects/${projectId}/keys/${key.id}`, token },
      now: CLOCK_NOW + 1,
    });
    expect(second.status).toBe(NOT_FOUND_STATUS);
    expect(await second.json()).toEqual(NOT_FOUND);
    expect(await storedKeyRows(key.id)).toBe(0);
  });

  test('an unknown key id and a key of another project of the same owner answer 404 and revoke nothing', async () => {
    const { token, projectId } = await ownedProject();
    const workspaceResponse = await ownerCall({ method: 'POST', path: '/owner/workspaces', token, body: { name: 'Second' } });
    const { workspace } = await workspaceResponse.json<{ workspace: { id: string } }>();
    const projectResponse = await ownerCall({
      method: 'POST',
      path: `/owner/workspaces/${workspace.id}/projects`,
      token,
      body: { name: 'Other' },
    });
    const { project } = await projectResponse.json<{ project: { id: string } }>();
    const otherKey = await issueKey({ token, projectId: project.id });
    const unknown = await revokeKey({ token, projectId, keyId: crypto.randomUUID() });
    const crossProject = await revokeKey({ token, projectId, keyId: otherKey.key.id });
    expect([unknown.status, crossProject.status]).toEqual([NOT_FOUND_STATUS, NOT_FOUND_STATUS]);
    expect(await unknown.json()).toEqual(NOT_FOUND);
    expect(await crossProject.json()).toEqual(NOT_FOUND);
    expect(await storedKeyRows(otherKey.key.id)).toBe(1);
  });

  test('an unknown project answers 404 not_found', async () => {
    const { token } = await signInOwner();
    const response = await revokeKey({ token, projectId: crypto.randomUUID(), keyId: crypto.randomUUID() });
    expect(response.status).toBe(NOT_FOUND_STATUS);
    expect(await response.json()).toEqual(NOT_FOUND);
  });
});

describe('another owner reaching for the keys of a project', () => {
  test('answers what a project and a key that never existed answer, opens no Durable Object and changes nothing', async () => {
    const alice = await ownedProject();
    const bob = await signInOwner();
    const { key, secret } = await issueKey({ token: alice.token, projectId: alice.projectId });
    await openSession(secret);
    const { countedEnv, addressingCalls } = countingEnv();
    const callsOn = ({ projectId, keyId }: { projectId: string; keyId: string }) => [
      { method: 'GET', path: `/owner/projects/${projectId}/keys`, token: bob.token },
      { method: 'POST', path: `/owner/projects/${projectId}/keys`, token: bob.token },
      { method: 'DELETE', path: `/owner/projects/${projectId}/keys/${keyId}`, token: bob.token },
    ];
    const answersOf = (calls: ReturnType<typeof callsOn>) =>
      Promise.all(
        calls.map(async (call) => {
          const response = await serveOwnerCall({ call, now: Date.now(), workerEnv: countedEnv });
          return { status: response.status, body: await response.text() };
        }),
      );
    const foreign = await answersOf(callsOn({ projectId: alice.projectId, keyId: key.id }));
    const absent = await answersOf(callsOn({ projectId: crypto.randomUUID(), keyId: crypto.randomUUID() }));
    expect(foreign).toEqual(absent);
    expect(foreign.map((answer) => answer.status)).toEqual([NOT_FOUND_STATUS, NOT_FOUND_STATUS, NOT_FOUND_STATUS]);
    expect(foreign.map((answer) => answer.body)).toEqual([JSON.stringify(NOT_FOUND), JSON.stringify(NOT_FOUND), JSON.stringify(NOT_FOUND)]);
    expect(addressingCalls).toEqual([]);
    expect(await listKeys({ token: alice.token, projectId: alice.projectId })).toEqual([key]);
    expect(await mcpSessionCount(secret)).toBe(1);
    expect((await mcpCall(secret)).status).not.toBe(UNAUTHORIZED_STATUS);
  });
});

describe('key routes without a session', () => {
  test.each([
    ['GET', '/owner/projects/any/keys'],
    ['POST', '/owner/projects/any/keys'],
    ['DELETE', '/owner/projects/any/keys/any'],
  ])('%s %s answers 401 with an empty body', async (method, path) => {
    const response = await ownerCall({ method, path });
    expect(response.status).toBe(UNAUTHORIZED_STATUS);
    expect(await response.text()).toBe('');
  });
});
