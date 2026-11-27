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

export type SelectionScope = { kind: GrantScopeKind.Workspace; workspaceId: string } | { kind: GrantScopeKind.Project; projectId: string };

export type GrantScope = { kind: GrantScopeKind.Account } | SelectionScope;
