import { z } from 'zod';
import { type GrantScope, GrantScopeKind, type SelectionScope, scopesJsonOf } from './oauth-grant-scope';
import { redirectHostOf } from './oauth-redirect-uri';

export const GRANT_SCOPES_JSON =
  "(SELECT json_group_array(json_object('kind', kind, 'workspace_id', workspace_id, 'project_id', project_id)) FROM oauth_grant_scopes WHERE grant_id = oauth_grants.id)";

export const PROJECT_WORKSPACE_ID =
  "(SELECT projects.workspace_id FROM oauth_grant_scopes JOIN projects ON projects.id = oauth_grant_scopes.project_id JOIN workspaces ON workspaces.id = projects.workspace_id AND workspaces.owner_id = oauth_grants.owner_id WHERE oauth_grant_scopes.grant_id = oauth_grants.id AND oauth_grant_scopes.kind = 'project' LIMIT 1)";

export const SCOPE_ROWS_OF_JSON =
  "SELECT ?, json_extract(value, '$.kind'), json_extract(value, '$.workspace_id'), json_extract(value, '$.project_id') FROM json_each(?)";

export type NamedScope =
  | { kind: GrantScopeKind.Account }
  | { kind: GrantScopeKind.Workspace; workspaceId: string; workspaceName: string }
  | { kind: GrantScopeKind.Project; projectId: string; projectName: string; workspaceId: string; workspaceName: string };

export type ConnectedAppRecord = {
  id: string;
  clientName: string;
  redirectUri: string;
  scopes: NamedScope[];
  createdAt: number;
  lastUsedAt: number;
};

export type OwnedTargets = { workspaceIds: Set<string>; workspaceOfProject: Map<string, string> };

type ClientIdRow = { client_id: string };
type ConnectedAppRow = {
  id: string;
  client_name: string;
  redirect_uri: string;
  created_at: number;
  last_used_at: number;
};

const NamedScopeRowSchema = z.discriminatedUnion('kind', [
  z.object({ grant_id: z.string(), kind: z.literal(GrantScopeKind.Account) }),
  z.object({ grant_id: z.string(), kind: z.literal(GrantScopeKind.Workspace), workspace_id: z.string(), workspace_name: z.string() }),
  z.object({
    grant_id: z.string(),
    kind: z.literal(GrantScopeKind.Project),
    project_id: z.string(),
    project_name: z.string(),
    project_workspace_id: z.string(),
    project_workspace_name: z.string(),
  }),
]);

type NamedScopeRow = z.output<typeof NamedScopeRowSchema>;

const OwnedTargetRowSchema = z.object({
  kind: z.enum([GrantScopeKind.Workspace, GrantScopeKind.Project]),
  workspace_id: z.string(),
  project_id: z.string().nullable(),
});

const GRANTS_QUERY =
  'SELECT oauth_grants.id, oauth_clients.name AS client_name, oauth_grants.redirect_uri, oauth_grants.created_at, oauth_grants.last_used_at FROM oauth_grants JOIN oauth_clients ON oauth_clients.id = oauth_grants.client_id WHERE oauth_grants.owner_id = ? AND (? IS NULL OR oauth_grants.id = ?) ORDER BY oauth_grants.created_at DESC, oauth_grants.rowid DESC';
