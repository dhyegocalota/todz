export enum OAuthScope {
  Project = 'project',
  Owner = 'owner',
}

export type OfferedScopes = Record<OAuthScope, boolean>;

const SCOPE_SEPARATOR = ' ';
const PROJECT_SCOPE_PREFIX = `${OAuthScope.Project}:`;

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

export function grantedScopeOf(projectId: string | null): string {
  if (projectId === null) return OAuthScope.Owner;
  return `${PROJECT_SCOPE_PREFIX}${projectId}`;
}

export function scopeKindOf(projectId: string | null): OAuthScope {
  if (projectId === null) return OAuthScope.Owner;
  return OAuthScope.Project;
}
