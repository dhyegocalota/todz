import { COMPANY, REPOSITORY } from '@todz/types';
import { MCP_COPY, McpToolName } from '../mcp-copy';

export enum DocsPageSlug {
  Introduction = 'introduction',
  Quickstart = 'quickstart',
  InstallOnMac = 'install-on-mac',
  ConnectAnAgent = 'connect-an-agent',
  McpTools = 'mcp-tools',
  SelfHost = 'self-host',
}

export type DocsPage = { slug: DocsPageSlug; title: string; path: string };

export const DOCS_PAGES: DocsPage[] = [
  { slug: DocsPageSlug.Introduction, title: 'Introduction', path: '/' },
  { slug: DocsPageSlug.Quickstart, title: 'Quickstart', path: '/quickstart' },
  { slug: DocsPageSlug.InstallOnMac, title: 'Install on Mac', path: '/install-on-mac' },
  { slug: DocsPageSlug.ConnectAnAgent, title: 'Connect an agent', path: '/connect-an-agent' },
  { slug: DocsPageSlug.McpTools, title: 'MCP tools', path: '/mcp-tools' },
  { slug: DocsPageSlug.SelfHost, title: 'Self-host todz', path: '/self-host' },
];

export type ToolParameter = { name: string; text: string };

export const TOOL_PARAMETERS: Record<McpToolName, ToolParameter[]> = {
  [McpToolName.Next]: [],
  [McpToolName.Add]: [
    { name: 'title', text: MCP_COPY.fields.title },
    { name: 'notes', text: MCP_COPY.fields.notes },
    { name: 'due_date', text: MCP_COPY.fields.dueDate },
    { name: 'idempotency_key', text: MCP_COPY.fields.idempotencyKey },
  ],
  [McpToolName.List]: [
    { name: 'state', text: MCP_COPY.fields.state },
    { name: 'due', text: MCP_COPY.fields.due },
    { name: 'text', text: MCP_COPY.fields.text },
    { name: 'limit', text: MCP_COPY.fields.limit },
  ],
  [McpToolName.Update]: [
    { name: 'id', text: MCP_COPY.fields.id },
    { name: 'title', text: MCP_COPY.fields.title },
    { name: 'notes', text: MCP_COPY.fields.notes },
    { name: 'due_date', text: MCP_COPY.fields.dueDate },
    { name: 'placement', text: MCP_COPY.fields.placement },
  ],
  [McpToolName.Done]: [
    { name: 'ids', text: MCP_COPY.fields.ids },
    { name: 'note', text: MCP_COPY.fields.note },
  ],
};

export const DISCOVERY_COPY = {
  summary:
    'todz is a native Mac to-do list that people and their AI agents share: Claude Code, Codex and Cursor read, add and finish tasks over MCP.',
  status: 'todz is out for macOS 14 or later: the app is not yet notarized by Apple.',
  pricing: 'Downloading todz is free. Pricing has not been announced.',
  publisher: `todz is a product of ${COMPANY.tradeName}, made in Brazil.`,
  source: `todz is open source under the ${REPOSITORY.licenseName} license: ${REPOSITORY.url}`,
  connect: {
    heading: 'Connect an agent',
    lead: 'Add the server to Claude Code with this command. The key comes from Connect an Agent in the app: one key per project.',
    setupsLink: 'Codex and Cursor setups',
  },
  tools: { heading: 'MCP tools', parametersHeading: 'MCP tool parameters' },
  docs: { heading: 'Docs' },
  optional: {
    heading: 'Optional',
    fullLink: 'llms-full.txt',
    fullNote: 'This file with the Codex and Cursor setups and every tool parameter.',
  },
  setups: { codex: 'Codex', cursor: 'Cursor' },
  card: { description: 'A to-do list that AI agents and its owner share, over MCP.' },
  representativeQueries: ['Add a task to my todz project', 'What is the next task in my todz project?', 'Mark a task as done in todz'],
};
