import { describe, expect, test } from 'vitest';
import { bodyOf } from './front-matter';
import { capturedNames, readRepositoryFile } from './repository-files';

const REFERENCE_PAGE = 'apps/docs/mcp-tools.mdx';
const COPY_SOURCE = 'apps/api/src/mcp-copy.ts';
const ARGUMENTS_SOURCE = 'apps/api/src/mcp-tool-arguments.ts';
const PROMPTS_HEADING = 'Prompts';
const TOOL_ENUM_PATTERN = /export enum McpToolName \{([\s\S]*?)\}/;
const PROMPT_ENUM_PATTERN = /export enum McpPromptName \{([\s\S]*?)\}/;
const ENUM_MEMBER_PATTERN = /(\w+) = '(\w+)'/g;
const SECTION_SEPARATOR = '\n## ';
const LINE_SEPARATOR = '\n';
const FIRST_CAPTURE = 1;
const SECOND_CAPTURE = 2;
const TABLE_NAME_PATTERN = /^\| `(\w+)` \|/gm;
const SCHEMA_KEY_PATTERN = /\b(\w+): z\./g;
const PLACEMENT_SCHEMA_NAME = 'Placement';
const SCHEMA_END_MARKERS = ['\n});', '\n]);'];
const SCHEMA_TOOLS = ['add', 'list', 'update', 'done'];

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
      const line = new RegExp(`\\[Mcp\\w+Name\\.${member}\\]: (['"])(.*?)\\1`).exec(block);
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

function schemaKeys(schema: string): string[] {
  const source = readRepositoryFile(ARGUMENTS_SOURCE);
  const start = source.indexOf(`const ${schema}Schema`);
  const end = Math.min(...SCHEMA_END_MARKERS.map((marker) => source.indexOf(marker, start)).filter((index) => index > start));
  return capturedNames({ text: source.slice(start, end), pattern: SCHEMA_KEY_PATTERN });
}

function expectedKeys(tool: string): string[] {
  const name = `${tool.charAt(0).toUpperCase()}${tool.slice(1)}Arguments`;
  const keys = tool === 'update' ? [...schemaKeys(name), ...schemaKeys(PLACEMENT_SCHEMA_NAME)] : schemaKeys(name);
  return [...new Set(keys)];
}

const toolMembers = enumMembers({ source: readRepositoryFile(COPY_SOURCE), pattern: TOOL_ENUM_PATTERN });
const promptMembers = enumMembers({ source: readRepositoryFile(COPY_SOURCE), pattern: PROMPT_ENUM_PATTERN });

describe('the MCP tools reference', () => {
  test('has one section per tool, in the order of the enum, then the prompts', () => {
    expect(sections().map(({ heading }) => heading)).toEqual([...toolMembers.map(({ value }) => value), PROMPTS_HEADING]);
  });

  test.each(toolMembers.map(({ value }) => value))('the %s section holds the tool description of the Worker, verbatim', (tool) => {
    const description = copyLines({ group: 'tools', members: toolMembers })[tool];
    const section = sections().find(({ heading }) => heading === tool);
    expect(section?.body.split(LINE_SEPARATOR)).toContain(description);
  });

  test.each(SCHEMA_TOOLS)('the %s section tabulates exactly the arguments of its schema', (tool) => {
    const section = sections().find(({ heading }) => heading === tool);
    expect(section).toBeDefined();
    expect(capturedNames({ text: section!.body, pattern: TABLE_NAME_PATTERN }).sort()).toEqual(expectedKeys(tool).sort());
  });

  test('the next section tabulates no argument', () => {
    const section = sections().find(({ heading }) => heading === 'next');
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
