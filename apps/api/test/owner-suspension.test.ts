import { env } from 'cloudflare:workers';
import { describe, expect, test } from 'vitest';
import { setOwnerSuspension } from '../src/owner-usage-store';
import { ownerCall, signInOwner } from './owner-client';

const FORBIDDEN_STATUS = 403;
const CREATED_STATUS = 201;
const OK_STATUS = 200;
const SUSPENDED_ERROR = 'account_suspended';
const FAIR_USE_URL = 'https://docs.todz.app/fair-use';

type WorkspaceBody = { workspace: { id: string; projects: { id: string }[] } };

async function suspend({ ownerId, suspendedAt }: { ownerId: string; suspendedAt: number | null }): Promise<void> {
  await setOwnerSuspension({ directory: env.DIRECTORY, ownerId, suspendedAt });
}

async function workspaceOf(token: string): Promise<WorkspaceBody['workspace']> {
  const response = await ownerCall({ method: 'POST', path: '/owner/workspaces', token, body: { name: 'Work' } });
  const body = await response.json<WorkspaceBody>();
  return body.workspace;
}

describe('a suspended owner', () => {
  test('every write answers 403 with the suspension and changes nothing', async () => {
    const { token, ownerId } = await signInOwner();
    const workspace = await workspaceOf(token);
    const inboxId = workspace.projects[0]?.id;
    if (inboxId === undefined) throw new Error('a workspace has an Inbox');
    await suspend({ ownerId, suspendedAt: Date.now() });
    const writes = [
      () => ownerCall({ method: 'POST', path: '/owner/workspaces', token, body: { name: 'Late' } }),
      () => ownerCall({ method: 'PATCH', path: `/owner/workspaces/${workspace.id}`, token, body: { name: 'Renamed' } }),
      () => ownerCall({ method: 'POST', path: `/owner/workspaces/${workspace.id}/projects`, token, body: { name: 'Side' } }),
      () => ownerCall({ method: 'PATCH', path: `/owner/projects/${inboxId}`, token, body: { name: 'Nope' } }),
      () => ownerCall({ method: 'POST', path: `/owner/projects/${inboxId}/tasks`, token, body: { tasks: [{ title: 'Blocked' }] } }),
      () => ownerCall({ method: 'POST', path: `/owner/projects/${inboxId}/keys`, token }),
      () => ownerCall({ method: 'PATCH', path: '/owner', token, body: { time_zone: 'UTC' } }),
    ];
    const responses = await Promise.all(writes.map((write) => write()));
    for (const response of responses) {
      expect(response.status).toBe(FORBIDDEN_STATUS);
      const body = await response.json<{ error: string; message: string }>();
      expect(body.error).toBe(SUSPENDED_ERROR);
      expect(body.message).toContain(FAIR_USE_URL);
    }
    const listed = await ownerCall({ method: 'GET', path: '/owner/workspaces', token });
    expect((await listed.json<{ workspaces: { id: string }[] }>()).workspaces.map(({ id }) => id)).toEqual([workspace.id]);
  });

  test('reads still answer 200 with the owner data', async () => {
    const { token, ownerId } = await signInOwner();
    await suspend({ ownerId, suspendedAt: Date.now() });
    const owner = await ownerCall({ method: 'GET', path: '/owner', token });
    expect(owner.status).toBe(OK_STATUS);
    expect((await owner.json<{ owner: { id: string } }>()).owner.id).toBe(ownerId);
  });

  test('sign-out still answers, so the owner can leave', async () => {
    const { token, ownerId } = await signInOwner();
    await suspend({ ownerId, suspendedAt: Date.now() });
    const signedOut = await ownerCall({ method: 'DELETE', path: '/owner/sessions/current', token });
    expect(signedOut.status).not.toBe(FORBIDDEN_STATUS);
  });

  test('restoring the owner restores writes', async () => {
    const { token, ownerId } = await signInOwner();
    await suspend({ ownerId, suspendedAt: Date.now() });
    await suspend({ ownerId, suspendedAt: null });
    const created = await ownerCall({ method: 'POST', path: '/owner/workspaces', token, body: { name: 'Back' } });
    expect(created.status).toBe(CREATED_STATUS);
  });
});
