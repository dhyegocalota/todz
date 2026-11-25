import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { TASK_SHORT_ID_PREFIX } from '@todz/types';
import { ScenarioKind } from './scenario-kind';
import { inSequence } from './sequence';
import { type Sample, timedFetch } from './timed-fetch';

export enum McpEra {
  Legacy = 'legacy',
  Modern = 'modern',
}

export type McpAccess = { origin: string; key: string; era: McpEra; fetch: typeof fetch };

export type ListedTask = { number: number; title: string };

export type ListAnswer = { totalMatched: number; tasks: ListedTask[] };

type Measurement = { now: () => number; record: (sample: Sample) => void };

const CLIENT_NAME = 'todz-perf';
const CLIENT_VERSION = '1.0.0';
const MODERN_PROTOCOL_VERSION = '2026-07-28';
const TEXT_CONTENT = 'text';
const LIST_HEADER_PATTERN = /^(?:Open|Done) tasks: \d+ of (\d+)/;
const TASK_LINE_PATTERN = new RegExp(`^${TASK_SHORT_ID_PREFIX}(\\d+) (.*?)(?: · due .*)?$`);
const ADDED_PATTERN = new RegExp(`^(?:Already added|Added) ${TASK_SHORT_ID_PREFIX}(\\d+)`);
const FIRST_GROUP = 1;
const SECOND_GROUP = 2;

const CLIENT_OPTIONS_OF_ERA = {
  [McpEra.Legacy]: {},
  [McpEra.Modern]: { versionNegotiation: { mode: { pin: MODERN_PROTOCOL_VERSION } } },
};

async function connectedClient({ origin, key, era, fetch }: McpAccess): Promise<Client> {
  const client = new Client({ name: CLIENT_NAME, version: CLIENT_VERSION }, CLIENT_OPTIONS_OF_ERA[era]);
  const transport = new StreamableHTTPClientTransport(new URL(`${origin}/mcp`), {
    fetch,
    requestInit: { headers: { Authorization: `Bearer ${key}` } },
  });
  await client.connect(transport);
  return client;
}

export async function connectMeasuredMcp({
  now,
  scenario,
  record,
  ...access
}: McpAccess & Measurement & { scenario: ScenarioKind }): Promise<Client> {
  const measuring = { isOn: false };
  const timed = timedFetch({
    fetch: access.fetch,
    now,
    scenario,
    record: (sample) => {
      if (measuring.isOn) record(sample);
    },
  });
  const client = await connectedClient({ ...access, fetch: timed });
  measuring.isOn = true;
  return client;
}

async function measuredInitialize({ now, record, ...access }: Omit<McpAccess, 'era'> & Measurement): Promise<void> {
  const recording = { isFirstRequest: true };
  const timed = timedFetch({
    fetch: access.fetch,
    now,
    scenario: ScenarioKind.Initialize,
    record: (sample) => {
      if (!recording.isFirstRequest) return;
      recording.isFirstRequest = false;
      record(sample);
    },
  });
  const client = await connectedClient({ ...access, era: McpEra.Legacy, fetch: timed });
  await client.close();
}

export async function measureInitialize({
  count,
  ...measurement
}: Omit<McpAccess, 'era'> & Measurement & { count: number }): Promise<void> {
  await inSequence({ items: Array.from({ length: count }), step: () => measuredInitialize(measurement) });
}

async function callTool({
  client,
  name,
  toolArguments,
}: {
  client: Client;
  name: string;
  toolArguments: Record<string, unknown>;
}): Promise<string> {
  const result = await client.callTool({ name, arguments: toolArguments });
  const [content] = result.content;
  const isSingleText = result.content.length === 1 && content !== undefined && content.type === TEXT_CONTENT;
  if (!isSingleText) throw new Error(`expected one text item, got ${JSON.stringify(result.content)}`);
  if (result.isError) throw new Error(content.text);
  return content.text;
}

function groupOf({ match, group }: { match: RegExpExecArray | null; group: number }): string {
  if (match === null) throw new Error('the answer does not have the expected shape');
  const text = match[group];
  if (text === undefined) throw new Error('the answer does not have the expected shape');
  return text;
}

function numberAt({ match, group }: { match: RegExpExecArray | null; group: number }): number {
  return Number(groupOf({ match, group }));
}

function listedTasksOf(answer: string): ListedTask[] {
  return answer.split('\n').flatMap((line) => {
    const match = TASK_LINE_PATTERN.exec(line);
    if (match === null) return [];
    return [{ number: numberAt({ match, group: FIRST_GROUP }), title: groupOf({ match, group: SECOND_GROUP }) }];
  });
}

export async function listTasks({ client, text, limit }: { client: Client; text?: string; limit?: number }): Promise<ListAnswer> {
  const toolArguments = { ...(text === undefined ? {} : { text }), ...(limit === undefined ? {} : { limit }) };
  const answer = await callTool({ client, name: 'list', toolArguments });
  return { totalMatched: numberAt({ match: LIST_HEADER_PATTERN.exec(answer), group: FIRST_GROUP }), tasks: listedTasksOf(answer) };
}

export async function addTask({
  client,
  title,
  idempotencyKey,
}: {
  client: Client;
  title: string;
  idempotencyKey: string;
}): Promise<number> {
  const toolArguments = { tasks: [{ title, idempotency_key: idempotencyKey }] };
  const answer = await callTool({ client, name: 'add', toolArguments });
  return numberAt({ match: ADDED_PATTERN.exec(answer), group: FIRST_GROUP });
}

export async function updateTask({ client, number, title }: { client: Client; number: number; title: string }): Promise<void> {
  await callTool({ client, name: 'update', toolArguments: { id: `${TASK_SHORT_ID_PREFIX}${number}`, title } });
}

export async function completeTasks({ client, numbers }: { client: Client; numbers: number[] }): Promise<void> {
  await callTool({ client, name: 'done', toolArguments: { ids: numbers.map((number) => `${TASK_SHORT_ID_PREFIX}${number}`) } });
}
