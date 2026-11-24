import { env, exports } from 'cloudflare:workers';
import { describe, expect, test } from 'vitest';
import { HttpStatus } from '../src/http-status';
import { countingEnv } from './counting-namespace';
import { type OwnerCall, ownerCall, serveOwnerCall, signInOwner } from './owner-client';

const MCP_URL = 'https://api.todz.test/mcp';
const NOT_FOUND_BODY = JSON.stringify({ error: 'not_found' });
const FAR_AHEAD_CURSOR = 999;
const ATTACKED_TITLE = 'Attacked';
const ORIGINAL_TITLE = 'Original';
const OWNER_NAME = 'Work';
const INBOX_NAME = 'Inbox';
const SECOND_PROJECT_NAME = 'Second';

type Target = { workspaceId: string; projectId: string; inboxId: string; keyId: string };
type Attack = { name: string; call: ({ target, token }: { target: Target; token: string }) => OwnerCall };
type Answer = { status: number; body: string; contentType: string | null };
type SeededOwner = { token: string; target: Target; keySecret: string };

const ATTACKS: Attack[] = [
  {
    name: 'RenameWorkspace',
    call: ({ target, token }) => ({
      method: 'PATCH',
      path: `/owner/workspaces/${target.workspaceId}`,
      token,
      body: { name: ATTACKED_TITLE },
    }),
  },
  {
    name: 'CreateProject',
    call: ({ target, token }) => ({
      method: 'POST',
      path: `/owner/workspaces/${target.workspaceId}/projects`,
      token,
      body: { name: ATTACKED_TITLE },
    }),
  },
  {
    name: 'RenameProject',
    call: ({ target, token }) => ({ method: 'PATCH', path: `/owner/projects/${target.projectId}`, token, body: { name: ATTACKED_TITLE } }),
  },
  {
    name: 'RenameProject on the Inbox',
    call: ({ target, token }) => ({ method: 'PATCH', path: `/owner/projects/${target.inboxId}`, token, body: { name: ATTACKED_TITLE } }),
  },
  {
    name: 'AddTasks',
    call: ({ target, token }) => ({
      method: 'POST',
      path: `/owner/projects/${target.projectId}/tasks`,
      token,
      body: { tasks: [{ title: ATTACKED_TITLE }] },
    }),
  },
  {
    name: 'UpdateTask',
    call: ({ target, token }) => ({
      method: 'PATCH',
      path: `/owner/projects/${target.projectId}/tasks/1`,
      token,
      body: { title: ATTACKED_TITLE },
    }),
  },
  {
    name: 'CompleteTasks',
    call: ({ target, token }) => ({
      method: 'POST',
      path: `/owner/projects/${target.projectId}/tasks/complete`,
      token,
      body: { numbers: [1] },
    }),
  },
  {
    name: 'ReopenTasks',
    call: ({ target, token }) => ({
      method: 'POST',
      path: `/owner/projects/${target.projectId}/tasks/reopen`,
      token,
      body: { numbers: [1] },
    }),
  },
  {
    name: 'ReadHistory',
    call: ({ target, token }) => ({ method: 'GET', path: `/owner/projects/${target.projectId}/tasks/1/history`, token }),
  },
  {
    name: 'ReadChanges',
    call: ({ target, token }) => ({ method: 'GET', path: `/owner/projects/${target.projectId}/changes?cursor=0`, token }),
  },
  {
    name: 'ReadChanges with a cursor far ahead',
    call: ({ target, token }) => ({
      method: 'GET',
      path: `/owner/projects/${target.projectId}/changes?cursor=${FAR_AHEAD_CURSOR}`,
      token,
    }),
  },
  {
    name: 'WatchChanges',
    call: ({ target, token }) => ({
      method: 'GET',
      path: `/owner/projects/${target.projectId}/socket`,
      token,
      headers: { Upgrade: 'websocket' },
    }),
  },
  {
    name: 'WatchChanges without the upgrade header',
    call: ({ target, token }) => ({ method: 'GET', path: `/owner/projects/${target.projectId}/socket`, token }),
  },
  { name: 'ListKeys', call: ({ target, token }) => ({ method: 'GET', path: `/owner/projects/${target.projectId}/keys`, token }) },
  { name: 'IssueKey', call: ({ target, token }) => ({ method: 'POST', path: `/owner/projects/${target.projectId}/keys`, token }) },
  {
    name: 'RevokeKey',
    call: ({ target, token }) => ({ method: 'DELETE', path: `/owner/projects/${target.projectId}/keys/${target.keyId}`, token }),
  },
];

