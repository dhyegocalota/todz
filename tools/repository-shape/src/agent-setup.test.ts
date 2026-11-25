import { describe, expect, test } from 'vitest';
import { AgentClient, agentSetupOf } from '../../../apps/api/src/site/agent-setup';
import { LANDING_COPY } from '../../../apps/api/src/site/landing-copy';
import { MCP_URL } from '../../../apps/api/src/site/site-urls';
import { readRepositoryFile } from './repository-files';

const AGENT_COMMAND = 'apps/macos/TodzKit/Sources/TodzKit/AgentCommand.swift';
const KEY_PLACEHOLDER = '<key>';
const SWIFT_CONSTANT_PATTERN = /private let (\w+) = "([^"]*)"/g;
const CLAUDE_CODE_PATTERN = /return \.claudeCode\(line: "([^"]*)"\)/;
const SHELL_LINE_PATTERN = /shellLine: "([^"]*)"/;
const CODEX_TEMPLATE_PATTERN = /private func codexConfiguration[^{]*\{\s*"""\n([\s\S]*?)\n\s*"""/;
const CURSOR_TEMPLATE_PATTERN = /private func cursorJSON[^{]*\{\s*"""\n([\s\S]*?)\n\s*"""/;
const INTERPOLATION_PATTERN = /\\\((\w+)\)/g;
const TEMPLATE_INDENT_PATTERN = /^ {4}/gm;
const SERVER_INTERPOLATION = 'server';
const KEY_INTERPOLATION = 'key';
const FIRST_CAPTURE = 1;
const SECOND_CAPTURE = 2;

const swiftSource = readRepositoryFile(AGENT_COMMAND);

function swiftConstants(): Record<string, string> {
  return Object.fromEntries(
    [...swiftSource.matchAll(SWIFT_CONSTANT_PATTERN)].map((match) => [match[FIRST_CAPTURE], match[SECOND_CAPTURE]]),
  );
}

function swiftTemplate(pattern: RegExp): string {
  const template = pattern.exec(swiftSource)?.[FIRST_CAPTURE];
  if (template === undefined) throw new Error(`AgentCommand.swift holds no template for ${pattern}`);
  return template;
}

function interpolated(template: string): string {
  const values: Record<string, string> = { ...swiftConstants(), [SERVER_INTERPOLATION]: MCP_URL, [KEY_INTERPOLATION]: KEY_PLACEHOLDER };
  return template.replace(INTERPOLATION_PATTERN, (_match, name: string) => {
    const value = values[name];
    if (value === undefined) throw new Error(`AgentCommand.swift interpolates ${name}, which the test cannot fill`);
    return value;
  });
}

function swiftSetupOf(client: AgentClient): string {
  if (client === AgentClient.ClaudeCode) return interpolated(swiftTemplate(CLAUDE_CODE_PATTERN));
  if (client === AgentClient.Codex) {
    const configuration = interpolated(swiftTemplate(CODEX_TEMPLATE_PATTERN).replace(TEMPLATE_INDENT_PATTERN, ''));
    return `${configuration}\n${interpolated(swiftTemplate(SHELL_LINE_PATTERN))}`;
  }
  return interpolated(swiftTemplate(CURSOR_TEMPLATE_PATTERN).replace(TEMPLATE_INDENT_PATTERN, ''));
}

describe('the agent setup the landing shows', () => {
  test.each(Object.values(AgentClient))('%s is what AgentCommand.swift produces for the same server and key', (client) => {
    expect(agentSetupOf({ client, serverUrl: MCP_URL, key: KEY_PLACEHOLDER })).toBe(swiftSetupOf(client));
  });

  test('the Swift templates were found, so the comparison is not vacuous', () => {
    expect(swiftSetupOf(AgentClient.ClaudeCode)).toContain('claude mcp add --transport http todz');
    expect(swiftSetupOf(AgentClient.Codex)).toContain('[mcp_servers.todz]');
    expect(swiftSetupOf(AgentClient.Cursor)).toContain('"mcpServers"');
  });

  test('the terminal on the landing shows the Claude Code line (pin)', () => {
    expect(LANDING_COPY.terminal.command).toBe(swiftSetupOf(AgentClient.ClaudeCode));
  });
});
