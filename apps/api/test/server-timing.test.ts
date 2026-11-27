import { env, exports } from 'cloudflare:workers';
import { describe, expect, test } from 'vitest';
import { HttpHeader } from '../src/http-header';
import { HttpStatus } from '../src/http-status';
import { McpToolName } from '../src/mcp-copy';
import { serveMcp } from '../src/mcp-endpoint';
import { timedEnv } from '../src/server-timing';
import { seedProjectWithToken } from './directory-seed';
import { ClientEra, callTool, connectClient } from './mcp-client';
import { createOwnedProject, ownerCall, projectCall } from './owner-client';
import { CLOCK_NOW, TODAY, openTasksFilter, unwrap } from './task-fixtures';

const SERVER_TIMING_PATTERN = /^directory;dur=\d+(\.\d+)?, project;dur=\d+(\.\d+)?$/;
const PROJECT_DURATION_PATTERN = /project;dur=(\d+(\.\d+)?)/;
const WEBSOCKET_UPGRADE = 'websocket';
const MCP_URL = 'http://localhost:8787/mcp';
const LEGACY_INITIALIZE_BODY = {
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'Claude Code', version: '1.0.0' } },
};

function projectDurationOf(response: Response): number {
  const header = response.headers.get(HttpHeader.ServerTiming);
  if (header === null) throw new Error('the answer carries no Server-Timing');
  const match = PROJECT_DURATION_PATTERN.exec(header);
  if (match === null) throw new Error('Server-Timing has no project duration');
  return Number(match[1]);
}

async function listAnswerOf(era: ClientEra): Promise<Response> {
  const { token } = await seedProjectWithToken();
  const answers: Response[] = [];
  const client = await connectClient({ era, token, onResponse: (response) => answers.push(response) });
  answers.length = 0;
  await callTool({ client, name: McpToolName.List, args: {} });
  const answer = answers.find((response) => response.status === HttpStatus.Ok);
  if (answer === undefined) throw new Error('the tools/call was not answered');
  return answer;
}

function legacyInitializeRequest(token: string): Request {
  return new Request(MCP_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
    body: JSON.stringify(LEGACY_INITIALIZE_BODY),
  });
}

describe('timedEnv', () => {
  test('sums the waits on the directory and on a project store apart and leaves the answers as they were', async () => {
    const { env: observedEnv, timings } = timedEnv(env);
    const [first, second] = await observedEnv.DIRECTORY.batch([
      observedEnv.DIRECTORY.prepare('SELECT ? AS value').bind(1),
      observedEnv.DIRECTORY.prepare('SELECT ? AS value').bind(2),
    ]);
    const row = await observedEnv.DIRECTORY.prepare('SELECT ? AS value').bind(3).first<{ value: number }>();
    expect([first?.results, second?.results, row]).toEqual([[{ value: 1 }], [{ value: 2 }], { value: 3 }]);
    expect(timings.projectMs).toBe(0);
    const directoryAfterBatch = timings.directoryMs;
    const stub = observedEnv.PROJECT_STORE.get(observedEnv.PROJECT_STORE.idFromName(crypto.randomUUID()));
    const list = unwrap(await stub.listTasks({ today: TODAY, filter: openTasksFilter() }));
    expect(list.tasks).toEqual([]);
    expect(timings.directoryMs).toBe(directoryAfterBatch);
    expect(timings.projectMs).toBeGreaterThan(0);
  });
});

describe('Server-Timing', () => {
  test('a 2026-era tools/call answer carries both durations and the project one is above zero', async () => {
    const answer = await listAnswerOf(ClientEra.Modern);
    expect(answer.headers.get(HttpHeader.ServerTiming)).toMatch(SERVER_TIMING_PATTERN);
    expect(projectDurationOf(answer)).toBeGreaterThan(0);
  });

  test('a 2025-era tools/call answer, which is a stream, carries both durations and the project one is above zero', async () => {
    const answer = await listAnswerOf(ClientEra.Legacy);
    expect(answer.headers.get(HttpHeader.ContentType)).toContain('text/event-stream');
    expect(answer.headers.get(HttpHeader.ServerTiming)).toMatch(SERVER_TIMING_PATTERN);
    expect(projectDurationOf(answer)).toBeGreaterThan(0);
  });

  test('a streamed answer has the same bytes with the header as the handler gives without it', async () => {
    const { token } = await seedProjectWithToken();
    const direct = await serveMcp({ request: legacyInitializeRequest(token), env, now: CLOCK_NOW });
    const served = await exports.default.fetch(legacyInitializeRequest(token));
    expect(served.headers.get(HttpHeader.ServerTiming)).toMatch(SERVER_TIMING_PATTERN);
    expect(await served.text()).toBe(await direct.text());
  });

  test('an owner project route answer carries both durations', async () => {
    const project = await createOwnedProject();
    const response = await projectCall({ project, method: 'GET', path: '/changes?cursor=0' });
    expect(response.status).toBe(HttpStatus.Ok);
    expect(response.headers.get(HttpHeader.ServerTiming)).toMatch(SERVER_TIMING_PATTERN);
    expect(projectDurationOf(response)).toBeGreaterThan(0);
  });

  test('an owner answer refused with 401 carries none', async () => {
    const response = await ownerCall({ method: 'GET', path: '/owner/workspaces' });
    expect(response.status).toBe(HttpStatus.Unauthorized);
    expect(response.headers.has(HttpHeader.ServerTiming)).toBe(false);
  });

  test('an MCP answer refused with 401 carries none', async () => {
    const response = await exports.default.fetch(legacyInitializeRequest('not-a-key'));
    expect(response.status).toBe(HttpStatus.Unauthorized);
    expect(response.headers.has(HttpHeader.ServerTiming)).toBe(false);
  });

  test('the socket upgrade keeps its webSocket and carries none', async () => {
    const project = await createOwnedProject();
    const response = await projectCall({ project, method: 'GET', path: '/socket', headers: { Upgrade: WEBSOCKET_UPGRADE } });
    expect(response.status).toBe(HttpStatus.SwitchingProtocols);
    expect(response.webSocket).not.toBeNull();
    expect(response.headers.has(HttpHeader.ServerTiming)).toBe(false);
    response.webSocket?.accept();
  });
});