function neverIssuedTarget(): Target {
  return { workspaceId: crypto.randomUUID(), projectId: crypto.randomUUID(), inboxId: crypto.randomUUID(), keyId: crypto.randomUUID() };
}

async function seededOwner(): Promise<SeededOwner> {
  const { token } = await signInOwner();
  const workspaceResponse = await ownerCall({ method: 'POST', path: '/owner/workspaces', token, body: { name: OWNER_NAME } });
  const { workspace } = await workspaceResponse.json<{ workspace: { id: string; projects: { id: string }[] } }>();
  const [inbox] = workspace.projects;
  if (inbox === undefined) throw new Error('a workspace has an Inbox');
  const projectResponse = await ownerCall({
    method: 'POST',
    path: `/owner/workspaces/${workspace.id}/projects`,
    token,
    body: { name: SECOND_PROJECT_NAME },
  });
  const { project } = await projectResponse.json<{ project: { id: string } }>();
  const tasksResponse = await ownerCall({
    method: 'POST',
    path: `/owner/projects/${project.id}/tasks`,
    token,
    body: { tasks: [{ title: ORIGINAL_TITLE }] },
  });
  expect(tasksResponse.status).toBe(HttpStatus.Created);
  const keyResponse = await ownerCall({ method: 'POST', path: `/owner/projects/${project.id}/keys`, token });
  const { key, secret } = await keyResponse.json<{ key: { id: string }; secret: string }>();
  return { token, target: { workspaceId: workspace.id, projectId: project.id, inboxId: inbox.id, keyId: key.id }, keySecret: secret };
}

async function answerOf(response: Response): Promise<Answer> {
  return { status: response.status, body: await response.text(), contentType: response.headers.get('Content-Type') };
}

async function mcpStatusWith(secret: string): Promise<number> {
  const response = await exports.default.fetch(MCP_URL, { method: 'POST', headers: { Authorization: `Bearer ${secret}` } });
  return response.status;
}

