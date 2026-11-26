import { describe, expect, test } from 'vitest';
import { bodyOf } from './front-matter';
import { capturedNames, readRepositoryFile } from './repository-files';

const REFERENCE_PAGE = 'apps/docs/mcp-tools.mdx';
const COPY_SOURCE = 'apps/api/src/mcp-copy.ts';
const ARGUMENTS_SOURCE = 'apps/api/src/mcp-tool-arguments.ts';
const OWNER_ARGUMENTS_SOURCE = 'apps/api/src/mcp-owner-arguments.ts';
const TASK_SOURCE = 'libs/types/src/task.ts';
const TASK_STATE_PATTERN = /export enum TaskState \{([\s\S]*?)\}/;
const DUE_WINDOW_PATTERN = /export enum DueWindow \{([\s\S]*?)\}/;
const STATE_DEFAULT_PATTERN = /state: z\.enum\(TaskState\)\.default\(TaskState\.(\w+)\)/;
const PROMPTS_HEADING = 'Prompts';
const TOOL_ENUM_PATTERN = /export enum McpToolName \{([\s\S]*?)\}/;
const OWNER_TOOL_ENUM_PATTERN = /export enum McpOwnerToolName \{([\s\S]*?)\}/;
const PROMPT_ENUM_PATTERN = /export enum McpPromptName \{([\s\S]*?)\}/;
const ENUM_MEMBER_PATTERN = /(\w+) = '(\w+)'/g;
const SECTION_SEPARATOR = '\n## ';
const LINE_SEPARATOR = '\n';
const FIRST_CAPTURE = 1;
const SECOND_CAPTURE = 2;
const TABLE_NAME_PATTERN = /^\| `(\w+)`\s*\|/gm;
const SCHEMA_KEY_PATTERN = /\b(\w+): (?:z|\w+Schema)\./g;
const PLACEMENT_SCHEMA_NAME = 'Placement';
const SCHEMA_END_MARKERS = ['});', '\n]);'];
const SCHEMA_TOOLS = ['add', 'list', 'show', 'history', 'update', 'done', 'reopen', 'delete', 'move'];
const ARGUMENTLESS_TOOLS = ['next', 'projects', 'workspaces'];
const PROJECT_SCOPE_LINE = '**Scope:** project key.';
const OWNER_SCOPE_LINE = '**Scope:** owner key.';
const OWNER_SCHEMA_OF_TOOL: Record<string, string> = {
  create_workspace: 'Name',
  rename_workspace: 'RenameWorkspace',
  delete_workspace: 'DeleteWorkspace',
  create_project: 'CreateProject',
  rename_project: 'RenameProject',
  delete_project: 'DeleteProject',
};

type Section = { heading: string; body: string };

function pageBody(): string {
  return bodyOf(readRepositoryFile(REFERENCE_PAGE));
}

function enumMembers({ source, pattern }: { source: string; pattern: RegExp }): { member: string; value: string }[] {
  const body = pattern.exec(source)?.[FIRST_CAPTURE];
  expect(body).toBeDefined();
  return [...body!.matchAll(ENUM_MEMBER_PATTERN)].map((match) => ({ member: match[FIRST_CAPTURE]!, value: match[SECOND_CAPTURE]! }));
}

function copyLines({ group, members }: { group: string; members: { member: string; value: string }[] }): Record<string, string> {
  const copy = readRepositoryFile(COPY_SOURCE);
  const start = copy.indexOf(`${group}: {`);
  const block = copy.slice(start, copy.indexOf('}', start));
  return Object.fromEntries(
    members.map(({ member, value }) => {
      const line = new RegExp(`\\[Mcp\\w+Name\\.${member}\\]:\\s+(['"])(.*?)\\1`).exec(block);
      expect(line).not.toBeNull();
      return [value, line![SECOND_CAPTURE]!];
    }),
  );
}

function sections(): Section[] {
  return `${LINE_SEPARATOR}${pageBody()}`
    .split(SECTION_SEPARATOR)
    .slice(FIRST_CAPTURE)
    .map((text) => ({ heading: text.split(LINE_SEPARATOR)[0]!, body: text.slice(text.indexOf(LINE_SEPARATOR)) }));
}

function singleCapture({ text, pattern }: { text: string; pattern: RegExp }): string {
  const match = pattern.exec(text);
  expect(match).not.toBeNull();
  return match![FIRST_CAPTURE]!;
}

function argumentRow({ tool, argument }: { tool: string; argument: string }): string {
  const row = sections()
    .find(({ heading }) => heading === tool)
    ?.body.split(LINE_SEPARATOR)
    .find((line) => line.startsWith(`| \`${argument}\``));
  expect(row).toBeDefined();
  return row!;
}

function schemaKeys({ schema, sourcePath = ARGUMENTS_SOURCE }: { schema: string; sourcePath?: string }): string[] {
  const source = readRepositoryFile(sourcePath);
  const start = source.indexOf(`const ${schema}Schema`);
  const end = Math.min(...SCHEMA_END_MARKERS.map((marker) => source.indexOf(marker, start)).filter((index) => index > start));
  return capturedNames({ text: source.slice(start, end), pattern: SCHEMA_KEY_PATTERN });
}

function expectedKeys(tool: string): string[] {
  const name = `${tool.charAt(0).toUpperCase()}${tool.slice(1)}Arguments`;
  const keys =
    tool === 'update' ? [...schemaKeys({ schema: name }), ...schemaKeys({ schema: PLACEMENT_SCHEMA_NAME })] : schemaKeys({ schema: name });
  return [...new Set(keys)];
}

