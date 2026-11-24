const TASK_NUMBER_PATTERN = '[1-9][0-9]{0,8}';

enum HttpMethod {
  Get = 'GET',
  Post = 'POST',
  Patch = 'PATCH',
  Delete = 'DELETE',
}

export enum OwnerRoute {
  SignIn = 'sign_in',
  SignOut = 'sign_out',
  ReadOwner = 'read_owner',
  UpdateOwner = 'update_owner',
  ListWorkspaces = 'list_workspaces',
  CreateWorkspace = 'create_workspace',
  RenameWorkspace = 'rename_workspace',
  CreateProject = 'create_project',
  RenameProject = 'rename_project',
  AddTasks = 'add_tasks',
  UpdateTask = 'update_task',
  CompleteTasks = 'complete_tasks',
  ReopenTasks = 'reopen_tasks',
  ReadHistory = 'read_history',
  ReadChanges = 'read_changes',
  WatchChanges = 'watch_changes',
  ListKeys = 'list_keys',
  IssueKey = 'issue_key',
  RevokeKey = 'revoke_key',
}

type OwnerRouteDefinition = { method: HttpMethod; pattern: URLPattern };

export type OwnerRouteMatch = { route: OwnerRoute; params: Record<string, string> };

function definition({ method, pathname }: { method: HttpMethod; pathname: string }): OwnerRouteDefinition {
  return { method, pattern: new URLPattern({ pathname }) };
}

export const OWNER_ROUTES: Record<OwnerRoute, OwnerRouteDefinition> = {
  [OwnerRoute.SignIn]: definition({ method: HttpMethod.Post, pathname: '/owner/sessions' }),
  [OwnerRoute.SignOut]: definition({ method: HttpMethod.Delete, pathname: '/owner/sessions/current' }),
  [OwnerRoute.ReadOwner]: definition({ method: HttpMethod.Get, pathname: '/owner' }),
  [OwnerRoute.UpdateOwner]: definition({ method: HttpMethod.Patch, pathname: '/owner' }),
  [OwnerRoute.ListWorkspaces]: definition({ method: HttpMethod.Get, pathname: '/owner/workspaces' }),
  [OwnerRoute.CreateWorkspace]: definition({ method: HttpMethod.Post, pathname: '/owner/workspaces' }),
  [OwnerRoute.RenameWorkspace]: definition({ method: HttpMethod.Patch, pathname: '/owner/workspaces/:workspaceId' }),
  [OwnerRoute.CreateProject]: definition({ method: HttpMethod.Post, pathname: '/owner/workspaces/:workspaceId/projects' }),
  [OwnerRoute.RenameProject]: definition({ method: HttpMethod.Patch, pathname: '/owner/projects/:projectId' }),
  [OwnerRoute.AddTasks]: definition({ method: HttpMethod.Post, pathname: '/owner/projects/:projectId/tasks' }),
  [OwnerRoute.UpdateTask]: definition({
    method: HttpMethod.Patch,
    pathname: `/owner/projects/:projectId/tasks/:number(${TASK_NUMBER_PATTERN})`,
  }),
  [OwnerRoute.CompleteTasks]: definition({ method: HttpMethod.Post, pathname: '/owner/projects/:projectId/tasks/complete' }),
  [OwnerRoute.ReopenTasks]: definition({ method: HttpMethod.Post, pathname: '/owner/projects/:projectId/tasks/reopen' }),
  [OwnerRoute.ReadHistory]: definition({
    method: HttpMethod.Get,
    pathname: `/owner/projects/:projectId/tasks/:number(${TASK_NUMBER_PATTERN})/history`,
  }),
  [OwnerRoute.ReadChanges]: definition({ method: HttpMethod.Get, pathname: '/owner/projects/:projectId/changes' }),
  [OwnerRoute.WatchChanges]: definition({ method: HttpMethod.Get, pathname: '/owner/projects/:projectId/socket' }),
  [OwnerRoute.ListKeys]: definition({ method: HttpMethod.Get, pathname: '/owner/projects/:projectId/keys' }),
  [OwnerRoute.IssueKey]: definition({ method: HttpMethod.Post, pathname: '/owner/projects/:projectId/keys' }),
  [OwnerRoute.RevokeKey]: definition({ method: HttpMethod.Delete, pathname: '/owner/projects/:projectId/keys/:keyId' }),
};

function namedParams(groups: Record<string, string | undefined>): Record<string, string> {
  return Object.fromEntries(Object.entries(groups).filter((entry): entry is [string, string] => entry[1] !== undefined));
}

function matchOf({ request, route }: { request: Request; route: OwnerRoute }): OwnerRouteMatch[] {
  const { method, pattern } = OWNER_ROUTES[route];
  if (method !== request.method) return [];
  const result = pattern.exec(request.url);
  if (result === null) return [];
  return [{ route, params: namedParams(result.pathname.groups) }];
}

export function matchOwnerRoute(request: Request): OwnerRouteMatch | null {
  const [firstMatch] = Object.values(OwnerRoute).flatMap((route) => matchOf({ request, route }));
  if (firstMatch === undefined) return null;
  return firstMatch;
}
