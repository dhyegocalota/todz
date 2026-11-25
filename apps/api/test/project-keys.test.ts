import { env } from 'cloudflare:workers';
import { describe, expect, test } from 'vitest';
import { digestCredential } from '../src/credential-digest';
import { issueProjectKey } from '../src/project-keys';
import { openKeyProject } from '../src/project-routing';
import { issuedKeyOf, seedOwner, seedProject } from './directory-seed';
import { AGENT_ACTOR, CLOCK_NOW, TODAY, draftOf, openTasksFilter, unwrap } from './task-fixtures';

const PROJECT_KEY_PATTERN = /^todz_[A-Za-z0-9_-]{43}$/;
const FOREIGN_KEY_FAILURE = 'FOREIGN KEY constraint failed';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const KEY_HINT_LENGTH = 4;

type KeyRow = { digest: string; id: string; hint: string; project_id: string; revoked_at: number | null };
type TableRow = { name: string };

async function keyRowsOf(projectId: string): Promise<KeyRow[]> {
  const { results } = await env.DIRECTORY.prepare('SELECT digest, id, hint, project_id, revoked_at FROM project_keys WHERE project_id = ?')
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
    const { id, secret } = await issuedKeyOf(issueProjectKey({ directory: env.DIRECTORY, projectId, now: CLOCK_NOW }));
    expect(secret).toMatch(PROJECT_KEY_PATTERN);
    expect(id).toMatch(UUID_PATTERN);
    expect(await keyRowsOf(projectId)).toEqual([
      { digest: await digestCredential(secret), id, hint: secret.slice(-KEY_HINT_LENGTH), project_id: projectId, revoked_at: null },
    ]);
    expect(await directoryValues()).not.toContain(secret);
  });

  test('two keys of one project have two ids and two hints taken from their own secrets', async () => {
    const projectId = await seedProject({ ownerId: await seedOwner() });
    const first = await issuedKeyOf(issueProjectKey({ directory: env.DIRECTORY, projectId, now: CLOCK_NOW }));
    const second = await issuedKeyOf(issueProjectKey({ directory: env.DIRECTORY, projectId, now: CLOCK_NOW }));
    expect(first.id).not.toBe(second.id);
    const rows = await keyRowsOf(projectId);
    expect(rows.map((row) => row.id).sort()).toEqual([first.id, second.id].sort());
    expect(rows.map((row) => row.hint).sort()).toEqual(
      [first.secret.slice(-KEY_HINT_LENGTH), second.secret.slice(-KEY_HINT_LENGTH)].sort(),
    );
  });

  test('two keys of one project are two secrets and two rows that both open the project', async () => {
    const projectId = await seedProject({ ownerId: await seedOwner() });
    const { secret: firstSecret } = await issuedKeyOf(issueProjectKey({ directory: env.DIRECTORY, projectId, now: CLOCK_NOW }));
    const { secret: secondSecret } = await issuedKeyOf(issueProjectKey({ directory: env.DIRECTORY, projectId, now: CLOCK_NOW }));
    expect(firstSecret).not.toBe(secondSecret);
    expect(await keyRowsOf(projectId)).toHaveLength(2);
    const firstKeyProject = await openKeyProject({ env, secret: firstSecret });
    const secondKeyProject = await openKeyProject({ env, secret: secondSecret });
    if (firstKeyProject === null || secondKeyProject === null) throw new Error('both keys should open the project');
    unwrap(await firstKeyProject.project.addTasks({ actor: AGENT_ACTOR, drafts: [draftOf('Through the first key')] }));
    const listed = unwrap(await secondKeyProject.project.listTasks({ today: TODAY, filter: openTasksFilter() }));
    expect(listed.tasks.map((task) => task.title)).toEqual(['Through the first key']);
  });

  test('a project id that does not exist is refused and adds no row', async () => {
    const before = await keyRowCount();
    const issuance = issueProjectKey({ directory: env.DIRECTORY, projectId: crypto.randomUUID(), now: CLOCK_NOW });
    await expect(issuance).rejects.toThrow(FOREIGN_KEY_FAILURE);
    expect(await keyRowCount()).toBe(before);
  });
});
