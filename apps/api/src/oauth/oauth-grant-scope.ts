import { z } from 'zod';
import { parsedJson } from '../parsed-json';

export enum GrantScopeKind {
  Account = 'account',
  Workspace = 'workspace',
  Project = 'project',
}

export enum GrantShape {
  Owner = 'owner',
  Project = 'project',
  Selection = 'selection',
}

export const WORKSPACE_PROJECT_SEPARATOR = ' › ';

export type WorkspaceScope = { kind: GrantScopeKind.Workspace; workspaceId: string };

export type ProjectScope = { kind: GrantScopeKind.Project; projectId: string };

export type SelectionScope = WorkspaceScope | ProjectScope;

export type GrantScope = { kind: GrantScopeKind.Account } | SelectionScope;

export type GrantAccess =
  | { shape: GrantShape.Owner }
  | { shape: GrantShape.Project; projectId: string }
  | { shape: GrantShape.Selection; scopes: SelectionScope[] };

type ScopeJson = { kind: GrantScopeKind; workspace_id?: string; project_id?: string };

const ScopeJsonSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal(GrantScopeKind.Account) }),
  z.object({ kind: z.literal(GrantScopeKind.Workspace), workspace_id: z.string().min(1) }),
  z.object({ kind: z.literal(GrantScopeKind.Project), project_id: z.string().min(1) }),
]);

function scopeOfJson(json: z.output<typeof ScopeJsonSchema>): GrantScope {
  if (json.kind === GrantScopeKind.Workspace) return { kind: json.kind, workspaceId: json.workspace_id };
  if (json.kind === GrantScopeKind.Project) return { kind: json.kind, projectId: json.project_id };
  return { kind: json.kind };
}

function jsonOfScope(scope: GrantScope): ScopeJson {
  if (scope.kind === GrantScopeKind.Workspace) return { kind: scope.kind, workspace_id: scope.workspaceId };
  if (scope.kind === GrantScopeKind.Project) return { kind: scope.kind, project_id: scope.projectId };
  return { kind: scope.kind };
}

export function isSelectionScope(scope: GrantScope): scope is SelectionScope {
  return scope.kind !== GrantScopeKind.Account;
}

export function isWorkspaceScope(scope: GrantScope): scope is WorkspaceScope {
  return scope.kind === GrantScopeKind.Workspace;
}

export function isProjectScope(scope: GrantScope): scope is ProjectScope {
  return scope.kind === GrantScopeKind.Project;
}

function isAccountAlone(scopes: GrantScope[]): boolean {
  const hasAccount = scopes.some((scope) => !isSelectionScope(scope));
  return !hasAccount || scopes.length === 1;
}

export const GrantScopesSchema = z
  .array(ScopeJsonSchema)
  .min(1)
  .transform((entries) => entries.map(scopeOfJson))
  .refine(isAccountAlone);

export function scopesJsonOf(scopes: GrantScope[]): string {
  return JSON.stringify(scopes.map(jsonOfScope));
}

export function scopesOfJson(text: string): GrantScope[] {
  const scopes = GrantScopesSchema.safeParse(parsedJson(text));
  if (!scopes.success) throw new Error('a stored grant has unreadable scopes');
  return scopes.data;
}

export function isSingleProject(scopes: GrantScope[]): boolean {
  const [only] = scopes;
  return scopes.length === 1 && only?.kind === GrantScopeKind.Project;
}

export function isAccountScopes(scopes: GrantScope[]): boolean {
  return scopes.some((scope) => !isSelectionScope(scope));
}

// NB ADR 0126: only a grant chosen as one project reaches the other projects of its workspace; a selection narrowed or cut down to one project stays a selection.
export function grantAccessOf({ scopes, reachesWorkspace }: { scopes: GrantScope[]; reachesWorkspace: boolean }): GrantAccess {
  if (isAccountScopes(scopes)) return { shape: GrantShape.Owner };
  const selection = scopes.filter(isSelectionScope);
  const [only] = selection;
  const isWorkspaceProject = reachesWorkspace && only?.kind === GrantScopeKind.Project && selection.length === 1;
  if (isWorkspaceProject) return { shape: GrantShape.Project, projectId: only.projectId };
  return { shape: GrantShape.Selection, scopes: selection };
}

export function isProjectCovered({
  scopes,
  projectId,
  workspaceId,
}: {
  scopes: GrantScope[];
  projectId: string;
  workspaceId: string;
}): boolean {
  return scopes.some((scope) => {
    if (scope.kind === GrantScopeKind.Workspace) return scope.workspaceId === workspaceId;
    if (scope.kind === GrantScopeKind.Project) return scope.projectId === projectId;
    return true;
  });
}

export function isWorkspaceCovered({ scopes, workspaceId }: { scopes: GrantScope[]; workspaceId: string }): boolean {
  return scopes.some((scope) => {
    if (scope.kind === GrantScopeKind.Workspace) return scope.workspaceId === workspaceId;
    return scope.kind === GrantScopeKind.Account;
  });
}
