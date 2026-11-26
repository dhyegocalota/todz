import { OWNER_WRITES_PER_DAY_MAX } from '@todz/types';
import { env, exports } from 'cloudflare:workers';
import { describe, expect, test } from 'vitest';
import { utcDayOf } from '../src/telemetry/telemetry-day';
import { seedIssuedKey } from './directory-seed';
import { ClientEra, callTool, connectClient } from './mcp-client';

const FORBIDDEN_STATUS = 403;
const SUSPENDED_JSON_RPC_CODE = -32003;
const WORKER_ORIGIN = 'http://localhost:8787';
const FAIR_USE_URL = 'https://docs.todz.app/fair-use';
const JSON_MEDIA_TYPE = 'application/json';

async function ownerOfProject(projectId: string): Promise<string> {
  const row = await env.DIRECTORY.prepare(
    'SELECT workspaces.owner_id AS owner_id FROM projects JOIN workspaces ON workspaces.id = projects.workspace_id WHERE projects.id = ?',
  )
    .bind(projectId)
    .first<{ owner_id: string }>();
  if (row === null) throw new Error('a seeded project has an owner');
  return row.owner_id;
}

async function exhaustToday(ownerId: string): Promise<void> {
  await env.DIRECTORY.prepare('INSERT INTO owner_usage (owner_id, day, writes, bytes) VALUES (?, ?, ?, 0)')
    .bind(ownerId, utcDayOf(Date.now()), OWNER_WRITES_PER_DAY_MAX)
    .run();
}

describe('fair use over MCP', () => {
  test('a suspended key is refused on every call, reads included', async () => {
    const { projectId, key } = await seedIssuedKey();
    await env.DIRECTORY.prepare('UPDATE owners SET suspended_at = ? WHERE id = ?')
      .bind(Date.now(), await ownerOfProject(projectId))
      .run();
    const response = await exports.default.fetch(
      new Request(`${WORKER_ORIGIN}/mcp`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': JSON_MEDIA_TYPE, Accept: `${JSON_MEDIA_TYPE}, text/event-stream` },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} }),
      }),
    );
    expect(response.status).toBe(FORBIDDEN_STATUS);
    const { error } = await response.json<{ error: { code: number; message: string } }>();
    expect(error.code).toBe(SUSPENDED_JSON_RPC_CODE);
    expect(error.message).toContain(FAIR_USE_URL);
  });

  test('a write over the daily cap is an error answer with the limit and adds nothing', async () => {
    const { projectId, key } = await seedIssuedKey();
    await exhaustToday(await ownerOfProject(projectId));
    const client = await connectClient({ era: ClientEra.Modern, key });
    const answer = await callTool({ client, name: 'add', args: { tasks: [{ title: 'Over the day' }] } });
    expect(answer.isError).toBe(true);
    expect(answer.text).toContain(String(OWNER_WRITES_PER_DAY_MAX));
    expect(answer.text).toContain(FAIR_USE_URL);
  });

  test('a normal write by an active key is unchanged', async () => {
    const { key } = await seedIssuedKey();
    const client = await connectClient({ era: ClientEra.Modern, key });
    const answer = await callTool({ client, name: 'add', args: { tasks: [{ title: 'Fine' }] } });
    expect(answer.isError).not.toBe(true);
    expect(answer.text).toContain('Fine');
  });
});