const NAMED_SCOPES_QUERY = `SELECT oauth_grant_scopes.grant_id, oauth_grant_scopes.kind, workspaces.id AS workspace_id, workspaces.name AS workspace_name, projects.id AS project_id, projects.name AS project_name, project_workspaces.id AS project_workspace_id, project_workspaces.name AS project_workspace_name
FROM oauth_grant_scopes
JOIN oauth_grants ON oauth_grants.id = oauth_grant_scopes.grant_id
LEFT JOIN workspaces ON workspaces.id = oauth_grant_scopes.workspace_id AND workspaces.owner_id = oauth_grants.owner_id
LEFT JOIN projects ON projects.id = oauth_grant_scopes.project_id
LEFT JOIN workspaces AS project_workspaces ON project_workspaces.id = projects.workspace_id AND project_workspaces.owner_id = oauth_grants.owner_id
WHERE oauth_grants.owner_id = ? AND (? IS NULL OR oauth_grants.id = ?)
AND (oauth_grant_scopes.kind = 'account' OR workspaces.id IS NOT NULL OR project_workspaces.id IS NOT NULL)
ORDER BY CASE oauth_grant_scopes.kind WHEN 'account' THEN 0 WHEN 'workspace' THEN 1 ELSE 2 END, workspaces.name, project_workspaces.name, projects.name`;
const OWNED_TARGETS_QUERY = `SELECT 'workspace' AS kind, id AS workspace_id, NULL AS project_id FROM workspaces WHERE owner_id = ? AND id IN (SELECT value FROM json_each(?))
UNION ALL SELECT 'project' AS kind, projects.workspace_id, projects.id AS project_id FROM projects JOIN workspaces ON workspaces.id = projects.workspace_id WHERE workspaces.owner_id = ? AND projects.id IN (SELECT value FROM json_each(?))`;
const PROJECT_GRANTS_QUERY =
  'SELECT client_id FROM oauth_grants WHERE EXISTS (SELECT 1 FROM oauth_grant_scopes WHERE grant_id = oauth_grants.id AND project_id = ?) AND NOT EXISTS (SELECT 1 FROM oauth_grant_scopes AS other WHERE other.grant_id = oauth_grants.id AND other.project_id IS NOT ?)';
const WORKSPACE_GRANTS_QUERY =
  'SELECT client_id FROM oauth_grants WHERE EXISTS (SELECT 1 FROM oauth_grant_scopes WHERE grant_id = oauth_grants.id AND (workspace_id = ? OR project_id IN (SELECT id FROM projects WHERE workspace_id = ?))) AND NOT EXISTS (SELECT 1 FROM oauth_grant_scopes AS other WHERE other.grant_id = oauth_grants.id AND other.workspace_id IS NOT ? AND (other.project_id IS NULL OR other.project_id NOT IN (SELECT id FROM projects WHERE workspace_id = ?)))';

function namedScopeOf(row: NamedScopeRow): NamedScope {
  if (row.kind === GrantScopeKind.Workspace) {
    return { kind: row.kind, workspaceId: row.workspace_id, workspaceName: row.workspace_name };
  }
  if (row.kind === GrantScopeKind.Project) {
    return {
      kind: row.kind,
      projectId: row.project_id,
      projectName: row.project_name,
      workspaceId: row.project_workspace_id,
      workspaceName: row.project_workspace_name,
    };
  }
  return { kind: row.kind };
}

export function grantScopeOfNamed(scope: NamedScope): GrantScope {
  if (scope.kind === GrantScopeKind.Workspace) return { kind: scope.kind, workspaceId: scope.workspaceId };
  if (scope.kind === GrantScopeKind.Project) return { kind: scope.kind, projectId: scope.projectId };
  return { kind: scope.kind };
}

async function connectedApps({
  directory,
  ownerId,
  grantId,
}: {
  directory: D1Database;
  ownerId: string;
  grantId: string | null;
}): Promise<ConnectedAppRecord[]> {
  const [grants, scopes] = await directory.batch([
    directory.prepare(GRANTS_QUERY).bind(ownerId, grantId, grantId),
    directory.prepare(NAMED_SCOPES_QUERY).bind(ownerId, grantId, grantId),
  ]);
  if (grants === undefined || scopes === undefined) throw new Error('the batch answers one result per statement');
  const scopeRows = z.array(NamedScopeRowSchema).parse(scopes.results);
  return (grants.results as ConnectedAppRow[]).map((row) => ({
    id: row.id,
    clientName: row.client_name,
    redirectUri: row.redirect_uri,
    scopes: scopeRows.filter((scope) => scope.grant_id === row.id).map(namedScopeOf),
    createdAt: row.created_at,
    lastUsedAt: row.last_used_at,
  }));
}

export function listConnectedApps({ directory, ownerId }: { directory: D1Database; ownerId: string }): Promise<ConnectedAppRecord[]> {
  return connectedApps({ directory, ownerId, grantId: null });
}

export async function findConnectedApp({
  directory,
  ownerId,
  grantId,
}: {
  directory: D1Database;
  ownerId: string;
  grantId: string;
}): Promise<ConnectedAppRecord | null> {
  const [app] = await connectedApps({ directory, ownerId, grantId });
  if (app === undefined) return null;
  return app;
}