describe('another owner attacking a workspace, a project or a key', () => {
  test.each(ATTACKS)('$name answers exactly what ids that never existed answer and opens no Durable Object', async ({ call }) => {
    const alice = await seededOwner();
    const bob = await signInOwner();
    const { countedEnv, addressingCalls } = countingEnv();
    const foreign = await answerOf(
      await serveOwnerCall({ call: call({ target: alice.target, token: bob.token }), now: Date.now(), workerEnv: countedEnv }),
    );
    const absent = await answerOf(
      await serveOwnerCall({ call: call({ target: neverIssuedTarget(), token: bob.token }), now: Date.now(), workerEnv: countedEnv }),
    );
    expect(foreign).toEqual(absent);
    expect(foreign.status).toBe(HttpStatus.NotFound);
    expect(addressingCalls).toEqual([]);
  });

  test('the foreign answers carry the not_found body and no socket', async () => {
    const alice = await seededOwner();
    const bob = await signInOwner();
    const bodies = await Promise.all(
      ATTACKS.filter((attack) => !attack.name.includes('without the upgrade')).map(async ({ call }) => {
        const response = await ownerCall(call({ target: alice.target, token: bob.token }));
        expect(response.webSocket).toBeNull();
        return response.text();
      }),
    );
    expect(new Set(bodies)).toEqual(new Set([NOT_FOUND_BODY]));
  });

  test('leaves the names, the tasks, the keys and the MCP key of the victim untouched', async () => {
    const alice = await seededOwner();
    const bob = await signInOwner();
    await Promise.all(ATTACKS.map(({ call }) => ownerCall(call({ target: alice.target, token: bob.token }))));
    const workspaces = await (
      await ownerCall({ method: 'GET', path: '/owner/workspaces', token: alice.token })
    ).json<{
      workspaces: { id: string; name: string; projects: { name: string }[] }[];
    }>();
    expect(
      workspaces.workspaces.map((workspace) => ({ name: workspace.name, projects: workspace.projects.map(({ name }) => name) })),
    ).toEqual([{ name: OWNER_NAME, projects: [INBOX_NAME, SECOND_PROJECT_NAME] }]);
    const changes = await (
      await ownerCall({ method: 'GET', path: `/owner/projects/${alice.target.projectId}/changes?cursor=0`, token: alice.token })
    ).json<{ tasks: { number: number; title: string; state: string }[]; cursor: number }>();
    expect(changes.tasks.map(({ number, title, state }) => ({ number, title, state }))).toEqual([
      { number: 1, title: ORIGINAL_TITLE, state: 'open' },
    ]);
    expect(changes.cursor).toBe(1);
    const keys = await (
      await ownerCall({ method: 'GET', path: `/owner/projects/${alice.target.projectId}/keys`, token: alice.token })
    ).json<{
      keys: { id: string }[];
    }>();
    expect(keys.keys.map(({ id }) => id)).toEqual([alice.target.keyId]);
    expect(await mcpStatusWith(alice.keySecret)).not.toBe(HttpStatus.Unauthorized);
  });

  test('revoking the key id of another owner under the attacker own project answers 404 and keeps the key', async () => {
    const alice = await seededOwner();
    const bob = await seededOwner();
    const response = await ownerCall({
      method: 'DELETE',
      path: `/owner/projects/${bob.target.projectId}/keys/${alice.target.keyId}`,
      token: bob.token,
    });
    expect(response.status).toBe(HttpStatus.NotFound);
    expect(await response.text()).toBe(NOT_FOUND_BODY);
    const keys = await (
      await ownerCall({ method: 'GET', path: `/owner/projects/${alice.target.projectId}/keys`, token: alice.token })
    ).json<{
      keys: { id: string }[];
    }>();
    expect(keys.keys.map(({ id }) => id)).toEqual([alice.target.keyId]);
    expect(await mcpStatusWith(alice.keySecret)).not.toBe(HttpStatus.Unauthorized);
  });

  test('lists none of the workspaces of another owner', async () => {
    const alice = await seededOwner();
    const bob = await seededOwner();
    const response = await ownerCall({ method: 'GET', path: '/owner/workspaces', token: bob.token });
    const { workspaces } = await response.json<{ workspaces: { id: string }[] }>();
    expect(workspaces.map(({ id }) => id)).toEqual([bob.target.workspaceId]);
    expect(workspaces.map(({ id }) => id)).not.toContain(alice.target.workspaceId);
  });
});

describe('credentials of the other kind', () => {
  test('an MCP key as an owner session answers 401 with an empty body', async () => {
    const alice = await seededOwner();
    const response = await ownerCall({ method: 'GET', path: '/owner/workspaces', token: alice.keySecret });
    expect(response.status).toBe(HttpStatus.Unauthorized);
    expect(await response.text()).toBe('');
  });

  test('an owner session as an MCP key answers 401 with an empty body', async () => {
    const alice = await seededOwner();
    const response = await exports.default.fetch(MCP_URL, { method: 'POST', headers: { Authorization: `Bearer ${alice.token}` } });
    expect(response.status).toBe(HttpStatus.Unauthorized);
    expect(await response.text()).toBe('');
  });
});

describe('the directory after the attacks', () => {
  test('holds no workspace or project row the attacker created', async () => {
    const alice = await seededOwner();
    const bob = await signInOwner();
    await Promise.all(ATTACKS.map(({ call }) => ownerCall(call({ target: alice.target, token: bob.token }))));
    const row = await env.DIRECTORY.prepare('SELECT count(*) AS total FROM projects WHERE name = ?')
      .bind(ATTACKED_TITLE)
      .first<{ total: number }>();
    if (row === null) throw new Error('count always answers a row');
    expect(row.total).toBe(0);
  });
});
