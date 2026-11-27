import { describe, expect, test } from 'vitest';
import { APP_ACTIONS, ParityScope } from './mcp-parity-actions';
import { readRepositoryFile } from './repository-files';

const COPY_SOURCE = 'apps/api/src/mcp-copy.ts';
const ROUTES_SOURCE = 'apps/api/src/owner-routes.ts';
const TOOL_ENUM_PATTERN = /export enum McpToolName \{([\s\S]*?)\}/;
const OWNER_TOOL_ENUM_PATTERN = /export enum McpOwnerToolName \{([\s\S]*?)\}/;
const ROUTE_ENUM_PATTERN = /export enum OwnerRoute \{([\s\S]*?)\}/;
const ENUM_VALUE_PATTERN = /\w+ = '(\w+)'/g;
const FIRST_CAPTURE = 1;
const DEFERRED_ACTIONS: string[] = [];

function enumValues({ path, pattern }: { path: string; pattern: RegExp }): string[] {
  const body = pattern.exec(readRepositoryFile(path))?.[FIRST_CAPTURE];
  expect(body).toBeDefined();
  return [...body!.matchAll(ENUM_VALUE_PATTERN)].map((match) => match[FIRST_CAPTURE]!);
}

const projectTools = enumValues({ path: COPY_SOURCE, pattern: TOOL_ENUM_PATTERN });
const ownerTools = enumValues({ path: COPY_SOURCE, pattern: OWNER_TOOL_ENUM_PATTERN });
const ownerRoutes = enumValues({ path: ROUTES_SOURCE, pattern: ROUTE_ENUM_PATTERN });
const toolOfScope: Record<string, string[]> = { [ParityScope.Project]: projectTools, [ParityScope.Owner]: ownerTools };

describe('every app action is reachable over MCP or says why not', () => {
  test('every owner API route of the app has exactly one row, and every row names a real route', () => {
    const rowRoutes = APP_ACTIONS.flatMap(({ ownerRoute }) => (ownerRoute === null ? [] : [ownerRoute]));
    expect([...rowRoutes].sort()).toEqual([...ownerRoutes].sort());
  });

  test('a row with a tool names a tool of the server registry, of its scope', () => {
    const withTool = APP_ACTIONS.filter(({ tool }) => tool !== null);
    expect(withTool.length).toBeGreaterThan(0);
    withTool.forEach(({ action, tool, scope }) => {
      expect(toolOfScope[scope], `${action} names a scope with tools`).toBeDefined();
      expect(toolOfScope[scope], `${action} names ${tool}`).toContain(tool);
    });
  });

  test('every tool of the registry is the answer to at least one app action, and no tool is shared across scopes', () => {
    const claimed = APP_ACTIONS.flatMap(({ tool }) => (tool === null ? [] : [tool]));
    expect([...new Set(claimed)].sort()).toEqual([...projectTools, ...ownerTools].sort());
    expect(projectTools.filter((tool) => ownerTools.includes(tool))).toEqual([]);
  });

  test('a row without a tool says why in a sentence and is never scoped to a tool set', () => {
    const scopedToTools = [ParityScope.Project, ParityScope.Owner];
    APP_ACTIONS.filter(({ tool }) => tool === null).forEach(({ action, scope, reason }) => {
      expect(scopedToTools, `${action} has no tool`).not.toContain(scope);
      expect(reason, `${action} states its reason`).toMatch(/\w+ \w+ \w+/);
    });
  });

  test('the actions still deferred are the ones named here: a new deferral is a decision, not a drift', () => {
    expect(APP_ACTIONS.filter(({ scope }) => scope === ParityScope.Deferred).map(({ action }) => action)).toEqual(DEFERRED_ACTIONS);
  });

  test('an action is listed once', () => {
    const actions = APP_ACTIONS.map(({ action }) => action);
    expect(new Set(actions).size).toBe(actions.length);
  });
});