// NB ADR 0126: what a client already holds is named only for the signed-in owner's grants of the same client name and redirect host.
export async function heldScopesOf({
  directory,
  ownerId,
  clientName,
  redirectHost,
}: {
  directory: D1Database;
  ownerId: string;
  clientName: string;
  redirectHost: string;
}): Promise<NamedScope[]> {
  const apps = await connectedApps({ directory, ownerId, grantId: null });
  return apps
    .filter((app) => app.clientName === clientName && redirectHostOf(app.redirectUri) === redirectHost)
    .flatMap((app) => app.scopes);
}

export async function findOwnedTargets({
  directory,
  ownerId,
  scopes,
}: {
  directory: D1Database;
  ownerId: string;
  scopes: SelectionScope[];
}): Promise<OwnedTargets> {
  const workspaceIds = scopes.flatMap((scope) => (scope.kind === GrantScopeKind.Workspace ? [scope.workspaceId] : []));
  const projectIds = scopes.flatMap((scope) => (scope.kind === GrantScopeKind.Project ? [scope.projectId] : []));
  const { results } = await directory
    .prepare(OWNED_TARGETS_QUERY)
    .bind(ownerId, JSON.stringify(workspaceIds), ownerId, JSON.stringify(projectIds))
    .all();
  const rows = z.array(OwnedTargetRowSchema).parse(results);
  return {
    workspaceIds: new Set(rows.filter((row) => row.kind === GrantScopeKind.Workspace).map((row) => row.workspace_id)),
    workspaceOfProject: new Map(
      rows.flatMap((row) =>
        row.kind === GrantScopeKind.Project && row.project_id !== null ? [[row.project_id, row.workspace_id] as const] : [],
      ),
    ),
  };
}

// NB ADR 0126: new scopes are inserted before the rest are deleted, so the grant never holds none and the trigger never deletes it; a narrowed grant never reaches beyond its scopes.
export async function replaceGrantScopes({
  directory,
  ownerId,
  grantId,
  scopes,
}: {
  directory: D1Database;
  ownerId: string;
  grantId: string;
  scopes: GrantScope[];
}): Promise<void> {
  const scopesJson = scopesJsonOf(scopes);
  await directory.batch([
    directory.prepare('UPDATE oauth_grants SET reaches_workspace = 0 WHERE id = ? AND owner_id = ?').bind(grantId, ownerId),
    directory
      .prepare(
        `INSERT OR IGNORE INTO oauth_grant_scopes (grant_id, kind, workspace_id, project_id) ${SCOPE_ROWS_OF_JSON} WHERE EXISTS (SELECT 1 FROM oauth_grants WHERE id = ? AND owner_id = ?)`,
      )
      .bind(grantId, scopesJson, grantId, ownerId),
    directory
      .prepare(
        "DELETE FROM oauth_grant_scopes WHERE grant_id = ? AND grant_id IN (SELECT id FROM oauth_grants WHERE owner_id = ?) AND NOT EXISTS (SELECT 1 FROM json_each(?) AS kept WHERE json_extract(kept.value, '$.kind') = oauth_grant_scopes.kind AND json_extract(kept.value, '$.workspace_id') IS oauth_grant_scopes.workspace_id AND json_extract(kept.value, '$.project_id') IS oauth_grant_scopes.project_id)",
      )
      .bind(grantId, ownerId, scopesJson),
  ]);
}

// NB ADR 0126: a project deletion names only the grants whose last scope it removes; a grant that keeps another scope survives.
export async function clientIdsOfProjectGrants({ directory, projectId }: { directory: D1Database; projectId: string }): Promise<string[]> {
  const { results } = await directory.prepare(PROJECT_GRANTS_QUERY).bind(projectId, projectId).all<ClientIdRow>();
  return results.map((row) => row.client_id);
}

export async function clientIdsOfWorkspaceGrants({
  directory,
  workspaceId,
}: {
  directory: D1Database;
  workspaceId: string;
}): Promise<string[]> {
  const { results } = await directory
    .prepare(WORKSPACE_GRANTS_QUERY)
    .bind(workspaceId, workspaceId, workspaceId, workspaceId)
    .all<ClientIdRow>();
  return results.map((row) => row.client_id);
}
