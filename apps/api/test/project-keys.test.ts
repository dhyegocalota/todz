import { env } from 'cloudflare:workers';
import { describe, expect, test } from 'vitest';
import { digestCredential } from '../src/credential-digest';
import { issueProjectKey } from '../src/project-keys';
import { openKeyProject } from '../src/project-routing';
import { seedOwner, seedProject } from './directory-seed';
import { AGENT_ACTOR, CLOCK_NOW, TODAY, draftOf, openTasksFilter, unwrap } from './task-fixtures';

const PROJECT_KEY_PATTERN = /^todz_[A-Za-z0-9_-]{43}$/;
const FOREIGN_KEY_FAILURE = 'FOREIGN KEY constraint failed';

type KeyRow = { digest: string; project_id: string; revoked_at: number | null };
type TableRow = { name: string };

async function keyRowsOf(projectId: string): Promise<KeyRow[]> {
  const { results } = await env.DIRECTORY.prepare('SELECT digest, project_id, revoked_at FROM project_keys WHERE project_id = ?')
    .bind(projectId)
    .all<KeyRow>();
  return results;
}

async function keyRowCount(): Promise<number> {
  const row = await env.DIRECTORY.prepare('SELECT count(*) AS total FROM project_keys').first<{ total: number }>();
  if (row === null) throw new Error('count always answers a row');
  return row.total;
}

async function directoryValues(): Promise<unknown[]> {
  const { results: tables } = await env.DIRECTORY.prepare(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name <> 'd1_migrations'",
  ).all<TableRow>();
  const rows = await Promise.all(
    tables.map(async (table) => (await env.DIRECTORY.prepare(`SELECT * FROM ${table.name}`).all<Record<string, unknown>>()).results),
  );
  return rows.flat().flatMap((row) => Object.values(row));
}

describe('issueProjectKey', () => {
  test('a seeded project gets a prefixed key stored only as its digest', async () => {
    const projectId = await seedProject({ ownerId: await seedOwner() });
    const secret = await issueProjectKey({ directory: env.DIRECTORY, projectId, now: CLOCK_NOW });
    expect(secret).toMatch(PROJECT_KEY_PATTERN);
    expect(await keyRowsOf(projectId)).toEqual([{ digest: await digestCredential(secret), project_id: projectId, revoked_at: null }]);
    expect(await directoryValues()).not.toContain(secret);
  });

  test('two keys of one project are two secrets and two rows that both open the project', async () => {
    const projectId = await seedProject({ ownerId: await seedOwner() });
    const firstSecret = await issueProjectKey({ directory: env.DIRECTORY, projectId, now: CLOCK_NOW });
    const secondSecret = await issueProjectKey({ directory: env.DIRECTORY, projectId, now: CLOCK_NOW });
    expect(firstSecret).not.toBe(secondSecret);
    expect(await keyRowsOf(projectId)).toHaveLength(2);
    const firstStub = await openKeyProject({ env, secret: firstSecret });
    const secondStub = await openKeyProject({ env, secret: secondSecret });
    if (firstStub === null || secondStub === null) throw new Error('both keys should open the project');
    unwrap(await firstStub.addTasks({ actor: AGENT_ACTOR, drafts: [draftOf('Through the first key')] }));
    const listed = unwrap(await secondStub.listTasks({ today: TODAY, filter: openTasksFilter() }));
    expect(listed.tasks.map((task) => task.title)).toEqual(['Through the first key']);
  });

  test('a project id that does not exist is refused and adds no row', async () => {
    const before = await keyRowCount();
    const issuance = issueProjectKey({ directory: env.DIRECTORY, projectId: crypto.randomUUID(), now: CLOCK_NOW });
    await expect(issuance).rejects.toThrow(FOREIGN_KEY_FAILURE);
    expect(await keyRowCount()).toBe(before);
  });
});
