import { COMPANY, REPOSITORY } from '@todz/types';
import { MCP_COPY, McpToolName } from '../mcp-copy';
import { DOCS_MCP_URL, DOWNLOAD_URL } from './site-urls';

export enum DocsPageSlug {
  Introduction = 'introduction',
  Quickstart = 'quickstart',
  InstallOnMac = 'install-on-mac',
  ConnectAnAgent = 'connect-an-agent',
  McpTools = 'mcp-tools',
  SelfHost = 'self-host',
  Privacy = 'privacy',
}

export type DocsPage = { slug: DocsPageSlug; title: string; path: string };

export const DOCS_PAGES: DocsPage[] = [
  { slug: DocsPageSlug.Introduction, title: 'Introduction', path: '/' },
  { slug: DocsPageSlug.Quickstart, title: 'Quickstart', path: '/quickstart' },
  { slug: DocsPageSlug.InstallOnMac, title: 'Install on Mac', path: '/install-on-mac' },
  { slug: DocsPageSlug.ConnectAnAgent, title: 'Connect an agent', path: '/connect-an-agent' },
  { slug: DocsPageSlug.McpTools, title: 'MCP tools', path: '/mcp-tools' },
  { slug: DocsPageSlug.SelfHost, title: 'Self-host todz', path: '/self-host' },
  { slug: DocsPageSlug.Privacy, title: 'Privacy', path: '/privacy' },
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
  [McpToolName.Show]: [{ name: 'id', text: MCP_COPY.fields.id }],
  [McpToolName.History]: [{ name: 'id', text: MCP_COPY.fields.id }],
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
  [McpToolName.Reopen]: [{ name: 'ids', text: MCP_COPY.fields.ids }],
  [McpToolName.Delete]: [
    { name: 'id', text: MCP_COPY.fields.id },
    { name: 'confirm', text: MCP_COPY.fields.confirm },
  ],
  [McpToolName.Move]: [
    { name: 'id', text: MCP_COPY.fields.id },
    { name: 'project', text: MCP_COPY.fields.project },
  ],
  [McpToolName.Projects]: [],
};

export const DISCOVERY_COPY = {
  summary:
    'todz is a native Mac to-do list that people and their AI agents share: Claude Code, Codex and Cursor read, add and finish tasks over MCP.',
  status: 'todz is out for macOS 14 or later: the app is not yet notarized by Apple.',
  download: `Download todz for Mac at ${DOWNLOAD_URL}. The app updates itself.`,
  pricing: 'todz is free on todz cloud, or self-host. Free todz cloud spots are extremely limited; self-hosting is always open.',
  publisher: `todz is a product of ${COMPANY.tradeName}, made in Brazil.`,
  source: `todz is open source under the ${REPOSITORY.licenseName} license: ${REPOSITORY.url}`,
  connect: {
    heading: 'Connect an agent',
    lead: 'Add the server to Claude Code with this command. The key comes from Connect an Agent in the app: one key per project.',
    setupsLink: 'Codex and Cursor setups',
  },
  tools: { heading: 'MCP tools', parametersHeading: 'MCP tool parameters' },
  selfHost: {
    heading: 'Self-host',
    linkText: 'Server setup',
    note: 'run your own todz server on Cloudflare, then paste its URL in todz › Settings › Server.',
  },
  docs: { heading: 'Docs' },
  docsMcp: {
    heading: 'Docs MCP',
    lead: 'Add the docs server to Claude Code to let your agent search the todz docs.',
    command: `claude mcp add --transport http todz-docs ${DOCS_MCP_URL}`,
  },
  optional: {
    heading: 'Optional',
    fullLink: 'llms-full.txt',
    fullNote: 'This file with the Codex and Cursor setups and every tool parameter.',
  },
  setups: { codex: 'Codex', cursor: 'Cursor' },
  card: { description: 'A to-do list that AI agents and its owner share, over MCP.' },
  representativeQueries: ['Add a task to my todz project', 'What is the next task in my todz project?', 'Mark a task as done in todz'],
};
