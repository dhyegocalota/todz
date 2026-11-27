import {
  type GrantScope,
  GrantScopeKind,
  type SelectionScope,
  isProjectCovered,
  isProjectScope,
  isSelectionScope,
  isWorkspaceCovered,
  isWorkspaceScope,
} from './oauth-grant-scope';
import { type OwnedTargets, findOwnedTargets } from './oauth-grant-scope-store';
import { OAuthScope, type OfferedScopes, scopeOfWord, wordOfScope } from './oauth-scope';

export type OwnedSelection = { scopes: SelectionScope[]; targets: OwnedTargets };

function isOwned({ scope, targets }: { scope: SelectionScope; targets: OwnedTargets }): boolean {
  if (scope.kind === GrantScopeKind.Workspace) return targets.workspaceIds.has(scope.workspaceId);
  return targets.workspaceOfProject.has(scope.projectId);
}

function foldedSelectionOf({ scopes, targets }: { scopes: SelectionScope[]; targets: OwnedTargets }): SelectionScope[] {
  const workspaceIds = new Set(scopes.filter(isWorkspaceScope).map(({ workspaceId }) => workspaceId));
  const kept = scopes.filter((scope) => {
    if (!isProjectScope(scope)) return true;
    const workspaceId = targets.workspaceOfProject.get(scope.projectId);
    return workspaceId === undefined || !workspaceIds.has(workspaceId);
  });
  return [...new Map(kept.map((scope) => [wordOfScope(scope), scope])).values()];
}

// NB ADR 0126: every id of a selection must be the signed-in owner's, and a project of a ticked workspace folds into the workspace.
export async function ownedSelectionOf({
  directory,
  ownerId,
  scopes,
}: {
  directory: D1Database;
  ownerId: string;
  scopes: SelectionScope[];
}): Promise<OwnedSelection | null> {
  const targets = await findOwnedTargets({ directory, ownerId, scopes });
  if (!scopes.every((scope) => isOwned({ scope, targets }))) return null;
  return { scopes: foldedSelectionOf({ scopes, targets }), targets };
}

function isScopeCovered({ held, scope, targets }: { held: GrantScope[]; scope: SelectionScope; targets: OwnedTargets }): boolean {
  if (scope.kind === GrantScopeKind.Workspace) return isWorkspaceCovered({ scopes: held, workspaceId: scope.workspaceId });
  const workspaceId = targets.workspaceOfProject.get(scope.projectId);
  if (workspaceId === undefined) return false;
  return isProjectCovered({ scopes: held, projectId: scope.projectId, workspaceId });
}

// NB ADR 0126: a grant only narrows: every requested scope must already be covered by what it holds, and be the owner's.
export async function narrowedScopesOf({
  directory,
  ownerId,
  held,
  requested,
}: {
  directory: D1Database;
  ownerId: string;
  held: GrantScope[];
  requested: GrantScope[];
}): Promise<GrantScope[] | null> {
  const selection = requested.filter(isSelectionScope);
  const isAccount = selection.length < requested.length;
  if (isAccount) return held.some((scope) => !isSelectionScope(scope)) ? requested : null;
  const owned = await ownedSelectionOf({ directory, ownerId, scopes: selection });
  if (owned === null) return null;
  const isNarrower = owned.scopes.every((scope) => isScopeCovered({ held, scope, targets: owned.targets }));
  if (!isNarrower) return null;
  return owned.scopes;
}

function chosenAccountOf({ scopes, offeredScopes }: { scopes: GrantScope[]; offeredScopes: OfferedScopes }): GrantScope[] | null {
  const isAccountAlone = scopes.length === 1;
  if (!isAccountAlone) return null;
  if (!offeredScopes[OAuthScope.Owner]) return null;
  return scopes;
}

// NB ADR 0126: a choice is the account alone or a non-empty selection of the owner's own workspaces and projects, never both.
export async function chosenScopesOf({
  directory,
  ownerId,
  choices,
  offeredScopes,
}: {
  directory: D1Database;
  ownerId: string;
  choices: string[];
  offeredScopes: OfferedScopes;
}): Promise<GrantScope[] | null> {
  const parsed = [...new Set(choices)].map(scopeOfWord);
  const isUnreadable = parsed.length === 0 || parsed.some((scope) => scope === null);
  if (isUnreadable) return null;
  const scopes = parsed.filter((scope): scope is GrantScope => scope !== null);
  const selection = scopes.filter(isSelectionScope);
  const isAccount = selection.length < scopes.length;
  if (isAccount) return chosenAccountOf({ scopes, offeredScopes });
  if (!offeredScopes[OAuthScope.Project]) return null;
  const owned = await ownedSelectionOf({ directory, ownerId, scopes: selection });
  if (owned === null) return null;
  return owned.scopes;
}