function expectedOwnerKeys(tool: string): string[] {
  return schemaKeys({ schema: `${OWNER_SCHEMA_OF_TOOL[tool]}Arguments`, sourcePath: OWNER_ARGUMENTS_SOURCE });
}

const toolMembers = enumMembers({ source: readRepositoryFile(COPY_SOURCE), pattern: TOOL_ENUM_PATTERN });
const ownerToolMembers = enumMembers({ source: readRepositoryFile(COPY_SOURCE), pattern: OWNER_TOOL_ENUM_PATTERN });
const promptMembers = enumMembers({ source: readRepositoryFile(COPY_SOURCE), pattern: PROMPT_ENUM_PATTERN });

describe('the MCP tools reference', () => {
  test('has one section per project tool, then one per owner tool, in the order of the enums, then the prompts', () => {
    const tools = [...toolMembers, ...ownerToolMembers].map(({ value }) => value);
    expect(sections().map(({ heading }) => heading)).toEqual([...tools, PROMPTS_HEADING]);
  });

  test.each(toolMembers.map(({ value }) => value))('the %s section holds the tool description of the Worker, verbatim', (tool) => {
    const description = copyLines({ group: 'tools', members: toolMembers })[tool];
    const section = sections().find(({ heading }) => heading === tool);
    expect(section?.body.split(LINE_SEPARATOR)).toContain(description);
  });

  test.each(ownerToolMembers.map(({ value }) => value))('the owner tool %s section holds its description, verbatim', (tool) => {
    const description = copyLines({ group: 'ownerTools', members: ownerToolMembers })[tool];
    const section = sections().find(({ heading }) => heading === tool);
    expect(section?.body.split(LINE_SEPARATOR)).toContain(description);
  });

  test.each(toolMembers.map(({ value }) => value))('the %s section names the project key as its scope', (tool) => {
    const section = sections().find(({ heading }) => heading === tool);
    expect(section?.body.split(LINE_SEPARATOR)).toContain(PROJECT_SCOPE_LINE);
    expect(section?.body.split(LINE_SEPARATOR)).not.toContain(OWNER_SCOPE_LINE);
  });

  test.each(ownerToolMembers.map(({ value }) => value))('the %s section names the owner key as its scope', (tool) => {
    const section = sections().find(({ heading }) => heading === tool);
    expect(section?.body.split(LINE_SEPARATOR)).toContain(OWNER_SCOPE_LINE);
    expect(section?.body.split(LINE_SEPARATOR)).not.toContain(PROJECT_SCOPE_LINE);
  });

  test.each(Object.keys(OWNER_SCHEMA_OF_TOOL))('the %s section tabulates exactly the arguments of its owner schema', (tool) => {
    const section = sections().find(({ heading }) => heading === tool);
    expect(section).toBeDefined();
    expect(capturedNames({ text: section!.body, pattern: TABLE_NAME_PATTERN }).sort()).toEqual(expectedOwnerKeys(tool).sort());
  });

  test.each(SCHEMA_TOOLS)('the %s section tabulates exactly the arguments of its schema', (tool) => {
    const section = sections().find(({ heading }) => heading === tool);
    expect(section).toBeDefined();
    expect(capturedNames({ text: section!.body, pattern: TABLE_NAME_PATTERN }).sort()).toEqual(expectedKeys(tool).sort());
  });

  test('the list state row names every task state and the default of its schema', () => {
    const row = argumentRow({ tool: 'list', argument: 'state' });
    const states = enumMembers({ source: readRepositoryFile(TASK_SOURCE), pattern: TASK_STATE_PATTERN });
    const defaultMember = singleCapture({ text: readRepositoryFile(ARGUMENTS_SOURCE), pattern: STATE_DEFAULT_PATTERN });
    const defaultValue = states.find(({ member }) => member === defaultMember)?.value;
    expect(defaultValue).toBeDefined();
    expect(states.filter(({ value }) => !row.includes(`\`${value}\``))).toEqual([]);
    expect(row).toContain(`Defaults to \`${defaultValue}\``);
  });

  test('the list due row names every due window', () => {
    const row = argumentRow({ tool: 'list', argument: 'due' });
    const windows = enumMembers({ source: readRepositoryFile(TASK_SOURCE), pattern: DUE_WINDOW_PATTERN });
    expect(windows.filter(({ value }) => !row.includes(`\`${value}\``))).toEqual([]);
  });

  test.each(ARGUMENTLESS_TOOLS)('the %s section tabulates no argument', (tool) => {
    const section = sections().find(({ heading }) => heading === tool);
    expect(capturedNames({ text: section!.body, pattern: TABLE_NAME_PATTERN })).toEqual([]);
  });

  test('the prompts section names each prompt with its description, verbatim', () => {
    const section = sections().find(({ heading }) => heading === PROMPTS_HEADING);
    const descriptions = copyLines({ group: 'prompts', members: promptMembers });
    expect(section).toBeDefined();
    expect(promptMembers.filter(({ value }) => !section!.body.includes(`\`${value}\``))).toEqual([]);
    expect(
      Object.values(descriptions).filter((description) => !section!.body.split(LINE_SEPARATOR).some((line) => line.includes(description))),
    ).toEqual([]);
  });
});
