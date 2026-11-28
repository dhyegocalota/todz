import {
  type GrantScope,
  GrantScopeKind,
  type SelectionScope,
  isAccountScopes,
  isProjectScope,
  isWorkspaceScope,
} from './oauth-grant-scope';

export enum OAuthScope {
  Project = 'project',
  Owner = 'owner',
}

export type OfferedScopes = Record<OAuthScope, boolean>;

const SCOPE_SEPARATOR = ' ';
const PROJECT_SCOPE_PREFIX = `${OAuthScope.Project}:`;
const WORKSPACE_SCOPE_PREFIX = 'workspace:';

export const SUPPORTED_SCOPES = Object.values(OAuthScope);

function isProjectWord(word: string): boolean {
  return word === OAuthScope.Project || word.startsWith(PROJECT_SCOPE_PREFIX);
}

// NB ADR 0109: a client that names no scope is offered both; unknown words are ignored, and the grant never exceeds what was asked.
export function offeredScopesOf(requested: string | null): OfferedScopes | null {
  if (requested === null) return { [OAuthScope.Project]: true, [OAuthScope.Owner]: true };
  const words = requested.split(SCOPE_SEPARATOR);
  const offered = { [OAuthScope.Project]: words.some(isProjectWord), [OAuthScope.Owner]: words.includes(OAuthScope.Owner) };
  const isNothingOffered = !offered[OAuthScope.Project] && !offered[OAuthScope.Owner];
  if (isNothingOffered) return null;
  return offered;
}

export function wordOfScope(scope: SelectionScope): string {
  if (scope.kind === GrantScopeKind.Workspace) return `${WORKSPACE_SCOPE_PREFIX}${scope.workspaceId}`;
  return `${PROJECT_SCOPE_PREFIX}${scope.projectId}`;
}

function scopeOfPrefixedWord({ word, prefix }: { word: string; prefix: string }): string | null {
  if (!word.startsWith(prefix)) return null;
  const id = word.slice(prefix.length);
  if (id === '') return null;
  return id;
}

export function scopeOfWord(word: string): GrantScope | null {
  if (word === OAuthScope.Owner) return { kind: GrantScopeKind.Account };
  const workspaceId = scopeOfPrefixedWord({ word, prefix: WORKSPACE_SCOPE_PREFIX });
  if (workspaceId !== null) return { kind: GrantScopeKind.Workspace, workspaceId };
  const projectId = scopeOfPrefixedWord({ word, prefix: PROJECT_SCOPE_PREFIX });
  if (projectId !== null) return { kind: GrantScopeKind.Project, projectId };
  return null;
}

// NB ADR 0126: the account answers owner, anything else answers its workspace and project words, so one project stays project:<id>.
export function grantedScopeOf(scopes: GrantScope[]): string {
  if (isAccountScopes(scopes)) return OAuthScope.Owner;
  const workspaceWords = scopes.filter(isWorkspaceScope).map(wordOfScope);
  const projectWords = scopes.filter(isProjectScope).map(wordOfScope);
  return [...workspaceWords.sort(), ...projectWords.sort()].join(SCOPE_SEPARATOR);
}
