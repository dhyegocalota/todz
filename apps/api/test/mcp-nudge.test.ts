import { Client, InMemoryTransport } from '@modelcontextprotocol/client';
import { MILLISECONDS_PER_DAY } from '@todz/types';
import { describe, expect, onTestFinished, test } from 'vitest';
import { MCP_COPY, McpPromptName, McpToolName } from '../src/mcp-copy';
import { buildMcpServer } from '../src/mcp-server';
import { calendarDateInTimeZone } from '../src/owner-today';
import { ProjectFailureKind } from '../src/project-result';
import type { ProjectStore } from '../src/project-store';
import { seedIssuedKey, seedNudgedKey } from './directory-seed';
import { ClientEra, callTool, connectClient } from './mcp-client';
import { buildTask, calendarDate } from './task-fixtures';

const UTC_TIME_ZONE = 'UTC';
const NUDGE_PREFIX = 'Today here:';
const CLIENT_NAME = 'Codex';
const CLIENT_VERSION = '1.0.0';
const SHIP_IT = buildTask({ number: 3, title: 'Ship it' });

function shiftedDay(days: number): string {
  return calendarDateInTimeZone({ timeZone: UTC_TIME_ZONE, now: Date.now() + days * MILLISECONDS_PER_DAY });
}

const TODAY = shiftedDay(0);
const YESTERDAY = shiftedDay(-1);
const TWO_DAYS_AGO = shiftedDay(-2);
const TOMORROW = shiftedDay(1);

async function connectedWith({ era, isNudged, dueDates }: { era: ClientEra; isNudged: boolean; dueDates: Array<string | null> }) {
  const { key } = isNudged ? await seedNudgedKey() : await seedIssuedKey();
  const client = await connectClient({ era, key });
  const tasks = dueDates.map((dueDate, index) => ({ title: `Task ${index + 1}`, due_date: dueDate }));
  await callTool({ client, name: McpToolName.Add, args: { tasks } });
  return client;
}

async function promptText(client: Client): Promise<string> {
  const prompt = await client.getPrompt({ name: McpPromptName.Next });
  const [message] = prompt.messages;
  if (message?.content.type !== 'text') throw new Error('the prompt should be one text message');
  return message.content.text;
}

async function nextText(client: Client): Promise<string> {
  const answer = await callTool({ client, name: McpToolName.Next, args: {} });
  return answer.text;
}

describe.each([ClientEra.Legacy, ClientEra.Modern])('a %s client and the agent nudge', (era) => {
  test('with the flag off, a task due today leaves next as it always was (pin)', async () => {
    const client = await connectedWith({ era, isNudged: false, dueDates: [TODAY] });
    expect(await nextText(client)).toBe(`T-1 Task 1 · due ${TODAY}`);
    expect(await promptText(client)).toBe(
      `${MCP_COPY.workOnTask}\n\n<task>\nT-1 Task 1 · due ${TODAY}\n</task>\n\n${MCP_COPY.finishWith('T-1')}`,
    );
  });

  test('with the flag on and nothing due, only upcoming and undated, next is unchanged (pin)', async () => {
    const client = await connectedWith({ era, isNudged: true, dueDates: [TOMORROW, null] });
    expect(await nextText(client)).toBe(`T-2 Task 2`);
    expect(await promptText(client)).not.toContain(NUDGE_PREFIX);
  });

  test('with the flag on and no tasks at all, next is unchanged (pin)', async () => {
    const client = await connectedWith({ era, isNudged: true, dueDates: [] });
    expect(await nextText(client)).toBe(MCP_COPY.noOpenTasks);
    expect(await promptText(client)).toBe(MCP_COPY.nothingToDo);
  });

  test('one task due today starts the tool answer and the prompt with the line for 1', async () => {
    const client = await connectedWith({ era, isNudged: true, dueDates: [TODAY] });
    expect(await nextText(client)).toBe(`Today here: 1 due. Start with T-1?\n\nT-1 Task 1 · due ${TODAY}`);
    expect(await promptText(client)).toBe(
      `Today here: 1 due. Start with T-1?\n\n${MCP_COPY.workOnTask}\n\n<task>\nT-1 Task 1 · due ${TODAY}\n</task>\n\n${MCP_COPY.finishWith('T-1')}`,
    );
  });

  test('three due with one overdue names the overdue form and the task the answer shows', async () => {
    const client = await connectedWith({ era, isNudged: true, dueDates: [TODAY, YESTERDAY, TODAY] });
    expect(await nextText(client)).toBe(`Today here: 3 due (1 overdue). Start with T-2?\n\nT-2 Task 2 · due ${YESTERDAY}`);
    expect(await promptText(client)).toMatch(/^Today here: 3 due \(1 overdue\)\. Start with T-2\?\n\n/);
  });

  test('two overdue tasks say all overdue and name the older one', async () => {
    const client = await connectedWith({ era, isNudged: true, dueDates: [YESTERDAY, TWO_DAYS_AGO] });
    expect(await nextText(client)).toBe(`Today here: 2 overdue. Start with T-2?\n\nT-2 Task 2 · due ${TWO_DAYS_AGO}`);
  });

  test('a single overdue task says 1 overdue', async () => {
    const client = await connectedWith({ era, isNudged: true, dueDates: [YESTERDAY] });
    expect(await nextText(client)).toBe(`Today here: 1 overdue. Start with T-1?\n\nT-1 Task 1 · due ${YESTERDAY}`);
  });

  test('list, add, update and done never carry the line', async () => {
    const client = await connectedWith({ era, isNudged: true, dueDates: [TODAY] });
    const answers = [
      await callTool({ client, name: McpToolName.List, args: {} }),
      await callTool({ client, name: McpToolName.Add, args: { tasks: [{ title: 'Another', due_date: TODAY }] } }),
      await callTool({ client, name: McpToolName.Update, args: { id: 'T-1', title: 'Renamed' } }),
      await callTool({ client, name: McpToolName.Done, args: { ids: ['T-1'] } }),
    ];
    expect(answers.map((answer) => answer.text.includes(NUDGE_PREFIX))).toEqual([false, false, false, false]);
  });
});

describe('next when the due count cannot be read', () => {
  type FakeProject = { nextTask: () => Promise<unknown>; dueNow: () => Promise<unknown> };

  async function connectedFake(dueNow: () => Promise<unknown>): Promise<Client> {
    const project: FakeProject = { nextTask: async () => ({ ok: true, value: SHIP_IT }), dueNow };
    const server = buildMcpServer({
      project: project as unknown as DurableObjectStub<ProjectStore>,
      workspace: { projectId: 'project', listProjects: async () => [], openSibling: async () => null },
      today: calendarDate('2026-11-23'),
      agentNudge: true,
      clientNameOf: () => CLIENT_NAME,
    });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    const client = new Client({ name: CLIENT_NAME, version: CLIENT_VERSION });
    await client.connect(clientTransport);
    onTestFinished(() => client.close());
    return client;
  }

  const failures: Array<[string, () => Promise<unknown>]> = [
    [
      'throws',
      async () => {
        throw new Error('the project is unavailable');
      },
    ],
    ['answers a failure', async () => ({ ok: false, failure: { kind: ProjectFailureKind.CursorAhead } })],
  ];

  test.each(failures)('dueNow that %s leaves the tool answer and the prompt as with the flag off', async (_name, dueNow) => {
    const client = await connectedFake(dueNow);
    expect(await nextText(client)).toBe('T-3 Ship it');
    expect(await promptText(client)).not.toContain(NUDGE_PREFIX);
  });
});
