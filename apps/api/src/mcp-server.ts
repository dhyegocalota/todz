import { CLIENT_INFO_META_KEY, McpServer, type ServerContext } from '@modelcontextprotocol/server';
import { z } from 'zod';
import { MCP_COPY } from './mcp-copy';
import type { ProjectStore } from './project-store';

const MCP_SERVER_NAME = 'todz';
const MCP_SERVER_VERSION = '0.1.0';

const EnvelopeClientSchema = z.object({ [CLIENT_INFO_META_KEY]: z.object({ name: z.string() }) });

export type ClientNameOf = (ctx: ServerContext) => string;

export type McpServerScope = { project: DurableObjectStub<ProjectStore>; today: string; clientNameOf: ClientNameOf };

export function envelopeClientName(ctx: ServerContext): string {
  const envelope = EnvelopeClientSchema.safeParse(ctx.mcpReq.envelope);
  if (!envelope.success) throw new Error('the modern request names no client');
  return envelope.data[CLIENT_INFO_META_KEY].name;
}

export function buildMcpServer(scope: McpServerScope): McpServer {
  return new McpServer({ name: MCP_SERVER_NAME, version: MCP_SERVER_VERSION }, { instructions: MCP_COPY.instructions });
}
