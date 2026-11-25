import { describe, expect, test } from 'vitest';
import { capturedNames, readRepositoryFile, repositoryFiles } from './repository-files';
import { swiftCopyValue } from './swift-copy';

const DOCS_DIRECTORY = 'apps/docs';
const PAGE_EXTENSION = '.mdx';
const AGENT_COMMAND = 'apps/macos/TodzKit/Sources/TodzKit/AgentCommand.swift';
const WRANGLER_CONFIGURATION = 'apps/api/wrangler.jsonc';
const KEY_SCREEN_COPY = 'apps/macos/Copy/KeyScreenCopy.swift';
const SIGN_IN_COPY = 'apps/macos/Copy/SignInCopy.swift';
const SETTINGS_COPY = 'apps/macos/Copy/SettingsCopy.swift';
const KEY_PLACEHOLDER = '<key>';
const PUBLIC_ORIGIN_PATTERN = /"PUBLIC_ORIGIN": "([^"]+)"/;
const CONSTANT_PATTERN = /^private let (\w+) = "([^"]*)"$/gm;
const INTERPOLATION_PATTERN = /\\\((\w+)\)/g;
const SWIFT_STRING = '((?:[^"\\\\]|\\\\.)*)';
const CLAUDE_CODE_LINE_PATTERN = new RegExp(`\\.claudeCode\\(line: "${SWIFT_STRING}"\\)`);
const SHELL_LINE_PATTERN = new RegExp(`shellLine: "${SWIFT_STRING}"`);
const FENCE_BODY_PATTERN = /```[^\n]*\n([\s\S]*?)\n```/g;
const BOLD_PATTERN = /\*\*([^*\n]+)\*\*/g;
const GUIDE_LINK_PATTERN = /\]\(\/self-host#([\w-]+)\)/g;
const GUIDE_HEADING_PATTERN = /^## (.+)$/gm;
const INDENTATION_PATTERN = /^ {4}/;
const LINE_SEPARATOR = '\n';
const FIRST_CAPTURE = 1;
const CONNECT_PAGE = 'connect-an-agent';
const QUICKSTART_PAGE = 'quickstart';
const GUIDE_PAGE = 'self-host';

function pageText(name: string): string {
  return readRepositoryFile(`${DOCS_DIRECTORY}/${name}${PAGE_EXTENSION}`);
}

function singleCapture({ text, pattern }: { text: string; pattern: RegExp }): string {
  const match = pattern.exec(text);
  expect(match).not.toBeNull();
  return match![FIRST_CAPTURE]!;
}

function swiftConstants(text: string): Record<string, string> {
  return Object.fromEntries([...text.matchAll(CONSTANT_PATTERN)].map((match) => [match[1]!, match[2]!]));
}

function filled({ template, values }: { template: string; values: Record<string, string> }): string {
  return template.replace(INTERPOLATION_PATTERN, (_, name: string) => {
    const value = values[name];
    if (value === undefined) throw new Error(`${name} has no value in the agent command`);
    return value;
  });
}

function tripleQuoted({ text, name }: { text: string; name: string }): string {
  const body = singleCapture({
    text,
    pattern: new RegExp(`private func ${name}\\([^)]*\\) -> String \\{\\n\\s+"""\\n([\\s\\S]*?)\\n\\s+"""`),
  });
  return body
    .split(LINE_SEPARATOR)
    .map((line) => line.replace(INDENTATION_PATTERN, ''))
    .join(LINE_SEPARATOR);
}

function agentCommands(): string[] {
  const swift = readRepositoryFile(AGENT_COMMAND);
  const constants = swiftConstants(swift);
  const publicOrigin = singleCapture({ text: readRepositoryFile(WRANGLER_CONFIGURATION), pattern: PUBLIC_ORIGIN_PATTERN });
  const { serverPath } = constants;
  expect(serverPath).toBeDefined();
  const values = { ...constants, server: `${publicOrigin}/${serverPath}`, key: KEY_PLACEHOLDER };
  return [
    singleCapture({ text: swift, pattern: CLAUDE_CODE_LINE_PATTERN }),
    tripleQuoted({ text: swift, name: 'codexConfiguration' }),
    singleCapture({ text: swift, pattern: SHELL_LINE_PATTERN }),
    tripleQuoted({ text: swift, name: 'cursorJSON' }),
  ].map((template) => filled({ template, values }));
}

function appLabel({ file, name }: { file: string; name: string }): string {
  return swiftCopyValue({ text: readRepositoryFile(file), name });
}

function pageNames(): string[] {
  return repositoryFiles(DOCS_DIRECTORY)
    .filter((path) => path.endsWith(PAGE_EXTENSION))
    .map((path) => path.slice(DOCS_DIRECTORY.length + 1, -PAGE_EXTENSION.length));
}

function headingSlug(heading: string): string {
  return heading
    .toLowerCase()
    .replace(/[^a-z0-9 -]/g, '')
    .replace(/ /g, '-');
}

describe('the connect-an-agent page', () => {
  test('holds the three commands of the key screen and nothing else in code blocks, with the cloud MCP URL and a key placeholder', () => {
    const blocks = capturedNames({ text: pageText(CONNECT_PAGE), pattern: FENCE_BODY_PATTERN });
    expect(blocks).toEqual(agentCommands());
  });
});

describe('the labels the pages name', () => {
  const expectedLabels = [
    { page: CONNECT_PAGE, label: () => appLabel({ file: KEY_SCREEN_COPY, name: 'title' }) },
    { page: QUICKSTART_PAGE, label: () => appLabel({ file: SIGN_IN_COPY, name: 'sendLink' }) },
    { page: QUICKSTART_PAGE, label: () => appLabel({ file: SETTINGS_COPY, name: 'server' }) },
    { page: QUICKSTART_PAGE, label: () => appLabel({ file: SETTINGS_COPY, name: 'useTodzCloud' }) },
  ];

  test.each(expectedLabels)('$page names a label of the app in bold', ({ page, label }) => {
    expect(pageText(page)).toContain(`**${label()}**`);
  });

  test('no page names one of them in another casing', () => {
    const labels = expectedLabels.map(({ label }) => label());
    const bolds = pageNames().flatMap((name) => capturedNames({ text: pageText(name), pattern: BOLD_PATTERN }));
    const lowered = labels.map((label) => label.toLowerCase());
    expect(bolds.filter((bold) => lowered.includes(bold.toLowerCase()) && !labels.includes(bold))).toEqual([]);
  });
});

describe('the quickstart', () => {
  test('links the build step of the self-host guide by a heading that exists', () => {
    const anchors = capturedNames({ text: pageText(QUICKSTART_PAGE), pattern: GUIDE_LINK_PATTERN });
    const slugs = capturedNames({ text: pageText(GUIDE_PAGE), pattern: GUIDE_HEADING_PATTERN }).map(headingSlug);
    expect(anchors.length).toBeGreaterThan(0);
    expect(anchors.filter((anchor) => !slugs.includes(anchor))).toEqual([]);
  });
});
