import { type CallToolResult, Client, type ClientOptions, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { exports } from 'cloudflare:workers';
import { onTestFinished } from 'vitest';

const MCP_URL = new URL('https://api.todz.test/mcp');
const CLIENT_VERSION = '1.0.0';
const MODERN_PROTOCOL_VERSION = '2026-07-28';

export enum ClientEra {
  Legacy = 'legacy',
  Modern = 'modern',
}

export const CLIENT_NAME_OF_ERA: Record<ClientEra, string> = {
  [ClientEra.Legacy]: 'Claude Code',
  [ClientEra.Modern]: 'Codex',
};

const CLIENT_OPTIONS_OF_ERA: Record<ClientEra, ClientOptions> = {
  [ClientEra.Legacy]: {},
  [ClientEra.Modern]: { versionNegotiation: { mode: { pin: MODERN_PROTOCOL_VERSION } } },
};

export type ToolAnswer = { text: string; isError: boolean | undefined };

export async function connectClient({
  era,
  key,
  clientName = CLIENT_NAME_OF_ERA[era],
}: {
  era: ClientEra;
  key: string;
  clientName?: string;
}): Promise<Client> {
  const client = new Client({ name: clientName, version: CLIENT_VERSION }, CLIENT_OPTIONS_OF_ERA[era]);
  const transport = new StreamableHTTPClientTransport(MCP_URL, {
    fetch: (input, init) => exports.default.fetch(new Request(input, init)),
    requestInit: { headers: { Authorization: `Bearer ${key}` } },
  });
  await client.connect(transport);
  onTestFinished(() => client.close());
  return client;
}

type ToolContent = CallToolResult['content'][number];

function onlyText(content: ToolContent[]): string {
  const [first] = content;
  const isSingleText = content.length === 1 && first !== undefined && first.type === 'text';
  if (!isSingleText) throw new Error(`expected one text item, got ${JSON.stringify(content)}`);
  return first.text;
}

export async function callTool({
  client,
  name,
  args,
}: {
  client: Client;
  name: string;
  args: Record<string, unknown>;
}): Promise<ToolAnswer> {
  const result = await client.callTool({ name, arguments: args });
  return { text: onlyText(result.content), isError: result.isError };
}
