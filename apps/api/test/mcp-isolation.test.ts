import type { Client } from '@modelcontextprotocol/client';
import { describe, expect, test } from 'vitest';
import { MCP_COPY, McpToolName } from '../src/mcp-copy';
import { seedIssuedKey } from './directory-seed';
import { ClientEra, callTool, connectClient } from './mcp-client';

const SECRET_TITLE = 'Secret B';
const B_TITLES = [SECRET_TITLE, 'B two'];

type TwoProjects = { clientA: Client; clientB: Client };

async function twoProjects(era: ClientEra): Promise<TwoProjects> {
  const projectA = await seedIssuedKey();
  const projectB = await seedIssuedKey();
  const clientA = await connectClient({ era, key: projectA.key });
  const clientB = await connectClient({ era, key: projectB.key });
  await callTool({ client: clientB, name: McpToolName.Add, args: { tasks: B_TITLES.map((title) => ({ title })) } });
  return { clientA, clientB };
}

function listOpen(client: Client) {
  return callTool({ client, name: McpToolName.List, args: {} });
}

function notFoundResult(text: string): { content: { type: string; text: string }[]; isError: boolean } {
  return { content: [{ type: 'text', text }], isError: true };
}

describe.each([ClientEra.Legacy, ClientEra.Modern])('a %s client with the key of project A', (era) => {
  test('lists nothing and has no next task while B holds tasks (pin)', async () => {
    const { clientA } = await twoProjects(era);
    expect((await listOpen(clientA)).text).toBe('Open tasks: 0 of 0');
    expect((await callTool({ client: clientA, name: McpToolName.Next, args: {} })).text).toBe(MCP_COPY.noOpenTasks);
  });

  test('updating and completing the tasks of B answer what tasks never issued answer, and B is unchanged (pin)', async () => {
    const { clientA, clientB } = await twoProjects(era);
    const crossUpdate = await clientA.callTool({ name: McpToolName.Update, arguments: { id: 'T-1', title: 'x' } });
    const missingUpdate = await clientA.callTool({ name: McpToolName.Update, arguments: { id: 'T-77', title: 'x' } });
    const crossDone = await clientA.callTool({ name: McpToolName.Done, arguments: { ids: ['T-2'] } });
    const missingDone = await clientA.callTool({ name: McpToolName.Done, arguments: { ids: ['T-78'] } });
    expect(missingUpdate).toMatchObject(notFoundResult('T-77 not found.'));
    expect(missingDone).toMatchObject(notFoundResult('T-78 not found.'));
    expect(crossUpdate).toEqual({ ...missingUpdate, ...notFoundResult('T-1 not found.') });
    expect(crossDone).toEqual({ ...missingDone, ...notFoundResult('T-2 not found.') });
    expect((await listOpen(clientB)).text).toBe('Open tasks: 2 of 2\nT-1 Secret B\nT-2 B two');
  });

  test('searching for the title only B has finds nothing (pin)', async () => {
    const { clientA } = await twoProjects(era);
    expect((await callTool({ client: clientA, name: McpToolName.List, args: { text: SECRET_TITLE } })).text).toBe('Open tasks: 0 of 0');
  });

  test('adding a task makes T-1 of A and leaves T-1 of B as it was (pin)', async () => {
    const { clientA, clientB } = await twoProjects(era);
    expect((await callTool({ client: clientA, name: McpToolName.Add, args: { tasks: [{ title: 'Mine' }] } })).text).toBe('Added T-1 Mine');
    expect((await listOpen(clientB)).text).toBe('Open tasks: 2 of 2\nT-1 Secret B\nT-2 B two');
  });
});

describe('two owners at once', () => {
  test('each lists only its own titles (pin)', async () => {
    const owners = await Promise.all(
      ['First owner task', 'Second owner task'].map(async (title) => ({ title, ...(await seedIssuedKey()) })),
    );
    const lists = await Promise.all(
      owners.map(async ({ title, key }) => {
        const client = await connectClient({ era: ClientEra.Modern, key });
        await callTool({ client, name: McpToolName.Add, args: { tasks: [{ title }] } });
        return (await listOpen(client)).text;
      }),
    );
    expect(lists).toEqual(['Open tasks: 1 of 1\nT-1 First owner task', 'Open tasks: 1 of 1\nT-1 Second owner task']);
  });
});
