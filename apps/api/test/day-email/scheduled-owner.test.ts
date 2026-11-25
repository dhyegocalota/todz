import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, test } from 'vitest';
import { type ScheduledOwner, listDayEmailCandidates, listScheduledWorkspaces } from '../../src/project-routing';
import { resetDayEmails, seedDayOwner, seedProjectOf } from './day-email-client';

beforeEach(async () => {
  await resetDayEmails();
});

describe('a scheduled owner', () => {
  test('is made only for an owner the candidates query returns', async () => {
    const enabled = await seedDayOwner();
    const disabled = await seedDayOwner({ isEnabled: false });
    const candidates = await listDayEmailCandidates({ env });
    const candidateIds = candidates.map((candidate) => candidate.owner.ownerId);
    expect(candidateIds).toContain(enabled.ownerId);
    expect(candidateIds).not.toContain(disabled.ownerId);
  });

  test('carries the stored zone, the chosen minute and the sign-in address', async () => {
    const owner = await seedDayOwner({ timeZone: 'Asia/Kolkata', minutes: 450 });
    const candidate = (await listDayEmailCandidates({ env })).find((entry) => entry.owner.ownerId === owner.ownerId);
    expect(candidate).toMatchObject({ timeZone: 'Asia/Kolkata', minutes: 450, address: owner.address });
  });

  test("lists its own workspaces and projects in the directory order and nobody else's", async () => {
    const owner = await seedDayOwner({ workspaceName: 'Personal' });
    const other = await seedDayOwner({ workspaceName: 'Other' });
    const home = await seedProjectOf({ workspaceId: owner.workspaceId, name: 'Home' });
    const candidate = (await listDayEmailCandidates({ env })).find((entry) => entry.owner.ownerId === owner.ownerId);
    if (candidate === undefined) throw new Error('the owner should be a candidate');
    const workspaces = await listScheduledWorkspaces({ env, owner: candidate.owner });
    expect(workspaces?.map(({ workspace }) => workspace.name)).toEqual(['Personal']);
    expect(workspaces?.flatMap(({ projects }) => projects.map(({ record }) => record.id))).toEqual([owner.inboxId, home]);
    expect(workspaces?.flatMap(({ projects }) => projects.map(({ record }) => record.id))).not.toContain(other.inboxId);
  });

  test('a forged object opens nothing', async () => {
    const owner = await seedDayOwner();
    const forged = { ownerId: owner.ownerId } as ScheduledOwner;
    expect(await listScheduledWorkspaces({ env, owner: forged })).toBeNull();
  });
});
